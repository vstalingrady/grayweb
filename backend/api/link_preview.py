"""Link preview API routes."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
import httpx

from backend.auth import get_current_user
from backend.core.link_preview import fetch_preview_image_bytes, resolve_link_preview
from backend.logging_config import create_logger

router = APIRouter(tags=["link-preview"])
api_logger = create_logger("backend.api.link_preview")
LINK_PREVIEW_ROUTE_TIMEOUT_SECONDS = 5.0


def _build_empty_preview_payload(url: str) -> Dict[str, Optional[str]]:
    return {
        "url": url,
        "title": None,
        "description": None,
        "site_name": None,
        "image_url": None,
        "image_proxy_url": None,
    }


@router.get("/api/link-preview")
async def get_link_preview(
    url: str = Query(..., min_length=1, max_length=2048),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    del current_user
    try:
        return await asyncio.wait_for(
            resolve_link_preview(url),
            timeout=LINK_PREVIEW_ROUTE_TIMEOUT_SECONDS,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except asyncio.TimeoutError:
        api_logger.info(
            "Link preview request timed out",
            extra={
                "event_type": "link_preview_timeout",
                "url": url,
                "timeout_seconds": LINK_PREVIEW_ROUTE_TIMEOUT_SECONDS,
            },
        )
        return _build_empty_preview_payload(url)
    except httpx.HTTPStatusError as exc:
        api_logger.info(
            "Link preview upstream request returned non-success status",
            extra={
                "event_type": "link_preview_upstream_status_error",
                "url": url,
                "status_code": exc.response.status_code if exc.response else None,
            },
        )
        return _build_empty_preview_payload(url)
    except httpx.HTTPError as exc:
        api_logger.info(
            "Link preview upstream request failed",
            extra={
                "event_type": "link_preview_upstream_request_failed",
                "url": url,
                "error": str(exc),
            },
        )
        return _build_empty_preview_payload(url)
    except Exception as exc:
        api_logger.warning(
            "Link preview resolution failed",
            extra={
                "event_type": "link_preview_resolution_failed",
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
        )
        return _build_empty_preview_payload(url)


@router.get("/api/link-preview/image")
async def get_link_preview_image(
    url: str = Query(..., min_length=1, max_length=2048),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    del current_user
    try:
        content, media_type = await fetch_preview_image_bytes(url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        upstream_code = exc.response.status_code if exc.response is not None else status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=upstream_code, detail="Failed to load preview image.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to load preview image.") from exc
    except Exception as exc:
        api_logger.warning(
            "Link preview image proxy failed",
            extra={"event_type": "link_preview_image_proxy_failed", "error": str(exc)},
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load preview image.") from exc

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )
