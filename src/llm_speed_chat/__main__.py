from __future__ import annotations

import argparse
import os
from collections.abc import Sequence

from . import __version__
from .app import run_server
from .config import Settings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="llm-speed-chat",
        description="Run the local single-user LLM chat benchmark server.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--host", help="Bind host override.")
    parser.add_argument("--port", type=int, help="Bind port override.")
    parser.add_argument("--upstream-base-url", help="OpenAI-compatible upstream base URL.")
    parser.add_argument("--upstream-api-key", help="Upstream API key override.")
    parser.add_argument("--model", help="Default model override.")
    parser.add_argument("--title", help="UI title override.")
    return parser


def settings_from_args(
    args: argparse.Namespace,
    *,
    environ: dict[str, str] | None = None,
) -> Settings:
    merged = dict(os.environ if environ is None else environ)
    if args.host:
        merged["HOST"] = args.host
    if args.port is not None:
        merged["PORT"] = str(args.port)
    if args.upstream_base_url:
        merged["UPSTREAM_BASE_URL"] = args.upstream_base_url
    if args.upstream_api_key is not None:
        merged["UPSTREAM_API_KEY"] = args.upstream_api_key
    if args.model:
        merged["MODEL"] = args.model
    if args.title:
        merged["TITLE"] = args.title
    return Settings.from_env(merged)


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    return run_server(settings_from_args(args))


if __name__ == "__main__":
    raise SystemExit(main())
