# Release Checklist

This project is intentionally a local single-user LLM chat benchmark. Release work should harden that core shape, not expand it into a shared service.

## Before Tagging

Fast path:

```bash
./scripts/check-release.sh
```

Metadata-only audit:

```bash
python3 scripts/audit-release-metadata.py --strict
```

Current maintainer-owned blockers before a public release:

1. Add the final `LICENSE` file at the repository root.
2. Add `license = {file = "LICENSE"}` under `[project]` in `pyproject.toml`.
3. Add `[project.urls]` to `pyproject.toml` with `Homepage`, `Repository`, and `Issues`.

Starter snippet:

```toml
license = {file = "LICENSE"}

[project.urls]
Homepage = "https://example.com/llm-speed-chat"
Repository = "https://example.com/llm-speed-chat.git"
Issues = "https://example.com/llm-speed-chat/issues"
```

1. Confirm the user-facing scope still matches the README:
   - local, single-user
   - OpenAI-compatible upstream
   - multi-turn chat benchmark
   - core throughput metrics only
2. Update `CHANGELOG.md` for the release.
3. Run the Python test suite:

```bash
python3 -m unittest discover -s tests -v
```

4. Run the browser E2E suite:

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

## Build Artifacts

Use an isolated virtual environment when preparing release artifacts:

```bash
python3 -m venv /tmp/llm-speed-chat-build
. /tmp/llm-speed-chat-build/bin/activate
python -m pip install --upgrade pip build twine
python -m build
python -m twine check dist/*
```

Smoke the built wheel from outside the repository:

```bash
python -m venv /tmp/llm-speed-chat-wheel
. /tmp/llm-speed-chat-wheel/bin/activate
python -m pip install --upgrade pip
python -m pip install dist/*.whl
cd /tmp
python /path/to/repo/scripts/smoke-installed.py
```

## Container Smoke

Build and smoke the container image:

```bash
docker build -t llm-speed-chat:test .
docker run -d --rm --name llm-speed-chat-smoke -p 18080:8080 llm-speed-chat:test
python3 scripts/smoke_http.py --base-url http://127.0.0.1:18080 --wait-seconds 30
docker stop llm-speed-chat-smoke
```

## Public Release Notes

Before a public registry release, verify these non-code release items explicitly:

1. Version number and release notes are final.
2. The chosen license and project URLs are confirmed by the maintainer.
3. README installation commands match the artifact you are publishing.
4. The installed `llm-speed-chat --help` and `llm-speed-chat --version` output still match the documented CLI.
