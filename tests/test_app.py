from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from llm_speed_chat import __version__
from llm_speed_chat.app import _load_json_object_body
from llm_speed_chat.app import _request_label_for_path
from llm_speed_chat.app import _selected_response_headers
from llm_speed_chat.app import _request_settings, _strip_runtime_fields
from llm_speed_chat.app import run_server
from llm_speed_chat.__main__ import build_parser, main as cli_main, settings_from_args
from llm_speed_chat.config import Settings


class AppHelpersTest(unittest.TestCase):
    def test_request_settings_applies_runtime_upstream_and_model(self) -> None:
        base = Settings.from_env(
            {
                "UPSTREAM_BASE_URL": "http://127.0.0.1:8000",
                "MODEL": "",
            }
        )

        resolved = _request_settings(
            base,
            upstream_base_url="http://example.com:9000/v1/",
            model="demo-model",
        )

        self.assertEqual(resolved.upstream_base_url, "http://example.com:9000")
        self.assertEqual(resolved.model, "demo-model")

    def test_request_settings_applies_runtime_api_key(self) -> None:
        base = Settings.from_env({})

        resolved = _request_settings(
            base,
            upstream_api_key="secret-key",
        )

        self.assertEqual(resolved.upstream_api_key, "secret-key")

    def test_strip_runtime_fields_removes_internal_connection_fields(self) -> None:
        payload = {
            "upstream_base_url": "http://example.com:9000",
            "upstream_api_key": "secret-key",
            "upstream_headers": {"x-test": "123"},
            "upstream_auth_header": "Authorization",
            "request_id_header": "X-Request-Id",
            "model": "demo-model",
            "messages": [],
        }

        stripped = _strip_runtime_fields(payload)

        self.assertNotIn("upstream_base_url", stripped)
        self.assertNotIn("upstream_api_key", stripped)
        self.assertNotIn("upstream_headers", stripped)
        self.assertNotIn("upstream_auth_header", stripped)
        self.assertNotIn("request_id_header", stripped)
        self.assertEqual(stripped["model"], "demo-model")
        self.assertEqual(stripped["messages"], [])

    def test_request_settings_rejects_invalid_runtime_url(self) -> None:
        base = Settings.from_env({})

        with self.assertRaises(ValueError):
            _request_settings(base, upstream_base_url="/v1")

    def test_request_settings_accepts_host_without_scheme(self) -> None:
        base = Settings.from_env({})

        resolved = _request_settings(base, upstream_base_url="localhost:9000")

        self.assertEqual(resolved.upstream_base_url, "http://localhost:9000")

    def test_request_label_for_path_normalizes_special_paths(self) -> None:
        self.assertEqual(_request_label_for_path("/chat"), "chat")
        self.assertEqual(_request_label_for_path("models"), "models")
        self.assertEqual(_request_label_for_path("/"), "request")

    def test_load_json_object_body_rejects_invalid_json(self) -> None:
        with self.assertRaisesRegex(ValueError, "chat request must be valid JSON"):
            _load_json_object_body(b"{", path="/chat")

    def test_load_json_object_body_rejects_non_object_json(self) -> None:
        with self.assertRaisesRegex(ValueError, "models request must be a JSON object"):
            _load_json_object_body(b"[]", path="/models")

    def test_selected_response_headers_keeps_retry_after_only(self) -> None:
        self.assertEqual(
            _selected_response_headers({"Retry-After": "7", "Server": "upstream"}, "Retry-After"),
            {"Retry-After": "7"},
        )

    def test_selected_response_headers_returns_none_when_missing(self) -> None:
        self.assertIsNone(_selected_response_headers({}, "Retry-After"))

    def test_cli_parser_supports_version_flag(self) -> None:
        parser = build_parser()

        with self.assertRaises(SystemExit) as ctx:
            parser.parse_args(["--version"])

        self.assertEqual(ctx.exception.code, 0)

    def test_cli_settings_apply_common_overrides(self) -> None:
        parser = build_parser()
        args = parser.parse_args(
            [
                "--host",
                "0.0.0.0",
                "--port",
                "9000",
                "--upstream-base-url",
                "http://localhost:8100/",
                "--upstream-api-key",
                "sk-test",
                "--model",
                "demo-model",
                "--title",
                "Demo Title",
            ]
        )

        settings = settings_from_args(args, environ={})

        self.assertEqual(settings.host, "0.0.0.0")
        self.assertEqual(settings.port, 9000)
        self.assertEqual(settings.upstream_base_url, "http://localhost:8100")
        self.assertEqual(settings.upstream_api_key, "sk-test")
        self.assertEqual(settings.model, "demo-model")
        self.assertEqual(settings.title, "Demo Title")

    def test_cli_main_delegates_to_run_server(self) -> None:
        with patch("llm_speed_chat.__main__.run_server", return_value=0) as run_server_mock:
            exit_code = cli_main(
                [
                    "--upstream-base-url",
                    "http://127.0.0.1:8000",
                    "--model",
                    "demo-model",
                ]
            )

        self.assertEqual(exit_code, 0)
        passed_settings = run_server_mock.call_args.args[0]
        self.assertEqual(passed_settings.upstream_base_url, "http://127.0.0.1:8000")
        self.assertEqual(passed_settings.model, "demo-model")

    def test_cli_main_prints_version(self) -> None:
        with self.assertRaises(SystemExit) as ctx:
            cli_main(["--version"])

        self.assertEqual(ctx.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
