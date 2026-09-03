#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PYPROJECT = ROOT / "pyproject.toml"
LICENSE = ROOT / "LICENSE"
REQUIRED_URL_KEYS = ("Homepage", "Repository", "Issues")
PLACEHOLDER_URL_MARKERS = ("example.com", "example.org", "TODO", "todo", "changeme", "your-org")
URL_TEMPLATE = """[project.urls]
Homepage = "https://example.com/llm-speed-chat"
Repository = "https://example.com/llm-speed-chat.git"
Issues = "https://example.com/llm-speed-chat/issues"
"""
LICENSE_TEMPLATE = """license = {file = "LICENSE"}"""


def load_project_metadata(pyproject_path: Path = PYPROJECT) -> dict[str, object]:
    data = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    project = data.get("project")
    if not isinstance(project, dict):
        raise SystemExit("pyproject.toml is missing a [project] table")
    return project


def audit_metadata(
    pyproject_path: Path = PYPROJECT,
    license_path: Path = LICENSE,
) -> list[str]:
    project = load_project_metadata(pyproject_path)
    issues: list[str] = []

    if not license_path.exists():
        issues.append("Missing LICENSE file at repository root.")

    license_value = project.get("license")
    if isinstance(license_value, str):
        if not license_value.strip():
            issues.append("Missing project license metadata in pyproject.toml.")
    elif isinstance(license_value, dict):
        if not any(
            isinstance(license_value.get(key), str) and license_value.get(key, "").strip()
            for key in ("file", "text")
        ):
            issues.append("Missing project license metadata in pyproject.toml.")
    else:
        issues.append("Missing project license metadata in pyproject.toml.")

    urls = project.get("urls")
    if not isinstance(urls, dict):
        issues.append("Missing [project.urls] table in pyproject.toml.")
        return issues

    for key in REQUIRED_URL_KEYS:
        value = urls.get(key)
        if not isinstance(value, str) or not value.strip():
            issues.append(f"Missing project URL: {key}.")
            continue
        normalized = value.strip()
        if any(marker in normalized for marker in PLACEHOLDER_URL_MARKERS):
            issues.append(f"Project URL for {key} still uses a placeholder value: {normalized!r}.")

    return issues


def remediation_hints(issues: list[str]) -> list[str]:
    hints: list[str] = []
    if any("LICENSE" in issue for issue in issues):
        hints.append(
            "Add a maintainer-approved LICENSE file at the repository root so source and wheel artifacts ship with an explicit license."
        )
    if any("project license metadata" in issue for issue in issues):
        hints.append('Add a project.license entry to pyproject.toml, for example:')
        hints.extend(LICENSE_TEMPLATE.splitlines())
    if any("project URL" in issue or "[project.urls]" in issue for issue in issues):
        hints.append("Add a [project.urls] table to pyproject.toml with Homepage, Repository, and Issues entries.")
        hints.append("Suggested pyproject.toml snippet:")
        hints.extend(URL_TEMPLATE.splitlines())
    return hints


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit release metadata that still requires maintainer confirmation.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero when release metadata is incomplete.",
    )
    args = parser.parse_args()

    issues = audit_metadata()
    if not issues:
        print("release metadata audit passed")
        return 0

    print("release metadata audit found blockers:")
    for issue in issues:
        print(f"- {issue}")
    hints = remediation_hints(issues)
    if hints:
        print()
        for hint in hints:
            print(hint)

    return 1 if args.strict else 0


if __name__ == "__main__":
    raise SystemExit(main())
