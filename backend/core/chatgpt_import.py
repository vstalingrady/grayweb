from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

MAX_FACTS = 80
MAX_TITLES = 30
MAX_SUMMARY_CHARS = 8000
MAX_MESSAGE_SCAN = 20000

IGNORED_TITLES = {
    "",
    "new chat",
    "untitled",
    "chatgpt",
    "new conversation",
}

STOP_VALUES = {
    "fine",
    "good",
    "ok",
    "okay",
    "not sure",
    "not really",
    "sorry",
    "busy",
    "tired",
    "here",
    "back",
    "all good",
}

FACT_PATTERNS: List[Tuple[str, re.Pattern[str]]] = [
    ("Name", re.compile(r"\bmy name is ([^.!?\n]{2,80})", re.I)),
    ("Role", re.compile(r"\bI am an? ([^.!?\n]{2,80})", re.I)),
    ("Role", re.compile(r"\bI'm an? ([^.!?\n]{2,80})", re.I)),
    ("Location", re.compile(r"\bI live (?:in|at) ([^.!?\n]{2,80})", re.I)),
    ("Work", re.compile(r"\bI work (?:as|at|in) ([^.!?\n]{2,80})", re.I)),
    ("Project", re.compile(r"\bI'm working on ([^.!?\n]{2,120})", re.I)),
    ("Goal", re.compile(r"\bI want to ([^.!?\n]{2,120})", re.I)),
    ("Need", re.compile(r"\bI need to ([^.!?\n]{2,120})", re.I)),
    ("Preference", re.compile(r"\bI (?:like|love|prefer) ([^.!?\n]{2,120})", re.I)),
    ("Preference", re.compile(r"\bmy favorite ([^.!?\n]{2,120})", re.I)),
    ("Company", re.compile(r"\bmy company is ([^.!?\n]{2,120})", re.I)),
]


@dataclass
class ChatGptMemorySummary:
    summary: str
    conversation_count: int
    message_count: int
    user_message_count: int
    fact_count: int
    title_count: int


def _extract_text_from_part(part: Any) -> str:
    if isinstance(part, str):
        return part.strip()
    if not isinstance(part, dict):
        return ""
    part_type = part.get("content_type")
    if part_type in {"text", "input_text"}:
        text = part.get("text")
        return text.strip() if isinstance(text, str) else ""
    text = part.get("text")
    return text.strip() if isinstance(text, str) else ""


def _extract_text_from_content(content: Dict[str, Any]) -> str:
    content_type = content.get("content_type")
    if content_type in {"text", "multimodal_text", "user_editable_context"}:
        parts = content.get("parts") or []
        text_parts = [_extract_text_from_part(part) for part in parts]
        text = "\n".join(part for part in text_parts if part)
        if text:
            return text.strip()
        fallback = content.get("text")
        return fallback.strip() if isinstance(fallback, str) else ""
    if content_type in {"code", "execution_output"}:
        text = content.get("text")
        return text.strip() if isinstance(text, str) else ""
    return ""


