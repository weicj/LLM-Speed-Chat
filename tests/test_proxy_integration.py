from __future__ import annotations

import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from llm_speed_chat.app import create_handler
from llm_speed_chat.config import Settings


class ProxyIntegrationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.upstream_state: dict[str, object] = {"requests": [], "models_mode": "default"}
        self.upstream_server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            self._make_upstream_handler(),
        )
        self._start_server(self.upstream_server)
        self.upstream_url = f"http://127.0.0.1:{self.upstream_server.server_address[1]}"

        settings = Settings.from_env(
            {
                "UPSTREAM_BASE_URL": self.upstream_url,
                "HOST": "127.0.0.1",
                "PORT": "0",
            }
        )
        handler = create_handler(settings)
        self.app_server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self._start_server(self.app_server)
        self.app_url = f"http://127.0.0.1:{self.app_server.server_address[1]}"

    def tearDown(self) -> None:
        self._stop_server(self.app_server)
        self._stop_server(self.upstream_server)

    def _start_server(self, server: ThreadingHTTPServer) -> None:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        server._test_thread = thread  # type: ignore[attr-defined]

    def _stop_server(self, server: ThreadingHTTPServer) -> None:
        server.shutdown()
        server.server_close()
        thread = getattr(server, "_test_thread", None)
        if thread is not None:
            thread.join(timeout=5)

    def _set_models_mode(self, mode: str = "default") -> None:
        self.upstream_state["models_mode"] = mode

    def _set_chat_mode(self, mode: str = "default") -> None:
        self.upstream_state["chat_mode"] = mode

    def _make_upstream_handler(self):
        state = self.upstream_state

        class UpstreamHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                state["requests"].append(
                    {
                        "path": self.path,
                        "headers": dict(self.headers.items()),
                        "body": "",
                    }
                )
                if self.path == "/v1/models":
                    if state.get("models_mode") == "rate_limited":
                        self.send_response(429)
                        self.send_header("Content-Type", "application/json")
                        self.send_header("Retry-After", "11")
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "model list rate limit"}).encode("utf-8"))
                        return
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"data": [{"id": "demo-model", "root": "/tmp/demo-model"}]}).encode("utf-8")
                    )
                    return
                self.send_error(404)

            def do_POST(self) -> None:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length)
                state["requests"].append(
                    {
                        "path": self.path,
                        "headers": dict(self.headers.items()),
                        "body": body.decode("utf-8"),
                    }
                )
                if self.path == "/v1/chat/completions":
                    if state.get("chat_mode") == "upstream_rate_limited":
                        self.send_response(429)
                        self.send_header("Content-Type", "application/json")
                        self.send_header("Retry-After", "7")
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "upstream rate limit"}).encode("utf-8"))
                        return
                    self.send_response(200)
                    self.send_header("Content-Type", "text/event-stream")
                    self.end_headers()
                    self.wfile.write(
                        b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
                    )
                    self.wfile.write(
                        b'data: {"usage":{"prompt_tokens":3,"completion_tokens":1}}\n\n'
                    )
                    self.wfile.write(b"data: [DONE]\n\n")
                    self.wfile.flush()
                    return
                self.send_error(404)

            def log_message(self, fmt: str, *args: object) -> None:
                return

        return UpstreamHandler

    def _request_record(self, path: str) -> dict[str, object]:
        requests = self.upstream_state["requests"]
        for record in reversed(requests):
            if record["path"] == path:
                return record
        self.fail(f"missing upstream request for path {path}")

    def _header_value(self, headers: dict[str, str], name: str) -> str:
        for header_name, value in headers.items():
            if header_name.lower() == name.lower():
                return value
        self.fail(f"missing header {name}")

    def _chat_payload(self) -> dict[str, object]:
        return {
            "model": "demo-model",
            "messages": [{"role": "user", "content": "hello"}],
            "stream": True,
        }

    def _request(
        self,
        path: str,
        *,
        headers: dict[str, str] | None = None,
        payload: dict[str, object] | None = None,
        method: str = "GET",
        expect_error: bool = False,
    ) -> tuple[int, bytes, dict[str, str]]:
        body = None
        request_headers: dict[str, str] = dict(headers or {})
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            request_headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            self.app_url + path,
            data=body,
            headers=request_headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, response.read(), dict(response.headers.items())
        except urllib.error.HTTPError as err:
            if not expect_error:
                raise
            return err.code, err.read(), dict(err.headers.items())

    def test_root_response_has_security_headers(self) -> None:
        status, _, headers = self._request("/")

        self.assertEqual(status, 200)
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertIn("Content-Security-Policy", headers)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_removed_service_routes_return_not_found(self) -> None:
        for path in ("/healthz", "/readyz", "/metrics"):
            status, _, _ = self._request(path, expect_error=True)
            self.assertEqual(status, 404, path)

    def test_config_returns_frontend_defaults(self) -> None:
        status, body, _ = self._request("/config")

        self.assertEqual(status, 200)
        payload = json.loads(body.decode("utf-8"))
        self.assertEqual(payload["title"], "LLM Speed Chat")
        self.assertIn("defaultMaxTokens", payload)
        self.assertNotIn("requestIdHeader", payload)

    def test_models_post_forwards_runtime_api_key(self) -> None:
        status, body, _ = self._request(
            "/models",
            method="POST",
            payload={
                "upstream_base_url": f"{self.upstream_url}/v1",
                "upstream_api_key": "sk-demo",
            },
        )

        self.assertEqual(status, 200)
        payload = json.loads(body.decode("utf-8"))
        self.assertEqual(payload["data"][0]["id"], "demo-model")

        upstream = self._request_record("/v1/models")
        headers = upstream["headers"]
        self.assertEqual(self._header_value(headers, "Authorization"), "Bearer sk-demo")

    def test_models_post_preserves_upstream_retry_after_header(self) -> None:
        self._set_models_mode("rate_limited")

        status, _, headers = self._request(
            "/models",
            method="POST",
            payload={"upstream_base_url": self.upstream_url},
            expect_error=True,
        )

        self.assertEqual(status, 429)
        self.assertEqual(headers["Retry-After"], "11")

    def test_chat_proxy_strips_runtime_proxy_fields_and_streams_metrics(self) -> None:
        status, body, headers = self._request(
            "/chat",
            method="POST",
            payload={
                **self._chat_payload(),
                "upstream_base_url": f"{self.upstream_url}/v1/chat/completions",
                "upstream_api_key": "sk-demo",
                "upstream_headers": {"x-test": "123"},
                "upstream_auth_header": "Authorization",
                "request_id_header": "X-Request-Id",
            },
        )

        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/event-stream"))
        text = body.decode("utf-8")
        self.assertIn('"delta":{"content":"hello"}', text)
        self.assertIn('"metrics"', text)
        self.assertIn('"completion_tokens":1', text)

        upstream = self._request_record("/v1/chat/completions")
        upstream_payload = json.loads(upstream["body"])
        self.assertNotIn("upstream_base_url", upstream_payload)
        self.assertNotIn("upstream_api_key", upstream_payload)
        self.assertNotIn("upstream_headers", upstream_payload)
        self.assertNotIn("upstream_auth_header", upstream_payload)
        self.assertNotIn("request_id_header", upstream_payload)
        self.assertEqual(self._header_value(upstream["headers"], "Authorization"), "Bearer sk-demo")

    def test_chat_proxy_preserves_upstream_retry_after_header(self) -> None:
        self._set_chat_mode("upstream_rate_limited")

        status, body, headers = self._request(
            "/chat",
            method="POST",
            payload=self._chat_payload(),
            expect_error=True,
        )

        self.assertEqual(status, 429)
        self.assertEqual(headers["Retry-After"], "7")
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "upstream rate limit")

    def test_chat_rejects_invalid_json_before_hitting_upstream(self) -> None:
        request = urllib.request.Request(
            self.app_url + "/chat",
            data=b"{",
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(request, timeout=5)

        self.assertEqual(ctx.exception.code, 400)
        self.assertEqual(json.loads(ctx.exception.read().decode("utf-8"))["error"], "chat request must be valid JSON")

    def test_models_reject_non_object_json_before_hitting_upstream(self) -> None:
        request = urllib.request.Request(
            self.app_url + "/models",
            data=b"[]",
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(request, timeout=5)

        self.assertEqual(ctx.exception.code, 400)
        self.assertEqual(json.loads(ctx.exception.read().decode("utf-8"))["error"], "models request must be a JSON object")

    def test_chat_rejects_request_body_larger_than_configured_limit(self) -> None:
        tiny_settings = Settings.from_env(
            {
                "UPSTREAM_BASE_URL": self.upstream_url,
                "HOST": "127.0.0.1",
                "PORT": "0",
                "MAX_REQUEST_BYTES": "16",
            }
        )
        server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(tiny_settings))
        self._start_server(server)
        self.addCleanup(lambda: self._stop_server(server))
        base_url = f"http://127.0.0.1:{server.server_address[1]}"

        request = urllib.request.Request(
            base_url + "/chat",
            data=b'{"model":"demo-model","messages":[]}',
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(request, timeout=5)

        self.assertEqual(ctx.exception.code, 413)
        self.assertEqual(json.loads(ctx.exception.read().decode("utf-8"))["error"], "request too large")


if __name__ == "__main__":
    unittest.main()
