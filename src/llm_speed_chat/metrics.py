from __future__ import annotations

class StreamMetricsTracker:
    def __init__(self) -> None:
        self.saw_content = False
        self.usage: dict[str, object] | None = None

    def record_event(self, payload: dict[str, object]) -> None:
        usage = payload.get("usage")
        if isinstance(usage, dict):
            self.usage = usage

        choices = payload.get("choices") or []
        if not isinstance(choices, list) or not choices:
            return

        choice = choices[0]
        if not isinstance(choice, dict):
            return

        delta = choice.get("delta") or {}
        if not isinstance(delta, dict):
            delta = {}
        piece = delta.get("content") or delta.get("reasoning_content") or ""
        if piece:
            self.saw_content = True

    def final_metrics(self) -> dict[str, object]:
        usage = self.usage or {}
        return {
            "final": True,
            "prompt_tokens": _usage_token_count(usage.get("prompt_tokens")),
            "completion_tokens": _usage_token_count(usage.get("completion_tokens")),
        }


def _usage_token_count(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return None
    return value
