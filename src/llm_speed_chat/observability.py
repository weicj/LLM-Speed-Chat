from __future__ import annotations

import json
from datetime import datetime, timezone


def _timestamp_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def format_log_event(level: str, event: str, **fields: object) -> str:
    payload: dict[str, object] = {
        "ts": _timestamp_utc(),
        "level": level,
        "event": event,
    }
    for key, value in fields.items():
        if value is None:
            continue
        payload[key] = value
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
