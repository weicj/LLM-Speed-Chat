#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC_SOURCE = ROOT / "src" / "llm_speed_chat" / "static"


def build_site(output_dir: Path) -> None:
    output_dir = output_dir.resolve()
    if output_dir == ROOT:
        raise ValueError("the Pages output directory must not be the repository root")

    if output_dir.exists():
        shutil.rmtree(output_dir)
    shutil.copytree(STATIC_SOURCE, output_dir / "static")

    index_html = (STATIC_SOURCE / "index.html").read_text(encoding="utf-8")
    index_html = index_html.replace(
        'data-transport="proxy"',
        'data-transport="direct"',
        1,
    )
    index_html = index_html.replace('href="/static/', 'href="./static/')
    index_html = index_html.replace('src="/static/', 'src="./static/')
    (output_dir / "index.html").write_text(index_html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the static GitHub Pages site.")
    parser.add_argument("--output", default="site", help="output directory relative to the repository root")
    args = parser.parse_args()
    output_dir = (ROOT / args.output).resolve()
    build_site(output_dir)
    print(f"built Pages site: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