def _iter_conversation_messages(conversation: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    mapping = conversation.get("mapping") or {}
    for node in mapping.values():
        message = node.get("message")
        if not message:
            continue
        if message.get("metadata", {}).get("is_visually_hidden_from_conversation"):
            continue
        yield message


def _normalize_fact_value(value: str) -> Optional[str]:
    normalized = re.sub(r"\s+", " ", value or "").strip().strip("\"'`")
    normalized = normalized.strip(" .,!?:;")
    if not normalized:
        return None
    lowered = normalized.lower()
    if lowered in STOP_VALUES:
        return None
    if lowered.startswith("not "):
        return None
    if len(normalized) > 160:
        return None
    return normalized


def _extract_facts_from_text(text: str) -> List[str]:
    results: List[str] = []
    if not text:
        return results
    for label, pattern in FACT_PATTERNS:
        for match in pattern.finditer(text):
            value = _normalize_fact_value(match.group(1))
            if not value:
                continue
            results.append(f"{label}: {value}")
            if len(results) >= 3:
                return results
    return results


def _collect_titles(conversations: List[Dict[str, Any]]) -> List[str]:
    titles_with_time: List[Tuple[float, str]] = []
    for convo in conversations:
        title = str(convo.get("title") or "").strip()
        if not title:
            continue
        if title.strip().lower() in IGNORED_TITLES:
            continue
        update_time = convo.get("update_time")
        try:
            timestamp = float(update_time) if update_time is not None else 0.0
        except (TypeError, ValueError):
            timestamp = 0.0
        titles_with_time.append((timestamp, title))
    titles_with_time.sort(key=lambda item: item[0], reverse=True)
    titles = []
    seen = set()
    for _, title in titles_with_time:
        normalized = title.strip()
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        titles.append(normalized)
        if len(titles) >= MAX_TITLES:
            break
    return titles


def _build_summary(
    *,
    conversation_count: int,
    message_count: int,
    user_message_count: int,
    facts: List[str],
    titles: List[str],
) -> str:
    timestamp = datetime.utcnow().strftime("%Y-%m-%d")
    lines = [
        f"ChatGPT memory import ({timestamp}).",
        f"Conversations: {conversation_count}. Messages scanned: {message_count} (user: {user_message_count}).",
    ]
    if facts:
        lines.append("Extracted features from your messages:")
        for fact in facts[:MAX_FACTS]:
            lines.append(f"- {fact}")
    if titles:
        lines.append("Recent topics:")
        for title in titles[:MAX_TITLES]:
            lines.append(f"- {title}")
    summary = "\n".join(lines).strip()
    if len(summary) > MAX_SUMMARY_CHARS:
        summary = summary[:MAX_SUMMARY_CHARS].rstrip() + "..."
    return summary


def extract_chatgpt_memory_from_zip(file_obj) -> ChatGptMemorySummary:
    file_obj.seek(0)
    try:
        with zipfile.ZipFile(file_obj) as archive:
            try:
                with archive.open("conversations.json") as handle:
                    conversations = json.load(handle)
            except KeyError as exc:
                raise ValueError("Missing conversations.json in the export zip.") from exc
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid zip file.") from exc
    except json.JSONDecodeError as exc:
        raise ValueError("Failed to parse conversations.json.") from exc

    if not isinstance(conversations, list):
        raise ValueError("Unexpected conversations.json format.")

    conversation_count = len(conversations)
    message_count = 0
    user_message_count = 0
    facts: List[str] = []
    seen_facts = set()
    processed_messages = 0

    for conversation in conversations:
        for message in _iter_conversation_messages(conversation):
            if processed_messages >= MAX_MESSAGE_SCAN or len(facts) >= MAX_FACTS:
                break
            processed_messages += 1
            role = message.get("author", {}).get("role")
            if role not in {"user", "assistant"}:
                continue
            content = message.get("content") or {}
            text = _extract_text_from_content(content)
            if not text:
                continue
            message_count += 1
            if role == "user":
                user_message_count += 1
                extracted = _extract_facts_from_text(text)
                for fact in extracted:
                    key = fact.lower()
                    if key in seen_facts:
                        continue
                    seen_facts.add(key)
                    facts.append(fact)
                    if len(facts) >= MAX_FACTS:
                        break
        if processed_messages >= MAX_MESSAGE_SCAN or len(facts) >= MAX_FACTS:
            break

    titles = _collect_titles(conversations)
    summary = _build_summary(
        conversation_count=conversation_count,
        message_count=message_count,
        user_message_count=user_message_count,
        facts=facts,
        titles=titles,
    )

    return ChatGptMemorySummary(
        summary=summary,
        conversation_count=conversation_count,
        message_count=message_count,
        user_message_count=user_message_count,
        fact_count=len(facts),
        title_count=len(titles),
    )
