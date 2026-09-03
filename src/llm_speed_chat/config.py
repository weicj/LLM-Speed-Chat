from __future__ import annotations

import os
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Mapping
from urllib.parse import urlparse, urlunparse


OPENAI_BASE_SUFFIXES = (
    "/v1/chat/completions",
    "/chat/completions",
    "/v1/models",
    "/models",
    "/v1",
)


@dataclass(frozen=True)
class Settings:
    upstream_base_url: str
    upstream_api_key: str
    model: str
    host: str
    port: int
    title: str
    default_max_tokens: int
    default_temperature: float
    default_thinking_budget: int
    max_request_bytes: int
    upstream_model_timeout_s: float
    upstream_chat_timeout_s: float

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "Settings":
        env = dict(load_env_file()) if environ is None else {}
        if environ is None:
            env.update(os.environ)
        else:
            env.update(environ)
        return cls(
            upstream_base_url=normalize_upstream_base_url(
                env.get("UPSTREAM_BASE_URL", "http://127.0.0.1:8000")
            ),
            upstream_api_key=env.get("UPSTREAM_API_KEY", "").strip(),
            model=env.get("MODEL", "").strip(),
            host=env.get("HOST", "127.0.0.1"),
            port=int(env.get("PORT", "8080")),
            title=env.get("TITLE", "LLM Speed Chat"),
            default_max_tokens=int(env.get("DEFAULT_MAX_TOKENS", "512")),
            default_temperature=float(env.get("DEFAULT_TEMPERATURE", "0.2")),
            default_thinking_budget=int(env.get("DEFAULT_THINKING_BUDGET", "0")),
            max_request_bytes=int(env.get("MAX_REQUEST_BYTES", str(64 * 1024 * 1024))),
            upstream_model_timeout_s=float(env.get("UPSTREAM_MODEL_TIMEOUT_S", "20")),
            upstream_chat_timeout_s=float(env.get("UPSTREAM_CHAT_TIMEOUT_S", "3600")),
        )

    def __post_init__(self) -> None:
        if self.default_thinking_budget < 0:
            raise ValueError("DEFAULT_THINKING_BUDGET must not be negative")
        if self.max_request_bytes <= 0:
            raise ValueError("MAX_REQUEST_BYTES must be greater than 0")
        if self.upstream_model_timeout_s <= 0:
            raise ValueError("UPSTREAM_MODEL_TIMEOUT_S must be greater than 0")
        if self.upstream_chat_timeout_s <= 0:
            raise ValueError("UPSTREAM_CHAT_TIMEOUT_S must be greater than 0")

    def with_model(self, model: str) -> "Settings":
        return replace(self, model=model.strip())

    def with_upstream_base_url(self, upstream_base_url: str) -> "Settings":
        return replace(self, upstream_base_url=normalize_upstream_base_url(upstream_base_url))

    def with_upstream_api_key(self, upstream_api_key: str) -> "Settings":
        return replace(self, upstream_api_key=upstream_api_key.strip())

    def ui_config(self) -> dict[str, object]:
        return {
            "upstream_base_url": self.upstream_base_url,
            "model": self.model,
            "title": self.title,
            "port": self.port,
            "defaultMaxTokens": self.default_max_tokens,
            "defaultTemperature": self.default_temperature,
            "defaultThinkingBudget": self.default_thinking_budget,
            "maxRequestBytes": self.max_request_bytes,
        }


def load_env_file(path: str | os.PathLike[str] = ".env") -> dict[str, str]:
    env_path = Path(path)
    if not env_path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        values[key] = value.strip().strip("\"'")
    return values


def normalize_upstream_base_url(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("upstream_base_url must be an absolute http(s) URL")

    if "://" not in normalized:
        normalized = f"http://{normalized}"

    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("upstream_base_url must be an absolute http(s) URL")

    normalized_path = parsed.path.rstrip("/")
    for suffix in OPENAI_BASE_SUFFIXES:
        if normalized_path == suffix:
            normalized_path = ""
            break
        if normalized_path.endswith(suffix):
            normalized_path = normalized_path[: -len(suffix)].rstrip("/")
            break

    rebuilt = parsed._replace(
        path=normalized_path,
        params="",
        query="",
        fragment="",
    )
    return urlunparse(rebuilt).rstrip("/")
