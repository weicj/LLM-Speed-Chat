from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import llm_speed_chat


ROOT = Path(__file__).resolve().parents[1]
CI_YML = ROOT / ".github" / "workflows" / "ci.yml"
PYPROJECT = ROOT / "pyproject.toml"
README = ROOT / "README.md"
RELEASE = ROOT / "RELEASE.md"
CHANGELOG = ROOT / "CHANGELOG.md"
MANIFEST = ROOT / "MANIFEST.in"
ENV_EXAMPLE = ROOT / ".env.example"
SMOKE_SCRIPT = ROOT / "scripts" / "smoke-installed.py"
SMOKE_HTTP = ROOT / "scripts" / "smoke_http.py"
CHECK_RELEASE = ROOT / "scripts" / "check-release.sh"
AUDIT_RELEASE_METADATA = ROOT / "scripts" / "audit-release-metadata.py"
DOCKERFILE = ROOT / "Dockerfile"
COMPOSE = ROOT / "compose.yaml"
DOCKERIGNORE = ROOT / ".dockerignore"
PACKAGE_JSON = ROOT / "package.json"
PLAYWRIGHT_CONFIG = ROOT / "playwright.config.js"
E2E_SPEC = ROOT / "e2e" / "chat.spec.js"
MOCK_UPSTREAM = ROOT / "e2e" / "mock-upstream.js"
PACKAGE_LOCK = ROOT / "package-lock.json"
PRODUCT_SCREENSHOT = ROOT / "docs" / "screenshots" / "product-chat.png"


