"""Utilities for resolving link preview metadata and proxying preview images."""

from __future__ import annotations

import asyncio
import html
import ipaddress
import re
import socket
from typing import Any, Dict, Iterable, Optional, Set
from urllib.parse import quote, urljoin, urlparse

import httpx

from backend.core.cache import TTLCache

MAX_PREVIEW_HTML_CHARS = 700_000
LINK_PREVIEW_TIMEOUT_SECONDS = 4.0
LINK_PREVIEW_DNS_TIMEOUT_SECONDS = 1.5
LINK_PREVIEW_MAX_IMAGE_BYTES = 5 * 1024 * 1024
LINK_PREVIEW_CACHE = TTLCache(ttl_seconds=60 * 30, max_size=2048)

_META_TAG_PATTERN = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
_LINK_TAG_PATTERN = re.compile(r"<link\b[^>]*>", re.IGNORECASE)
_TITLE_PATTERN = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_ATTR_PATTERN = re.compile(
    r"([:@A-Za-z0-9_\-]+)\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^>\s\"'=]+))",
    re.IGNORECASE,
)
_URL_SCHEME_PATTERN = re.compile(r"^[a-z][a-z0-9+.-]*://", re.IGNORECASE)
_URL_SCHEME_PREFIX_PATTERN = re.compile(r"^[a-z][a-z0-9+.-]*:", re.IGNORECASE)


def _collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _truncate_text(value: str, *, max_length: int = 700) -> str:
    if len(value) <= max_length:
        return value
    return f"{value[: max(0, max_length - 1)].rstrip()}…"


def normalize_preview_target_url(raw_url: str) -> str:
    candidate = (raw_url or "").strip()
    if not candidate:
        raise ValueError("URL is required.")
    if _URL_SCHEME_PREFIX_PATTERN.match(candidate) and not _URL_SCHEME_PATTERN.match(candidate):
        raise ValueError("Only http/https URLs are allowed.")
    if candidate.startswith("//"):
        candidate = f"https:{candidate}"
    if not _URL_SCHEME_PATTERN.match(candidate):
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http/https URLs are allowed.")
    if not parsed.hostname:
        raise ValueError("Invalid URL.")
    return parsed.geturl()


