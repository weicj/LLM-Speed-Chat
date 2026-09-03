#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
import urllib.request


def _get(base_url: str, path: str) -> tuple[int, bytes, dict[str, str]]:
    request = urllib.request.Request(base_url.rstrip("/") + path, method="GET")
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, response.read(), dict(response.headers.items())


def assert_core_http_surface(base_url: str, *, expected_title: str) -> None:
    config_status, config_body, _ = _get(base_url, "/config")
    config = json.loads(config_body.decode("utf-8"))
    assert config_status == 200, config_status
    assert config["title"] == expected_title, config

    root_status, root_body, headers = _get(base_url, "/")
    root = root_body.decode("utf-8")
    assert root_status == 200, root_status
    assert 'id="title"' in root, root[:200]
    assert "/static/app.js" in root, root[:200]
    assert headers["Content-Security-Policy"], headers

    static_status, static_body, static_headers = _get(base_url, "/static/app.js")
    assert static_status == 200, static_status
    assert b"AbortController" in static_body, "frontend asset missing expected runtime code"
    assert static_headers["Content-Type"].startswith("application/javascript"), static_headers


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Smoke-check the supported HTTP surface of llm-speed-chat.",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--title", default="LLM Speed Chat")
    parser.add_argument("--wait-seconds", type=float, default=0.0)
    args = parser.parse_args()

    deadline = time.time() + max(args.wait_seconds, 0.0)
    last_error: Exception | None = None

    while True:
        try:
            assert_core_http_surface(args.base_url, expected_title=args.title)
            break
        except Exception as err:  # noqa: BLE001
            last_error = err
            if time.time() >= deadline:
                raise SystemExit(f"http smoke failed: {err}") from err
            time.sleep(1)

    if last_error is not None and args.wait_seconds > 0:
        print(f"HTTP surface became ready after retrying: {args.base_url}")
    print(f"HTTP smoke passed for {args.base_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
