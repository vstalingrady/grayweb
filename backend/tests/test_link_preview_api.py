from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from backend.api import link_preview as link_preview_api


def _expected_empty_payload(url: str) -> dict[str, str | None]:
    return {
        "url": url,
        "title": None,
        "description": None,
        "site_name": None,
        "image_url": None,
        "image_proxy_url": None,
    }


@pytest.mark.asyncio
async def test_get_link_preview_timeout_returns_empty_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_resolve_link_preview(url: str):
        del url
        await asyncio.sleep(0.05)
        return {"url": "https://example.com"}

    monkeypatch.setattr(link_preview_api, "LINK_PREVIEW_ROUTE_TIMEOUT_SECONDS", 0.001)
    monkeypatch.setattr(link_preview_api, "resolve_link_preview", fake_resolve_link_preview)

    payload = await link_preview_api.get_link_preview(
        url="https://example.com",
        current_user={"id": 1},
    )

    assert payload == _expected_empty_payload("https://example.com")


@pytest.mark.asyncio
async def test_get_link_preview_unexpected_exception_returns_empty_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_resolve_link_preview(url: str):
        del url
        raise RuntimeError("boom")

    monkeypatch.setattr(link_preview_api, "resolve_link_preview", fake_resolve_link_preview)

    payload = await link_preview_api.get_link_preview(
        url="https://example.com/resource",
        current_user={"id": 1},
    )

    assert payload == _expected_empty_payload("https://example.com/resource")


@pytest.mark.asyncio
async def test_get_link_preview_value_error_maps_to_bad_request(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_resolve_link_preview(url: str):
        del url
        raise ValueError("Only http/https URLs are allowed.")

    monkeypatch.setattr(link_preview_api, "resolve_link_preview", fake_resolve_link_preview)

    with pytest.raises(HTTPException) as exc_info:
        await link_preview_api.get_link_preview(
            url="ftp://example.com",
            current_user={"id": 1},
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Only http/https URLs are allowed."
