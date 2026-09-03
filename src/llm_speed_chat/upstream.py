from __future__ import annotations

import urllib.request

from .config import Settings


AUTHORIZATION_HEADER = "Authorization"


def _header_name_eq(left: str, right: str) -> bool:
    return left.lower() == right.lower()


def _set_header(headers: dict[str, str], name: str, value: str) -> None:
    for existing_name in list(headers):
        if _header_name_eq(existing_name, name) and existing_name != name:
            headers.pop(existing_name)
            break
    headers[name] = value


def _has_header(headers: dict[str, str], name: str) -> bool:
    return any(_header_name_eq(existing_name, name) for existing_name in headers)


def _merge_headers(*mappings: dict[str, str]) -> dict[str, str]:
    merged: dict[str, str] = {}
    for mapping in mappings:
        for name, value in mapping.items():
            _set_header(merged, name, value)
    return merged


def build_request(
    settings: Settings,
    path: str,
    *,
    body: bytes | None = None,
    method: str = "GET",
    headers: dict[str, str] | None = None,
) -> urllib.request.Request:
    request_headers = _merge_headers(dict(headers or {}))
    if settings.upstream_api_key and not _has_header(request_headers, AUTHORIZATION_HEADER):
        _set_header(request_headers, AUTHORIZATION_HEADER, f"Bearer {settings.upstream_api_key}")
    if body is not None and not _has_header(request_headers, "Content-Type"):
        _set_header(request_headers, "Content-Type", "application/json")
    return urllib.request.Request(
        settings.upstream_base_url + path,
        data=body,
        headers=request_headers,
        method=method,
    )


def fetch_upstream_models(
    settings: Settings,
    *,
    headers: dict[str, str] | None = None,
) -> list[dict[str, object]] | None:
    try:
        request = build_request(
            settings,
            "/v1/models",
            method="GET",
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        with urllib.request.urlopen(request, timeout=settings.upstream_model_timeout_s) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    models = payload.get("data") or []
    if not isinstance(models, list):
        return None
    return [item for item in models if isinstance(item, dict)]
