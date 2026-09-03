from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT_RELEASE_METADATA = ROOT / "scripts" / "audit-release-metadata.py"


def load_audit_module():
    spec = importlib.util.spec_from_file_location(
        "audit_release_metadata",
        AUDIT_RELEASE_METADATA,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load audit-release-metadata.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


audit_release_metadata = load_audit_module()


class ReleaseMetadataAuditTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.pyproject = self.root / "pyproject.toml"
        self.license = self.root / "LICENSE"

    def write_pyproject(self, extra: str = "") -> None:
        self.pyproject.write_text(
            (
                "[project]\n"
                'name = "llm-speed-chat"\n'
                'version = "0.1.0"\n'
                f"{extra}"
            ),
            encoding="utf-8",
        )

    def test_audit_metadata_reports_missing_license_and_urls(self) -> None:
        self.write_pyproject()

        issues = audit_release_metadata.audit_metadata(self.pyproject, self.license)

        self.assertEqual(
            issues,
            [
                "Missing LICENSE file at repository root.",
                "Missing project license metadata in pyproject.toml.",
                "Missing [project.urls] table in pyproject.toml.",
            ],
        )

    def test_audit_metadata_rejects_placeholder_project_urls(self) -> None:
        self.write_pyproject(
            'license = {file = "LICENSE"}\n'
            "\n[project.urls]\n"
            'Homepage = "https://example.com/llm-speed-chat"\n'
            'Repository = "https://example.com/llm-speed-chat.git"\n'
            'Issues = "https://example.com/llm-speed-chat/issues"\n'
        )
        self.license.write_text("MIT placeholder\n", encoding="utf-8")

        issues = audit_release_metadata.audit_metadata(self.pyproject, self.license)

        self.assertEqual(len(issues), 3)
        self.assertIn("Project URL for Homepage still uses a placeholder value", issues[0])
        self.assertIn("Project URL for Repository still uses a placeholder value", issues[1])
        self.assertIn("Project URL for Issues still uses a placeholder value", issues[2])

    def test_audit_metadata_passes_with_license_and_real_urls(self) -> None:
        self.write_pyproject(
            'license = {file = "LICENSE"}\n'
            "\n[project.urls]\n"
            'Homepage = "https://github.com/acme/llm-speed-chat"\n'
            'Repository = "https://github.com/acme/llm-speed-chat.git"\n'
            'Issues = "https://github.com/acme/llm-speed-chat/issues"\n'
        )
        self.license.write_text("MIT License\n", encoding="utf-8")

        issues = audit_release_metadata.audit_metadata(self.pyproject, self.license)

        self.assertEqual(issues, [])

    def test_audit_metadata_accepts_string_license_metadata(self) -> None:
        self.write_pyproject(
            'license = "MIT"\n'
            "\n[project.urls]\n"
            'Homepage = "https://github.com/acme/llm-speed-chat"\n'
            'Repository = "https://github.com/acme/llm-speed-chat.git"\n'
            'Issues = "https://github.com/acme/llm-speed-chat/issues"\n'
        )
        self.license.write_text("MIT License\n", encoding="utf-8")

        issues = audit_release_metadata.audit_metadata(self.pyproject, self.license)

        self.assertEqual(issues, [])


if __name__ == "__main__":
    unittest.main()
