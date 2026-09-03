from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from llm_speed_chat.observability import format_log_event


class ObservabilityTest(unittest.TestCase):
    def test_format_log_event_emits_json_payload(self) -> None:
        payload = json.loads(format_log_event("info", "demo", path="/chat", status=200))

        self.assertEqual(payload["level"], "info")
        self.assertEqual(payload["event"], "demo")
        self.assertEqual(payload["path"], "/chat")
        self.assertEqual(payload["status"], 200)
        self.assertIn("ts", payload)


if __name__ == "__main__":
    unittest.main()
