from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .config import Settings
from .metrics import StreamMetricsTracker
from .observability import format_log_event
from .upstream import build_request, fetch_upstream_models


STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_CONTENT_TYPES = {
    "app.js": "application/javascript; charset=utf-8",
    "styles.css": "text/css; charset=utf-8",
    "vendor/marked.umd.js": "application/javascript; charset=utf-8",
    "vendor/purify.min.js": "application/javascript; charset=utf-8",
}
HTML_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "img-src 'self' data: blob:; "
    "media-src 'self' data: blob:; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self' 'unsafe-inline'; "
    "connect-src 'self'; "
    "frame-src 'self'; "
    "font-src 'self' data:; "
    "base-uri 'none'; "
    "object-src 'none'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "no-store",
}
def _round_metric(value: object) -> object:
    if isinstance(value, float):
        return round(value, 6)
    return value


def _request_settings(
    settings: Settings,
    *,
    upstream_base_url: object = None,
    upstream_api_key: object = None,
    model: object = None,
) -> Settings:
    request_settings = settings
    if isinstance(upstream_base_url, str) and upstream_base_url.strip():
        request_settings = request_settings.with_upstream_base_url(upstream_base_url)
    if isinstance(upstream_api_key, str):
        request_settings = request_settings.with_upstream_api_key(upstream_api_key)
    elif upstream_api_key is not None:
        raise ValueError("upstream_api_key must be a string")
    if isinstance(model, str) and model.strip():
        request_settings = request_settings.with_model(model)
    return request_settings


def _strip_runtime_fields(payload: dict[str, object]) -> dict[str, object]:
    sanitized = dict(payload)
    sanitized.pop("upstream_base_url", None)
    sanitized.pop("upstream_api_key", None)
    sanitized.pop("upstream_headers", None)
    sanitized.pop("upstream_auth_header", None)
    sanitized.pop("request_id_header", None)
    return sanitized


def _request_label_for_path(path: str) -> str:
    normalized = path.strip().lstrip("/")
    return normalized or "request"


def _selected_response_headers(headers, *header_names: str) -> dict[str, str] | None:
    selected: dict[str, str] = {}
    for header_name in header_names:
        value = headers.get(header_name)
        if not value:
            continue
        selected[header_name] = value
    return selected or None


def _load_json_object_body(body: bytes, *, path: str) -> dict[str, object]:
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception as err:  # noqa: BLE001
        raise ValueError(f"{_request_label_for_path(path)} request must be valid JSON") from err
    if not isinstance(payload, dict):
        raise ValueError(f"{_request_label_for_path(path)} request must be a JSON object")
    return payload


