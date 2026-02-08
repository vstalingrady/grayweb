"""
AI and model utility functions.

This module provides helpers for response parsing and content extraction.
"""
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

_PDF_EXCERPT_MAX_CHARS = int(os.getenv("OPENROUTER_PDF_CACHE_MAX_CHARS", "20000"))


def _truncate_text(value: str) -> str:
    if _PDF_EXCERPT_MAX_CHARS <= 0:
        return value
    if len(value) <= _PDF_EXCERPT_MAX_CHARS:
        return value
    return value[:_PDF_EXCERPT_MAX_CHARS]


def _normalize_http_url(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if not candidate:
        return None
    if candidate.startswith("//"):
        candidate = f"https:{candidate}"
    try:
        parsed = urlparse(candidate)
    except Exception:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return candidate


def _extract_url_citation_media_url(url_citation: Dict[str, Any], annotation: Dict[str, Any]) -> Optional[str]:
    media_keys = (
        "image_url",
        "imageUrl",
        "thumbnail_url",
        "thumbnailUrl",
        "preview_image_url",
        "previewImageUrl",
        "preview_url",
        "previewUrl",
        "image",
        "thumbnail",
    )
    for key in media_keys:
        normalized = _normalize_http_url(url_citation.get(key))
        if normalized:
            return normalized
    for key in media_keys:
        normalized = _normalize_http_url(annotation.get(key))
        if normalized:
            return normalized
    return None


def _extract_file_text(file_payload: Dict[str, Any]) -> Optional[str]:
    text = file_payload.get("text")
    if isinstance(text, str) and text.strip():
        return _truncate_text(text.strip())

    content = file_payload.get("content")
    if isinstance(content, str) and content.strip():
        return _truncate_text(content.strip())

    if isinstance(content, list):
        parts: List[str] = []
        for part in content:
            if not isinstance(part, dict):
                continue
            part_text = part.get("text")
            if isinstance(part_text, str) and part_text.strip():
                parts.append(part_text.strip())
        if parts:
            return _truncate_text("\n".join(parts))

    return None


def openrouter_annotations_to_grounding(annotations: Optional[List[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
    """Convert OpenRouter annotations into GroundingMetadata-compatible payload."""
    if not annotations:
        return None

    chunks: List[Dict[str, Any]] = []
    supports: List[Dict[str, Any]] = []
    seen = set()

    def _append_support(start_index: Any, end_index: Any, chunk_index: int) -> None:
        if isinstance(start_index, int) and isinstance(end_index, int) and end_index > start_index:
            supports.append({
                "segment": {"start_index": start_index, "end_index": end_index},
                "grounding_chunk_indices": [chunk_index],
            })

    for annotation in annotations:
        if not isinstance(annotation, dict):
            continue
        ann_type = annotation.get("type")
        url_citation_raw = annotation.get("url_citation") or annotation.get("urlCitation") or {}
        url_citation = url_citation_raw if isinstance(url_citation_raw, dict) else {}
        file_citation = annotation.get("file_citation") or annotation.get("fileCitation") or annotation.get("file") or {}

        if ann_type == "url_citation" or url_citation:
            url = url_citation.get("url") or annotation.get("url")
            if not url:
                continue
            title = url_citation.get("title") or annotation.get("title") or url
            snippet = url_citation.get("content") or annotation.get("content")
            if not isinstance(snippet, str):
                snippet = None
            elif snippet.strip():
                snippet = _truncate_text(snippet.strip())
            else:
                snippet = None
            image_url = _extract_url_citation_media_url(url_citation, annotation)
            key = ("web", url, title)
            if key in seen:
                continue
            seen.add(key)
            chunk_index = len(chunks)
            web_chunk: Dict[str, Any] = {"uri": url, "title": title}
            if snippet:
                web_chunk["snippet"] = snippet
            if image_url:
                web_chunk["image_url"] = image_url
            chunks.append({"web": web_chunk})
            _append_support(
                url_citation.get("start_index")
                or url_citation.get("startIndex")
                or annotation.get("start_index")
                or annotation.get("startIndex"),
                url_citation.get("end_index")
                or url_citation.get("endIndex")
                or annotation.get("end_index")
                or annotation.get("endIndex"),
                chunk_index,
            )
            continue

        if ann_type == "file_citation" or ann_type == "file" or file_citation:
            file_payload = file_citation if isinstance(file_citation, dict) else {}
            nested_file = file_payload.get("file")
            if isinstance(nested_file, dict):
                file_payload = {**nested_file, **file_payload}

            uri = file_payload.get("url") or file_payload.get("uri")
            file_hash = file_payload.get("hash") if isinstance(file_payload.get("hash"), str) else None
            title = (
                file_payload.get("title")
                or file_payload.get("filename")
                or file_payload.get("name")
                or uri
                or file_hash
            )
            if title is not None and not isinstance(title, str):
                title = str(title)
            text = _extract_file_text(file_payload)

            if not (uri or title or text):
                continue

            key = ("file", file_hash or uri or title, text[:64] if isinstance(text, str) else None)
            if key in seen:
                continue
            seen.add(key)
            chunk_index = len(chunks)
            retrieved_context: Dict[str, Any] = {
                "title": title,
                "text": text,
                "document_name": title,
            }
            if uri:
                retrieved_context["uri"] = uri
            chunks.append({"retrieved_context": retrieved_context})
            _append_support(
                file_payload.get("start_index") or annotation.get("start_index"),
                file_payload.get("end_index") or annotation.get("end_index"),
                chunk_index,
            )

    if not chunks:
        return None

    if not supports:
        supports.append({"grounding_chunk_indices": list(range(len(chunks)))})

    return {"grounding_chunks": chunks, "grounding_supports": supports}


def merge_extra_contents(*lists) -> Optional[List]:
    """Merge multiple optional content lists into one."""
    merged = []
    for candidate in lists:
        if candidate:
            merged.extend(candidate)
    return merged or None


def validate_json_text_against_schema(raw_text: str, schema: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Validate a JSON string against a minimal subset of JSON Schema."""
    trimmed = (raw_text or "").strip()
    if not trimmed:
        return False, "Empty response"
    try:
        payload = json.loads(trimmed)
    except json.JSONDecodeError as exc:
        return False, f"Invalid JSON: {exc}"
    ok, error = validate_json_against_schema(payload, schema)
    return ok, error


def validate_json_against_schema(payload: Any, schema: Dict[str, Any], path: str = "$") -> Tuple[bool, Optional[str]]:
    """Minimal JSON Schema validator (type, required, properties, items, enum, anyOf/oneOf)."""
    if not isinstance(schema, dict):
        return True, None

    schema_type = schema.get("type")
    if schema_type:
        type_ok = _json_type_matches(payload, schema_type)
        if not type_ok:
            return False, f"{path} expected {schema_type}"

    if "enum" in schema:
        enum_values = schema.get("enum") or []
        if payload not in enum_values:
            return False, f"{path} not in enum"

    any_of = schema.get("anyOf")
    if isinstance(any_of, list) and any_of:
        for option in any_of:
            ok, _ = validate_json_against_schema(payload, option, path=path)
            if ok:
                return True, None
        return False, f"{path} failed anyOf"

    one_of = schema.get("oneOf")
    if isinstance(one_of, list) and one_of:
        matches = 0
        for option in one_of:
            ok, _ = validate_json_against_schema(payload, option, path=path)
            if ok:
                matches += 1
        if matches != 1:
            return False, f"{path} failed oneOf"

    if schema_type == "object" and isinstance(payload, dict):
        required = schema.get("required") or []
        for key in required:
            if key not in payload:
                return False, f"{path}.{key} is required"
        properties = schema.get("properties") or {}
        for key, subschema in properties.items():
            if key not in payload:
                continue
            ok, error = validate_json_against_schema(payload[key], subschema, path=f"{path}.{key}")
            if not ok:
                return False, error

    if schema_type == "array" and isinstance(payload, list):
        items_schema = schema.get("items")
        if items_schema:
            for index, item in enumerate(payload):
                ok, error = validate_json_against_schema(item, items_schema, path=f"{path}[{index}]")
                if not ok:
                    return False, error

    return True, None


def _json_type_matches(payload: Any, schema_type: str) -> bool:
    schema_type = str(schema_type).lower()
    if schema_type == "object":
        return isinstance(payload, dict)
    if schema_type == "array":
        return isinstance(payload, list)
    if schema_type == "string":
        return isinstance(payload, str)
    if schema_type == "integer":
        return isinstance(payload, int) and not isinstance(payload, bool)
    if schema_type == "number":
        return isinstance(payload, (int, float)) and not isinstance(payload, bool)
    if schema_type == "boolean":
        return isinstance(payload, bool)
    if schema_type == "null":
        return payload is None
    return True


# ==============================================================================
# Structured Response Parsing
# ==============================================================================


def materialize_structured_reminders(raw_text: str) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
    """
    Attempt to parse a structured reminder payload of the form:
    { "message": "...", "reminders": [ { ...gray.reminder... } ] }
    OR a direct gray.reminder payload (single or list).
    Returns (text, reminders) where reminders is None on failure.
    """
    trimmed = (raw_text or "").strip()
    if not trimmed:
        return raw_text, None

    try:
        payload = json.loads(trimmed)
    except json.JSONDecodeError:
        return raw_text, None

    if isinstance(payload, dict):
        # Check for { "message": "...", "reminders": [...] }
        message = payload.get("message")
        reminders = payload.get("reminders")
        if message is not None and isinstance(reminders, list):
            return str(message), reminders
        # Single reminder object
        if payload.get("type") == "gray.reminder":
            return raw_text, [payload]
        return raw_text, None

    if isinstance(payload, list):
        # List of reminder objects
        valid = all(
            isinstance(item, dict) and item.get("type") == "gray.reminder"
            for item in payload
        )
        if valid:
            return raw_text, payload

    return raw_text, None


# ==============================================================================
# Title Generation
# ==============================================================================


def clean_title(raw_title: str) -> Optional[str]:
    """Clean and normalize a generated chat title."""
    candidate = (raw_title or "").strip()
    if not candidate:
        return None
    # Remove quotes
    candidate = re.sub(r'^["\']|["\']$', "", candidate).strip()
    # Remove HTML-like tags
    candidate = re.sub(r"<[^>]+>", "", candidate).strip()
    # Remove "title:" prefix (case-insensitive)
    candidate = re.sub(r"^title\s*:\s*", "", candidate, flags=re.IGNORECASE).strip()
    # Collapse whitespace
    candidate = re.sub(r"\s+", " ", candidate).strip()
    return candidate or None


def fallback_title_from_message(message: str) -> str:
    """Generate a fallback title from the first line of a message."""
    first_line = (message or "").strip().split("\n")[0]
    if len(first_line) <= 50:
        return first_line
    return first_line[:47] + "..."
