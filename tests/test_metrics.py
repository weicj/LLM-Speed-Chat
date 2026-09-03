from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from llm_speed_chat.metrics import StreamMetricsTracker


class StreamMetricsTrackerTest(unittest.TestCase):
    def test_final_metrics_forward_standard_usage_only(self) -> None:
        tracker = StreamMetricsTracker()
        tracker.record_event({"choices": [{"delta": {"content": "abc"}}]})
        tracker.record_event(
            {
                "usage": {"prompt_tokens": 20, "completion_tokens": 3},
                "timings": {"prompt_per_second": 999.0, "predicted_per_second": 888.0},
            }
        )
        metrics = tracker.final_metrics()

        self.assertEqual(metrics["completion_tokens"], 3)
        self.assertEqual(metrics["prompt_tokens"], 20)
        self.assertNotIn("prompt_tok_s", metrics)
        self.assertNotIn("decode_tok_s", metrics)

    def test_final_metrics_do_not_estimate_tokens_without_usage(self) -> None:
        tracker = StreamMetricsTracker()
        tracker.record_event({"choices": [{"delta": {"content": "hi"}, "token_ids": [1, 2]}]})
        metrics = tracker.final_metrics()

        self.assertTrue(tracker.saw_content)
        self.assertIsNone(metrics["prompt_tokens"])
        self.assertIsNone(metrics["completion_tokens"])


if __name__ == "__main__":
    unittest.main()
