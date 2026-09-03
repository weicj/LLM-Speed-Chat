from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_PAGES = ROOT / "scripts" / "build-pages.py"
PAGES_WORKFLOW = ROOT / ".github" / "workflows" / "pages.yml"


def load_pages_builder():
    spec = importlib.util.spec_from_file_location("build_pages", BUILD_PAGES)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load build-pages.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


build_pages = load_pages_builder()


class PagesBuildTest(unittest.TestCase):
    def test_static_site_uses_direct_transport_and_relative_assets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory) / "site"
            build_pages.build_site(output_dir)

            index_html = (output_dir / "index.html").read_text(encoding="utf-8")
            app_js = (output_dir / "static" / "app.js").read_text(encoding="utf-8")

            self.assertIn('data-transport="direct"', index_html)
            self.assertIn('href="./static/styles.css"', index_html)
            self.assertIn('src="./static/app.js"', index_html)
            self.assertNotIn('src="/static/', index_html)
            self.assertNotIn('href="/static/', index_html)
            self.assertIn("isDirectTransport", app_js)
            self.assertIn('directEndpoint("/v1/chat/completions")', app_js)

    def test_pages_workflow_builds_and_deploys_the_static_site(self) -> None:
        workflow = PAGES_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("actions/configure-pages@v5", workflow)
        self.assertIn("actions/upload-pages-artifact@v3", workflow)
        self.assertIn("actions/deploy-pages@v4", workflow)
        self.assertIn("python scripts/build-pages.py --output site", workflow)
        self.assertIn("pages: write", workflow)


if __name__ == "__main__":
    unittest.main()