class ProjectMetadataTest(unittest.TestCase):
    def test_readme_includes_the_product_interface_screenshot(self) -> None:
        readme = README.read_text(encoding="utf-8")

        self.assertTrue(PRODUCT_SCREENSHOT.is_file())
        self.assertIn(
            "![LLM Speed Chat product interface](docs/screenshots/product-chat.png)",
            readme,
        )

    def test_ci_runs_multi_version_tests_and_wheel_smoke(self) -> None:
        source = CI_YML.read_text(encoding="utf-8")

        self.assertIn('"3.10"', source)
        self.assertIn('"3.13"', source)
        self.assertIn("python -m unittest discover -s tests -v", source)
        self.assertIn("python -m build", source)
        self.assertIn("python -m twine check dist/*", source)
        self.assertIn("scripts/smoke-installed.py", source)
        self.assertIn("scripts/smoke_http.py --base-url http://127.0.0.1:18080 --wait-seconds 30", source)
        self.assertIn("actions/setup-node@v4", source)
        self.assertIn("npx playwright install --with-deps chromium", source)
        self.assertIn("npm run test:e2e", source)
        self.assertIn("llm-speed-chat-playwright-artifacts", source)
        self.assertIn("docker build -t llm-speed-chat:test .", source)
        self.assertIn("docker run -d --rm --name llm-speed-chat-smoke", source)
        self.assertIn("python scripts/audit-release-metadata.py", source)
        self.assertNotIn("/healthz", source)
        self.assertIn("actions/upload-artifact@v4", source)

    def test_smoke_script_checks_packaged_static_assets(self) -> None:
        source = SMOKE_SCRIPT.read_text(encoding="utf-8")
        smoke_http = SMOKE_HTTP.read_text(encoding="utf-8")
        audit_release = AUDIT_RELEASE_METADATA.read_text(encoding="utf-8")

        self.assertIn("assert_core_http_surface", source)
        self.assertIn("LLM Speed Chat Smoke", source)
        self.assertIn('"--version"', source)
        self.assertIn("console entrypoint did not return a version string", source)
        self.assertIn('"--help"', source)
        self.assertIn("console entrypoint did not return help output", source)
        self.assertIn("Run the local single-user LLM chat benchmark server.", source)
        self.assertIn("--upstream-api-key", source)
        self.assertIn('"/config"', smoke_http)
        self.assertIn('"/static/app.js"', smoke_http)
        self.assertIn("Content-Security-Policy", smoke_http)
        self.assertIn("AbortController", smoke_http)
        self.assertIn("--wait-seconds", smoke_http)

        check_release = CHECK_RELEASE.read_text(encoding="utf-8")
        manifest = MANIFEST.read_text(encoding="utf-8")
        self.assertIn("python3 -m unittest discover -s tests -v", check_release)
        self.assertIn("npm ci", check_release)
        self.assertIn("npx playwright install --with-deps chromium", check_release)
        self.assertIn("npm run test:e2e", check_release)
        self.assertIn("ROOT_OWNER", check_release)
        self.assertIn("ROOT_OWNER_USER", check_release)
        self.assertIn("ROOT_OWNER_HOME", check_release)
        self.assertIn("repair_workspace_ownership", check_release)
        self.assertIn("run_as_workspace_owner", check_release)
        self.assertIn('chown -R "$ROOT_OWNER" "$ROOT"', check_release)
        self.assertIn('run_as_workspace_owner npm ci', check_release)
        self.assertIn("npx playwright install-deps chromium", check_release)
        self.assertIn("run_as_workspace_owner npx playwright install chromium", check_release)
        self.assertIn('run_as_workspace_owner python3 -m unittest discover -s tests -v', check_release)
        self.assertIn('run_as_workspace_owner "$BUILD_VENV/bin/python" -m build', check_release)
        self.assertIn('run_as_workspace_owner python3 scripts/audit-release-metadata.py --strict', check_release)
        self.assertIn('rm -rf "$BUILD_VENV" "$WHEEL_VENV"', check_release)
        self.assertIn('run_as_workspace_owner rm -rf "$ROOT/dist" "$ROOT/build" "$ROOT/src/llm_speed_chat.egg-info"', check_release)
        self.assertIn('"$BUILD_VENV/bin/python" -m build', check_release)
        self.assertIn('"$BUILD_VENV/bin/python" -m twine check dist/*', check_release)
        self.assertIn('"$WHEEL_VENV/bin/python" "$ROOT/scripts/smoke-installed.py"', check_release)
        self.assertIn("python3 scripts/smoke_http.py --base-url http://127.0.0.1:18080 --wait-seconds 30", check_release)
        self.assertIn("python3 scripts/audit-release-metadata.py --strict", check_release)
        self.assertIn("include RELEASE.md", manifest)
        self.assertIn("include CHANGELOG.md", manifest)
        self.assertIn("include .env.example", manifest)
        self.assertIn("include Dockerfile", manifest)
        self.assertIn("include compose.yaml", manifest)
        self.assertIn("include package.json", manifest)
        self.assertIn("include package-lock.json", manifest)
        self.assertIn("include playwright.config.js", manifest)
        self.assertIn("recursive-include scripts *.py *.sh", manifest)
        self.assertIn("Missing LICENSE file", audit_release)
        self.assertIn("Add a maintainer-approved LICENSE file", audit_release)
        self.assertIn("Missing project license metadata in pyproject.toml.", audit_release)
        self.assertIn('LICENSE_TEMPLATE = """license = {file = "LICENSE"}"""', audit_release)
        self.assertIn("Add a project.license entry to pyproject.toml", audit_release)
        self.assertIn('REQUIRED_URL_KEYS = ("Homepage", "Repository", "Issues")', audit_release)
        self.assertIn('PLACEHOLDER_URL_MARKERS = ("example.com", "example.org", "TODO", "todo", "changeme", "your-org")', audit_release)
        self.assertIn("Suggested pyproject.toml snippet:", audit_release)
        self.assertIn('Homepage = "https://example.com/llm-speed-chat"', audit_release)
        self.assertIn("--strict", audit_release)

    def test_docs_and_env_example_reflect_local_benchmark_scope(self) -> None:
        readme = README.read_text(encoding="utf-8")
        env_example = ENV_EXAMPLE.read_text(encoding="utf-8")
        changelog = CHANGELOG.read_text(encoding="utf-8")

        self.assertIn("Core local benchmark settings", env_example)
        self.assertIn("Optional local benchmark tuning", env_example)
        self.assertIn("UPSTREAM_BASE_URL=http://127.0.0.1:8000", env_example)
        self.assertIn("MAX_REQUEST_BYTES=67108864", env_example)
        self.assertNotIn("UPSTREAM_TOKENIZE_TIMEOUT_S", env_example)
        self.assertNotIn("TOKENIZER_PATH", env_example)
        self.assertIn("DEFAULT_THINKING_BUDGET=0", env_example)
        self.assertNotIn("MAX_ATTACHMENTS", env_example)
        self.assertNotIn("MAX_ATTACHMENT_BYTES", env_example)
        self.assertNotIn("BASIC_AUTH_USERNAME", env_example)
        self.assertNotIn("CORS_ALLOW_ORIGIN", env_example)
        self.assertNotIn("CHAT_RATE_LIMIT_REQUESTS", env_example)

        self.assertIn("single-user chat UI", readme)
        self.assertIn("local server or a hosted API", readme)
        self.assertIn("real multi-turn chat harness", readme)
        self.assertIn("/v1/models", readme)
        self.assertIn("Detect Models", readme)
        self.assertIn("![LLM Speed Chat product interface](docs/screenshots/product-chat.png)", readme)
        self.assertIn("python3 -m pip install -e .", readme)
        self.assertIn("--upstream-base-url http://127.0.0.1:8000", readme)
        self.assertIn("llm-speed-chat", readme)
        self.assertIn("python3 -m build", readme)
        self.assertIn("RELEASE.md", readme)
        self.assertIn("CHANGELOG.md", readme)
        self.assertIn("./scripts/check-release.sh", readme)
        self.assertIn("python3 scripts/audit-release-metadata.py --strict", readme)
        self.assertIn("CI covers editable installs, built wheels, and the container image", readme)
        self.assertNotIn("Sandboxed preview", readme)
        self.assertNotIn("Attachment", readme)
        self.assertNotIn("healthz", readme.lower())
        self.assertNotIn("readyz", readme.lower())
        self.assertNotIn("Basic Auth", readme)

        release = RELEASE.read_text(encoding="utf-8")
        self.assertIn("local single-user LLM chat benchmark", release)
        self.assertIn("./scripts/check-release.sh", release)
        self.assertIn("python3 scripts/audit-release-metadata.py --strict", release)
        self.assertIn("python3 -m unittest discover -s tests -v", release)
        self.assertIn("npm run test:e2e", release)
        self.assertIn("python -m build", release)
        self.assertIn("python -m twine check dist/*", release)
        self.assertIn("scripts/smoke-installed.py", release)
        self.assertIn("scripts/smoke_http.py --base-url http://127.0.0.1:18080 --wait-seconds 30", release)
        self.assertIn("llm-speed-chat --help", release)
        self.assertIn("llm-speed-chat --version", release)
        self.assertIn("license and project URLs", release)
        self.assertIn('license = {file = "LICENSE"}', release)
        self.assertIn("[project.urls]", release)
        self.assertIn('Homepage = "https://example.com/llm-speed-chat"', release)
        self.assertIn("## 0.1.0", changelog)
        self.assertIn("text-first multi-turn chat UI", changelog)
        self.assertIn("wheel, source distribution, and container smoke coverage", changelog)

    def test_container_assets_and_docs_exist(self) -> None:
        dockerfile = DOCKERFILE.read_text(encoding="utf-8")
        compose = COMPOSE.read_text(encoding="utf-8")
        dockerignore = DOCKERIGNORE.read_text(encoding="utf-8")
        readme = README.read_text(encoding="utf-8")

        self.assertIn("FROM python:3.12-slim AS build", dockerfile)
        self.assertIn("FROM python:3.12-slim AS runtime", dockerfile)
        self.assertIn("HOST=0.0.0.0", dockerfile)
        self.assertIn("USER app", dockerfile)
        self.assertIn('CMD ["llm-speed-chat"]', dockerfile)
        self.assertNotIn("HEALTHCHECK", dockerfile)

        self.assertIn("host.docker.internal:host-gateway", compose)
        self.assertIn("HOST_PORT", compose)
        self.assertIn("UPSTREAM_BASE_URL", compose)
        self.assertNotIn("UPSTREAM_TOKENIZE_TIMEOUT_S", compose)
        self.assertNotIn("UPSTREAM_AUTH_HEADER", compose)
        self.assertNotIn("UPSTREAM_HEADERS", compose)
        self.assertNotIn("REQUEST_ID_HEADER", compose)
        self.assertNotIn("MAX_ATTACHMENTS", compose)
        self.assertNotIn("MAX_ATTACHMENT_BYTES", compose)
        self.assertNotIn("CHAT_RATE_LIMIT_REQUESTS", compose)
        self.assertNotIn("BASIC_AUTH_USERNAME", compose)

        self.assertIn(".env", dockerignore)
        self.assertIn("tests/", dockerignore)
        self.assertIn("runs/", dockerignore)

        self.assertIn("docker build -t llm-speed-chat", readme)
        self.assertIn("docker compose up --build", readme)
        self.assertIn("host.docker.internal", readme)

    def test_browser_e2e_assets_exist(self) -> None:
        package_json = PACKAGE_JSON.read_text(encoding="utf-8")
        package_lock = PACKAGE_LOCK.read_text(encoding="utf-8")
        playwright_config = PLAYWRIGHT_CONFIG.read_text(encoding="utf-8")
        e2e_spec = E2E_SPEC.read_text(encoding="utf-8")
        mock_upstream = MOCK_UPSTREAM.read_text(encoding="utf-8")
        readme = README.read_text(encoding="utf-8")

        self.assertIn('"@playwright/test"', package_json)
        self.assertIn('"test:e2e"', package_json)
        self.assertIn('"name": "llm-speed-chat-e2e"', package_lock)
        self.assertIn('"@playwright/test"', package_lock)

        self.assertIn('testDir: "./e2e"', playwright_config)
        self.assertIn('baseURL: "http://127.0.0.1:18080"', playwright_config)
        self.assertIn('["html", { open: "never" }]', playwright_config)
        self.assertIn('screenshot: "only-on-failure"', playwright_config)

        self.assertIn("loads models and streams a chat response", e2e_spec)
        self.assertIn("api url changes auto-discover models without manual refresh", e2e_spec)
        self.assertIn("model refresh surfaces upstream retry timing", e2e_spec)
        self.assertIn("multi-turn chat preserves prior context", e2e_spec)
        self.assertIn("cancel keeps partial output visible", e2e_spec)
        self.assertIn("client-side request-size guardrail", e2e_spec)
        self.assertIn("upstream chat rate limits preserve retry timing", e2e_spec)
        self.assertIn("clear resets the local benchmark session", e2e_spec)
        self.assertNotIn("basic-auth protected deployment", e2e_spec)
        self.assertNotIn("rate-limited chat errors surface retry timing in the UI", e2e_spec)
        self.assertIn("mock-upstream listening", mock_upstream)
        self.assertIn("/v1/chat/completions", mock_upstream)
        self.assertIn('"Retry-After": "11"', mock_upstream)
        self.assertIn('"Retry-After": "7"', mock_upstream)
        self.assertIn("Earlier you said:", mock_upstream)
        self.assertNotIn("attachment", mock_upstream)

        self.assertIn("npm ci", readme)
        self.assertIn("npm run test:e2e", readme)
        self.assertIn("Playwright", readme)
        self.assertIn("Chromium", readme)

    def test_package_version_matches_project_metadata(self) -> None:
        project = PYPROJECT.read_text(encoding="utf-8")

        self.assertIn(f'version = "{llm_speed_chat.__version__}"', project)
        self.assertIn('keywords = ["llm", "benchmark", "throughput", "chat", "openai-compatible"]', project)
        self.assertIn("Development Status :: 4 - Beta", project)
        self.assertIn("Topic :: System :: Benchmark", project)


if __name__ == "__main__":
    unittest.main()
