from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from llm_speed_chat.config import (
    Settings,
    load_env_file,
    normalize_upstream_base_url,
)


class SettingsTest(unittest.TestCase):
    def test_from_env_uses_defaults_and_trims_url(self) -> None:
        settings = Settings.from_env(
            {
                "UPSTREAM_BASE_URL": "http://127.0.0.1:9000/",
            }
        )

        self.assertEqual(settings.upstream_base_url, "http://127.0.0.1:9000")
        self.assertEqual(settings.model, "")
        self.assertEqual(settings.port, 8080)
        self.assertEqual(settings.default_max_tokens, 512)
        self.assertEqual(settings.default_thinking_budget, 0)
        self.assertEqual(settings.host, "127.0.0.1")
        self.assertEqual(settings.max_request_bytes, 64 * 1024 * 1024)
        self.assertEqual(settings.upstream_model_timeout_s, 20.0)
        self.assertEqual(settings.upstream_chat_timeout_s, 3600.0)

    def test_ui_config_contains_frontend_defaults(self) -> None:
        settings = Settings.from_env({})
        ui_config = settings.ui_config()

        self.assertIn("defaultMaxTokens", ui_config)
        self.assertIn("defaultTemperature", ui_config)
        self.assertIn("maxRequestBytes", ui_config)
        self.assertIn("defaultThinkingBudget", ui_config)
        self.assertNotIn("maxAttachments", ui_config)
        self.assertNotIn("maxAttachmentBytes", ui_config)
        self.assertNotIn("requestIdHeader", ui_config)

    def test_with_model_returns_updated_copy(self) -> None:
        settings = Settings.from_env({})

        updated = settings.with_model("demo-model")

        self.assertEqual(updated.model, "demo-model")
        self.assertEqual(settings.model, "")

    def test_load_env_file_parses_simple_key_values(self) -> None:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        env_path = Path(temp_dir.name) / "sample.env"
        env_path.write_text("MODEL=test-model\nPORT=9001\n# comment\n", encoding="utf-8")

        loaded = load_env_file(env_path)

        self.assertEqual(loaded["MODEL"], "test-model")
        self.assertEqual(loaded["PORT"], "9001")

    def test_with_upstream_base_url_normalizes_value(self) -> None:
        settings = Settings.from_env({})

        updated = settings.with_upstream_base_url(" localhost:9000/v1/models ")

        self.assertEqual(updated.upstream_base_url, "http://localhost:9000")

    def test_normalize_upstream_base_url_preserves_non_openai_prefix_path(self) -> None:
        self.assertEqual(
            normalize_upstream_base_url("http://localhost:9000/proxy/openai/v1/chat/completions"),
            "http://localhost:9000/proxy/openai",
        )

    def test_from_env_parses_runtime_tuning(self) -> None:
        settings = Settings.from_env(
            {
                "MAX_REQUEST_BYTES": "45678",
                "UPSTREAM_MODEL_TIMEOUT_S": "7",
                "UPSTREAM_CHAT_TIMEOUT_S": "8",
            }
        )

        self.assertEqual(settings.max_request_bytes, 45678)
        self.assertEqual(settings.upstream_model_timeout_s, 7.0)
        self.assertEqual(settings.upstream_chat_timeout_s, 8.0)

    def test_thinking_budget_must_not_be_negative(self) -> None:
        with self.assertRaises(ValueError):
            Settings.from_env({"DEFAULT_THINKING_BUDGET": "-1"})

    def test_normalize_upstream_base_url_rejects_relative_values(self) -> None:
        with self.assertRaises(ValueError):
            normalize_upstream_base_url("/v1")

    def test_max_request_bytes_must_be_positive(self) -> None:
        with self.assertRaises(ValueError):
            Settings.from_env({"MAX_REQUEST_BYTES": "0"})

    def test_model_timeout_must_be_positive(self) -> None:
        with self.assertRaises(ValueError):
            Settings.from_env({"UPSTREAM_MODEL_TIMEOUT_S": "0"})

    def test_chat_timeout_must_be_positive(self) -> None:
        with self.assertRaises(ValueError):
            Settings.from_env({"UPSTREAM_CHAT_TIMEOUT_S": "0"})


if __name__ == "__main__":
    unittest.main()
