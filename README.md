# LLM Speed Chat

测速页面：https://weicj.github.io/LLM-Speed-Chat/ （无需下载部署）

Online test platform: https://weicj.github.io/LLM-Speed-Chat/ (no download or deployment required)

A small single-user chat UI for measuring interactive LLM serving speed against a local server or a hosted API.

![LLM Speed Chat product interface](docs/screenshots/product-chat.png)

It is a real multi-turn chat harness, not a single-shot benchmark: stream a reply, inspect thinking separately, render Markdown and HTML, and track prompt throughput, decode speed, generated tokens, and wall time.

## Quick Start

From source:

```bash
python3 -m pip install -e .
llm-speed-chat --upstream-base-url http://127.0.0.1:8000 --model your-model-id
```

Or run directly from the repository root:

```bash
python3 server.py
```

Open `http://127.0.0.1:8080`. The same commands work for local or hosted OpenAI-compatible endpoints.

Common environment settings:

```bash
UPSTREAM_BASE_URL=http://127.0.0.1:8000
UPSTREAM_API_KEY=
MODEL=
HOST=127.0.0.1
PORT=8080
```

## Features

- Automatic model discovery from `/v1/models`, with a manual `Detect Models` fallback
- Multi-turn streaming chat with cancel, clear, retry, attachments, and Enter-to-send
- Separate five-line scrolling Thinking panel and GitHub-flavored Markdown output
- Copy/save message actions, HTML/SVG code download, and sandboxed HTML preview
- English/Chinese language switch and persistent light/dark mode
- Endpoint-neutral metrics with framework-aware exact values when the endpoint provides them

## Metrics and Frameworks

The Framework selector is auto-detected from model metadata and can be overridden with `llama.cpp`, vLLM, SGLang, ExLlama, or Universal.

- Local llama.cpp and vLLM endpoints request token IDs; llama.cpp timing fields are used for its final decode rate.
- SGLang requests continuous usage statistics; ExLlama uses its standard OpenAI-compatible usage response.
- Universal is the fallback for hosted or unrecognized APIs. Missing exact counts are marked provisional with `~` until standard usage is returned.
- Wall Time is measured in the browser from request start through stream completion, cancellation, or failure.

## Docker

```bash
docker build -t llm-speed-chat .
docker run --rm -p 8080:8080 \
  --add-host host.docker.internal:host-gateway \
  -e UPSTREAM_BASE_URL=http://host.docker.internal:8000 \
  llm-speed-chat
```

Compose is also available:

```bash
docker compose up --build
```

## Development

Run the test suites:

```bash
python3 -m unittest discover -s tests -v
npm ci
npm run test:e2e
```

The browser suite uses Playwright with Chromium.

Build and release checks:

```bash
python3 -m build
./scripts/check-release.sh
python3 scripts/audit-release-metadata.py --strict
```

Release notes and the release checklist are in `CHANGELOG.md` and `RELEASE.md`. CI covers editable installs, built wheels, and the container image.
