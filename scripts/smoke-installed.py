#!/usr/bin/env python3
from __future__ import annotations

import sys
import threading
import time
from http.server import ThreadingHTTPServer
from pathlib import Path
from shutil import which
from socket import socket
from subprocess import DEVNULL, Popen
from subprocess import run


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from llm_speed_chat.app import create_handler
from llm_speed_chat.config import Settings
from smoke_http import assert_core_http_surface


def _find_free_port() -> int:
    with socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _smoke_console_entrypoint() -> bool:
    executable_path = Path(sys.executable).parent / "llm-speed-chat"
    executable = str(executable_path)
    if not executable_path.exists():
        fallback = which("llm-speed-chat")
        executable = fallback or ""
    if not executable:
        return False

    version_result = run(
        [executable, "--version"],
        capture_output=True,
        text=True,
        check=False,
    )
    if version_result.returncode != 0 or "llm-speed-chat" not in version_result.stdout:
        raise RuntimeError("console entrypoint did not return a version string")

    help_result = run(
        [executable, "--help"],
        capture_output=True,
        text=True,
        check=False,
    )
    if help_result.returncode != 0:
        raise RuntimeError("console entrypoint did not return help output")
    help_text = help_result.stdout
    for expected in (
        "Run the local single-user LLM chat benchmark server.",
        "--upstream-base-url",
        "--upstream-api-key",
        "--model",
        "--title",
    ):
        if expected not in help_text:
            raise RuntimeError(f"console entrypoint help output missing expected text: {expected}")

    port = _find_free_port()
    process = Popen(
        [executable],
        stdout=DEVNULL,
        stderr=DEVNULL,
        env={
            **dict(__import__("os").environ),
            "UPSTREAM_BASE_URL": "http://127.0.0.1:9",
            "HOST": "127.0.0.1",
            "PORT": str(port),
            "TITLE": "LLM Speed Chat Smoke",
        },
    )
    try:
        deadline = time.time() + 15
        last_error = None
        while time.time() < deadline:
            try:
                assert_core_http_surface(
                    f"http://127.0.0.1:{port}",
                    expected_title="LLM Speed Chat Smoke",
                )
                return True
            except Exception as err:  # noqa: BLE001
                last_error = err
                time.sleep(0.5)
        raise RuntimeError(f"console entrypoint smoke failed: {last_error}")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except Exception:  # noqa: BLE001
            process.kill()
            process.wait(timeout=5)


def main() -> int:
    if _smoke_console_entrypoint():
        print("installed package smoke test passed via console entrypoint")
        return 0

    settings = Settings.from_env(
        {
            "UPSTREAM_BASE_URL": "http://127.0.0.1:9",
            "HOST": "127.0.0.1",
            "PORT": "0",
            "TITLE": "LLM Speed Chat Smoke",
        }
    )
    handler = create_handler(settings)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        assert_core_http_surface(base_url, expected_title="LLM Speed Chat Smoke")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    print("installed package smoke test passed via in-process fallback")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
