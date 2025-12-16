"""
AI and model utility functions.

This module provides helpers for AI model routing, response parsing,
and content extraction from Gemini API responses.
"""
import json
import re
from typing import Any, Dict, List, Optional, Tuple


# ==============================================================================
# Model Routing
# ==============================================================================


def prefers_gemini_model(normalized_model: str) -> bool:
    """
    Determine if the requested model should route to Gemini.

    The frontend passes tier labels like "lite" and "pro" that we map to concrete
    Gemini models inside GeminiService. Treat those as Gemini hints so we don't
    accidentally send them to OpenRouter.
    """
    if not normalized_model:
        return False
    if normalized_model.startswith("models/") or normalized_model.startswith("gemini"):
        return True
    return normalized_model in {"pro", "gray-pro"}


# ==============================================================================
# Response Text Extraction
# ==============================================================================


def candidate_text(candidate: Any) -> str:
    """Join all non-thought text parts from a Gemini candidate.
    
    Excludes parts with thought=True so they can be handled separately
    by candidate_thought and displayed in the thinking UI.
    """
    content = getattr(candidate, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return ""
    # Exclude thought parts - they're handled separately for the thinking UI
    return "".join(
        getattr(part, "text", "")
        for part in parts
        if getattr(part, "text", None) and not getattr(part, "thought", False)
    )


def candidate_thought(candidate: Any) -> Optional[str]:
    """Extract thinking/thought content from a Gemini candidate when reasoning mode is used.
    
    Per Gemini API docs: parts with thought=True contain the thought summary text.
    The 'thought' attribute is a boolean flag, and the actual text is in 'text'.
    """
    content = getattr(candidate, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return None
    thoughts = []
    for part in parts:
        # Check for 'thought' boolean attribute (Gemini thinking mode)
        # When thought=True, the text in this part is the thought summary
        is_thought = getattr(part, "thought", False)
        text = getattr(part, "text", None)
        if is_thought and text:
            thoughts.append(str(text))

    return "\n".join(thoughts) if thoughts else None


def candidate_grounding_payload(candidate: Any) -> Optional[Dict[str, Any]]:
    """
    Normalize grounding information from a Gemini candidate into a JSON-serializable dict.

    Prefer the official grounding_metadata field when present, but fall back to
    citation_metadata so the UI can still render a Sources panel even when the
    Search tool only returns citations.
    """
    grounding: Optional[Dict[str, Any]] = None

    # Preferred: explicit grounding_metadata from the model.
    candidate_grounding = getattr(candidate, "grounding_metadata", None)
    if candidate_grounding is not None:
        try:
            grounding = candidate_grounding.model_dump(exclude_none=True)
        except Exception:
            grounding = None

    # Fallback: synthesize grounding chunks/supports from citation_metadata.
    citation_metadata = getattr(candidate, "citation_metadata", None)
    citations = getattr(citation_metadata, "citations", None)
    if citations:
        chunks: List[Dict[str, Any]] = []
        supports: List[Dict[str, Any]] = []
        for index, citation in enumerate(citations):
            uri = getattr(citation, "uri", None)
            title = getattr(citation, "title", None)
            start_index = getattr(citation, "start_index", None)
            end_index = getattr(citation, "end_index", None)
            if not uri:
                continue
            chunks.append({
                "web": {
                    "uri": uri,
                    "title": title or uri,
                }
            })
            if (
                isinstance(start_index, int)
                and isinstance(end_index, int)
                and end_index > start_index
            ):
                supports.append({
                    "segment": {
                        "start_index": start_index,
                        "end_index": end_index,
                    },
                    "grounding_chunk_indices": [index],
                })

        if chunks:
            synthesized = {"grounding_chunks": chunks}
            if supports:
                synthesized["grounding_supports"] = supports

            if grounding:
                # Merge, giving precedence to explicit grounding metadata.
                merged = dict(grounding)
                merged.setdefault("grounding_chunks", []).extend(
                    synthesized.get("grounding_chunks", [])
                )
                if "grounding_supports" in synthesized:
                    merged.setdefault("grounding_supports", []).extend(
                        synthesized.get("grounding_supports", [])
                    )
                grounding = merged
            else:
                grounding = synthesized

    return grounding


def merge_extra_contents(*lists) -> Optional[List]:
    """Merge multiple optional content lists into one."""
    merged = []
    for candidate in lists:
        if candidate:
            merged.extend(candidate)
    return merged or None


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