def _is_ip_literal(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
        return True
    except ValueError:
        return False


def _is_private_or_local_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _is_disallowed_hostname(hostname: str) -> bool:
    normalized = hostname.strip().lower().strip("[]")
    if not normalized:
        return True
    if normalized == "localhost" or normalized.endswith(".localhost"):
        return True
    if normalized.endswith(".local") or normalized.endswith(".internal"):
        return True
    if _is_ip_literal(normalized):
        return _is_private_or_local_ip(normalized)
    return False


async def _validate_public_dns(hostname: str) -> None:
    loop = asyncio.get_running_loop()
    try:
        infos = await asyncio.wait_for(
            loop.getaddrinfo(hostname, None, type=socket.SOCK_STREAM),
            timeout=LINK_PREVIEW_DNS_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise ValueError("Unable to resolve host.") from exc
    except socket.gaierror as exc:
        raise ValueError("Unable to resolve host.") from exc

    resolved_hosts: Set[str] = set()
    for info in infos:
        sockaddr = info[4]
        if not sockaddr:
            continue
        ip = sockaddr[0]
        if not ip:
            continue
        resolved_hosts.add(ip)

    if not resolved_hosts:
        raise ValueError("Unable to resolve host.")

    for resolved in resolved_hosts:
        if _is_private_or_local_ip(resolved):
            raise ValueError("Host is not allowed.")


def _parse_attributes(tag: str) -> Dict[str, str]:
    attributes: Dict[str, str] = {}
    for match in _ATTR_PATTERN.finditer(tag):
        key = (match.group(1) or "").strip().lower()
        if not key:
            continue
        value = match.group(2) or match.group(3) or match.group(4) or ""
        attributes[key] = html.unescape(value.strip())
    return attributes


def _extract_meta_entries(document: str) -> Dict[str, str]:
    entries: Dict[str, str] = {}
    for match in _META_TAG_PATTERN.finditer(document):
        attributes = _parse_attributes(match.group(0))
        content = _collapse_whitespace(attributes.get("content", ""))
        if not content:
            continue
        for key_name in ("property", "name", "itemprop"):
            key_value = _collapse_whitespace(attributes.get(key_name, "").lower())
            if not key_value:
                continue
            entries[f"{key_name}:{key_value}"] = content
    return entries


def _extract_link_entries(document: str) -> Dict[str, str]:
    entries: Dict[str, str] = {}
    for match in _LINK_TAG_PATTERN.finditer(document):
        attributes = _parse_attributes(match.group(0))
        rel = _collapse_whitespace(attributes.get("rel", "").lower())
        href = _collapse_whitespace(attributes.get("href", ""))
        if not rel or not href:
            continue
        for token in rel.split():
            if token:
                entries[token] = href
    return entries


def _first_present(entries: Dict[str, str], keys: Iterable[str]) -> Optional[str]:
    for key in keys:
        value = entries.get(key)
        if value:
            return value
    return None


def _normalize_preview_image_url(candidate: Optional[str], *, base_url: str) -> Optional[str]:
    if not candidate:
        return None
    try:
        resolved = urljoin(base_url, candidate)
        parsed = urlparse(resolved)
    except Exception:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None
    if not parsed.hostname:
        return None
    if _is_disallowed_hostname(parsed.hostname):
        return None
    return parsed.geturl()


def _extract_preview_title(document: str, meta_entries: Dict[str, str]) -> Optional[str]:
    title = _first_present(
        meta_entries,
        (
            "property:og:title",
            "name:twitter:title",
            "property:twitter:title",
        ),
    )
    if title:
        return _truncate_text(_collapse_whitespace(title), max_length=260)

    match = _TITLE_PATTERN.search(document)
    if not match:
        return None
    value = _collapse_whitespace(html.unescape(match.group(1)))
    return _truncate_text(value, max_length=260) if value else None


def _extract_preview_description(meta_entries: Dict[str, str]) -> Optional[str]:
    value = _first_present(
        meta_entries,
        (
            "property:og:description",
            "name:description",
            "name:twitter:description",
            "property:twitter:description",
        ),
    )
    if not value:
        return None
    cleaned = _collapse_whitespace(value)
    return _truncate_text(cleaned, max_length=360) if cleaned else None


def extract_preview_metadata(document: str, *, base_url: str) -> Dict[str, Optional[str]]:
    html_slice = document[:MAX_PREVIEW_HTML_CHARS]
    meta_entries = _extract_meta_entries(html_slice)
    link_entries = _extract_link_entries(html_slice)

    image_candidate = _first_present(
        meta_entries,
        (
            "property:og:image:secure_url",
            "property:og:image:url",
            "property:og:image",
            "name:twitter:image",
            "name:twitter:image:src",
            "property:twitter:image",
            "itemprop:image",
            "name:thumbnail",
        ),
    )
    if not image_candidate:
        image_candidate = link_entries.get("image_src")

    image_url = _normalize_preview_image_url(image_candidate, base_url=base_url)
    title = _extract_preview_title(html_slice, meta_entries)
    description = _extract_preview_description(meta_entries)
    site_name = _first_present(meta_entries, ("property:og:site_name",))
    if site_name:
        site_name = _truncate_text(_collapse_whitespace(site_name), max_length=160)

    return {
        "title": title,
        "description": description,
        "site_name": site_name,
        "image_url": image_url,
    }


def build_image_proxy_path(image_url: str) -> str:
    return f"/api/link-preview/image?url={quote(image_url, safe='')}"


async def resolve_link_preview(url: str) -> Dict[str, Optional[str]]:
    normalized_url = normalize_preview_target_url(url)
    parsed = urlparse(normalized_url)
    hostname = parsed.hostname or ""
    if _is_disallowed_hostname(hostname):
        raise ValueError("Host is not allowed.")
    await _validate_public_dns(hostname)

    cached = LINK_PREVIEW_CACHE.get(normalized_url)
    if isinstance(cached, dict):
        return cached

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=LINK_PREVIEW_TIMEOUT_SECONDS,
        headers={
            "User-Agent": "GrayLinkPreview/1.0 (+https://gray.alignment.id)",
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
    ) as client:
        response = await client.get(normalized_url)

    response.raise_for_status()
    final_url = str(response.url)
    final_hostname = urlparse(final_url).hostname or ""
    if _is_disallowed_hostname(final_hostname):
        raise ValueError("Host is not allowed.")
    await _validate_public_dns(final_hostname)
    content_type = (response.headers.get("content-type") or "").lower()

    # If the target itself is a direct image URL, use it as-is.
    if content_type.startswith("image/"):
        payload: Dict[str, Optional[str]] = {
            "url": final_url,
            "title": None,
            "description": None,
            "site_name": None,
            "image_url": final_url,
            "image_proxy_url": build_image_proxy_path(final_url),
        }
        LINK_PREVIEW_CACHE.set(normalized_url, payload)
        return payload

    document = response.text or ""
    metadata = extract_preview_metadata(document, base_url=final_url)
    image_url = metadata.get("image_url")
    payload = {
        "url": final_url,
        "title": metadata.get("title"),
        "description": metadata.get("description"),
        "site_name": metadata.get("site_name"),
        "image_url": image_url,
        "image_proxy_url": build_image_proxy_path(image_url) if image_url else None,
    }
    LINK_PREVIEW_CACHE.set(normalized_url, payload)
    return payload


async def fetch_preview_image_bytes(url: str) -> tuple[bytes, str]:
    normalized_url = normalize_preview_target_url(url)
    parsed = urlparse(normalized_url)
    hostname = parsed.hostname or ""
    if _is_disallowed_hostname(hostname):
        raise ValueError("Host is not allowed.")
    await _validate_public_dns(hostname)

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=LINK_PREVIEW_TIMEOUT_SECONDS,
        headers={
            "User-Agent": "GrayLinkPreview/1.0 (+https://gray.alignment.id)",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    ) as client:
        response = await client.get(normalized_url)

    response.raise_for_status()
    final_url = str(response.url)
    final_hostname = urlparse(final_url).hostname or ""
    if _is_disallowed_hostname(final_hostname):
        raise ValueError("Host is not allowed.")
    await _validate_public_dns(final_hostname)
    content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
    if not content_type.startswith("image/"):
        raise ValueError("URL did not return an image.")

    body = response.content or b""
    if not body:
        raise ValueError("Image response was empty.")
    if len(body) > LINK_PREVIEW_MAX_IMAGE_BYTES:
        raise ValueError("Image is too large.")

    return body, content_type