def create_handler(settings: Settings):
    class Handler(BaseHTTPRequestHandler):
        def _send_standard_headers(
            self,
            *,
            content_type: str,
            extra_headers: dict[str, str] | None = None,
        ) -> None:
            for name, value in SECURITY_HEADERS.items():
                self.send_header(name, value)
            if content_type.startswith("text/html"):
                self.send_header("Content-Security-Policy", HTML_CONTENT_SECURITY_POLICY)
            if extra_headers:
                for name, value in extra_headers.items():
                    self.send_header(name, value)

        def _start_request_context(self, path: str) -> None:
            self._request_started_at = time.perf_counter()
            self._request_status = None
            self._request_log_fields = {
                "method": self.command,
                "path": path,
                "client_ip": self.client_address[0] if self.client_address else "unknown",
            }

        def _set_request_target(self, request_settings: Settings) -> None:
            self._request_log_fields["upstream_base_url"] = request_settings.upstream_base_url
            if request_settings.model:
                self._request_log_fields["model"] = request_settings.model

        def _log_request(self, *, error: str | None = None, extra: dict[str, object] | None = None) -> None:
            started_at = getattr(self, "_request_started_at", None)
            duration_ms = None
            if isinstance(started_at, float):
                duration_ms = round((time.perf_counter() - started_at) * 1000.0, 3)
            fields = dict(getattr(self, "_request_log_fields", {}))
            fields["status"] = getattr(self, "_request_status", None)
            fields["duration_ms"] = duration_ms
            if extra:
                for key, value in extra.items():
                    if value is not None:
                        fields[key] = _round_metric(value)
            print(
                format_log_event(
                    "error" if error else "info",
                    "http_request",
                    error=error,
                    **fields,
                ),
                flush=True,
            )

        def _send_bytes(
            self,
            code: int,
            body: bytes,
            content_type: str = "application/json; charset=utf-8",
            *,
            extra_headers: dict[str, str] | None = None,
        ) -> None:
            self._request_status = code
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self._send_standard_headers(content_type=content_type, extra_headers=extra_headers)
            self.end_headers()
            self.wfile.write(body)

        def _send_text(
            self,
            code: int,
            body: str,
            content_type: str,
            *,
            extra_headers: dict[str, str] | None = None,
        ) -> None:
            self._send_bytes(
                code,
                body.encode("utf-8"),
                content_type,
                extra_headers=extra_headers,
            )

        def _send_json(
            self,
            code: int,
            payload: dict[str, object],
            *,
            extra_headers: dict[str, str] | None = None,
        ) -> None:
            self._send_text(
                code,
                json.dumps(payload, ensure_ascii=False),
                "application/json; charset=utf-8",
                extra_headers=extra_headers,
            )

        def _serve_index(self) -> None:
            self._send_bytes(
                200,
                (STATIC_DIR / "index.html").read_bytes(),
                "text/html; charset=utf-8",
            )

        def _serve_static(self, asset_name: str) -> None:
            if asset_name not in STATIC_CONTENT_TYPES:
                self._send_text(404, "not found", "text/plain; charset=utf-8")
                return
            path = STATIC_DIR / asset_name
            self._send_bytes(200, path.read_bytes(), STATIC_CONTENT_TYPES[asset_name])

        def do_GET(self) -> None:
            path = urlparse(self.path).path
            self._start_request_context(path)
            error = None
            try:
                if path == "/":
                    self._serve_index()
                    return
                if path == "/config":
                    self._send_json(200, settings.ui_config())
                    return
                if path.startswith("/static/"):
                    self._serve_static(path.removeprefix("/static/"))
                    return
                self._send_text(404, "not found", "text/plain; charset=utf-8")
            except BrokenPipeError:
                if self._request_status is None:
                    self._request_status = 499
                error = "client_disconnected"
            finally:
                self._log_request(error=error)

        def do_POST(self) -> None:
            path = urlparse(self.path).path
            self._start_request_context(path)
            error = None
            request_settings = settings
            length = int(self.headers.get("Content-Length", "0"))
            if length > settings.max_request_bytes:
                error = "request_too_large"
                self._send_json(413, {"error": "request too large"})
                self._log_request(error=error)
                return

            body = self.rfile.read(length)
            request_json = None
            try:
                if path not in {"/models", "/chat"}:
                    error = "not_found"
                    self._send_text(404, "not found", "text/plain; charset=utf-8")
                    return
                if not body:
                    error = f"{_request_label_for_path(path)} request must be a JSON object"
                    self._send_json(400, {"error": error})
                    return
                try:
                    payload = _load_json_object_body(body, path=path)
                except ValueError as err:
                    error = str(err)
                    self._send_json(400, {"error": str(err)})
                    return
                try:
                    request_settings = _request_settings(
                        settings,
                        upstream_base_url=payload.get("upstream_base_url"),
                        upstream_api_key=payload.get("upstream_api_key"),
                        model=payload.get("model"),
                    )
                except ValueError as err:
                    error = str(err)
                    self._send_json(400, {"error": str(err)})
                    return
                self._set_request_target(request_settings)
                if path == "/models":
                    self._serve_models(request_settings)
                    return

                request_json = _strip_runtime_fields(payload)
                body = json.dumps(request_json, ensure_ascii=False).encode("utf-8")
                request = build_request(
                    request_settings,
                    "/v1/chat/completions",
                    body=body,
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=request_settings.upstream_chat_timeout_s) as response:
                    self._request_status = response.status
                    response_content_type = response.headers.get("Content-Type", "application/json")
                    self.send_response(response.status)
                    self.send_header("Content-Type", response_content_type)
                    self._send_standard_headers(content_type=response_content_type)
                    self.end_headers()
                    metrics = self._stream_chat_with_metrics(
                        response,
                        request_json,
                    )
                    self._log_request(error=error, extra=metrics)
                    return
            except urllib.error.HTTPError as err:
                error = f"upstream_http_{err.code}"
                self._send_bytes(
                    err.code,
                    err.read(),
                    err.headers.get("Content-Type", "text/plain; charset=utf-8"),
                    extra_headers=_selected_response_headers(err.headers, "Retry-After"),
                )
            except urllib.error.URLError as err:
                error = f"upstream_unreachable:{err.reason}"
                self._send_json(502, {"error": str(err.reason)})
            except TimeoutError:
                error = "upstream_timeout"
                self._send_json(504, {"error": "upstream timeout"})
            except BrokenPipeError:
                if self._request_status is None:
                    self._request_status = 499
                error = "client_disconnected"
            except Exception as err:  # noqa: BLE001
                error = type(err).__name__
                self._send_json(502, {"error": str(err)})
            finally:
                if path != "/chat" or self._request_status not in {200} or error is not None:
                    self._log_request(error=error)

        def log_message(self, fmt: str, *args: object) -> None:
            from time import strftime

            print("[%s] %s" % (strftime("%H:%M:%S"), fmt % args), flush=True)

        def _serve_models(self, request_settings: Settings) -> None:
            request = build_request(
                request_settings,
                "/v1/models",
                method="GET",
                headers={"Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(
                    request,
                    timeout=request_settings.upstream_model_timeout_s,
                ) as response:
                    body = response.read()
                    content_type = response.headers.get("Content-Type", "application/json")
                self._send_bytes(200, body, content_type)
            except urllib.error.HTTPError as err:
                self._send_bytes(
                    err.code,
                    err.read(),
                    err.headers.get("Content-Type", "text/plain; charset=utf-8"),
                    extra_headers=_selected_response_headers(err.headers, "Retry-After"),
                )
            except Exception as err:  # noqa: BLE001
                self._send_json(502, {"error": str(err)})

        def _send_sse_metrics(self, metrics: dict[str, object]) -> None:
            payload = json.dumps({"metrics": metrics}, separators=(",", ":")).encode("utf-8")
            self.wfile.write(b"data: " + payload + b"\n\n")
            self.wfile.flush()

        def _stream_chat_with_metrics(
            self,
            response,
            request_json: dict[str, object],
        ) -> dict[str, object] | None:
            tracker = StreamMetricsTracker(
            )

            event_lines: list[str] = []

            def _consume_event(lines: list[str]) -> None:
                if not lines:
                    return
                data_lines = [
                    line[5:].strip()
                    for line in lines
                    if line.startswith("data:")
                ]
                if not data_lines:
                    return
                data = "\n".join(data_lines).strip()
                if not data or data == "[DONE]":
                    return
                try:
                    payload = json.loads(data)
                except Exception:
                    return
                if not isinstance(payload, dict):
                    return
                tracker.record_event(payload)

            while True:
                raw_line = response.readline()
                if not raw_line:
                    break
                self.wfile.write(raw_line)
                self.wfile.flush()

                line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
                if not line:
                    _consume_event(event_lines)
                    event_lines = []
                    continue
                event_lines.append(line)

            _consume_event(event_lines)

            if tracker.saw_content:
                final_metrics = tracker.final_metrics()
                self._send_sse_metrics(final_metrics)
                return final_metrics
            return None

    return Handler


def run_server(settings: Settings) -> int:
    if not settings.model:
        models = fetch_upstream_models(settings) or []
        for item in models:
            model_id = item.get("id")
            if isinstance(model_id, str) and model_id:
                settings = settings.with_model(model_id)
                break

    handler = create_handler(settings)
    server = ThreadingHTTPServer((settings.host, settings.port), handler)
    print(
        f"{settings.title}: http://{settings.host}:{settings.port} -> "
        f"{settings.upstream_base_url} model={settings.model}",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main() -> int:
    return run_server(Settings.from_env())
