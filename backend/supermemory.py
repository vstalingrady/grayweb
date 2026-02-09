"""Supermemory integration for long-term memory."""
from __future__ import annotations

import base64
import hashlib
import hmac
import math
import time
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.logging_config import create_logger
from backend.tier_utils import normalize_plan_tier


_INTEGRITY_VERSION = 1
_INTEGRITY_SECRET = "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a"

_CONTROL_CHAR_PATTERNS = (
    re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]"),
    re.compile(r"\uFEFF"),
    re.compile(r"[\uFFF0-\uFFFF]"),
)
_SUPERMEMORY_CONTEXT_RE = re.compile(
    r"<supermemory-context>[\s\S]*?</supermemory-context>\s*",
    re.IGNORECASE,
)
_METADATA_KEY_RE = re.compile(r"^[\w.-]+$")
_ATOMIC_SENTENCE_SPLIT_RE = re.compile(r"[.!?\n;]+")
_ATOMIC_LIST_PREFIX_RE = re.compile(r"^\s*(?:[-*]\s+|\d+[.)]\s+)")
_ATOMIC_SPACE_RE = re.compile(r"\s+")
_ATOMIC_FIRST_PERSON_RE = re.compile(
    r"\b(i|i am|i'm|i have|i've|i will|i'll|my|me|mine|we|our)\b",
    re.IGNORECASE,
)
_ATOMIC_PREFERENCE_RE = re.compile(
    r"\b(i (?:prefer|like|love|hate|dislike|enjoy|want)|my favorite|i am into|i'm into)\b",
    re.IGNORECASE,
)
_ATOMIC_DECISION_RE = re.compile(
    r"\b(i (?:decided|choose|chose|picked|pick|will|am going to|going with)|i'll|we will|we're going to|let's)\b",
    re.IGNORECASE,
)
_ATOMIC_FACT_RE = re.compile(
    r"\b(i am|i'm|i have|i've|i use|i work|i live|my [a-z0-9_ ]{1,32} is|my [a-z0-9_ ]{1,32} are)\b",
    re.IGNORECASE,
)
_ATOMIC_NON_MEMORY_PREFIX_RE = re.compile(
    r"^(can|could|would|please|help|tell|show|what|why|how|when|where)\b",
    re.IGNORECASE,
)

MEMORY_CATEGORIES = ("preference", "fact", "decision", "entity", "other")


def detect_memory_category(text: str) -> str:
    if not text:
        return "other"
    lower = text.lower()
    if re.search(r"prefer|like|love|hate|want", lower):
        return "preference"
    if re.search(r"decided|will use|going with", lower):
        return "decision"
    if re.search(r"\+\d{10,}|@[\w.-]+\.\w+|is called", lower):
        return "entity"
    if re.search(r"\bis\b|\bare\b|\bhas\b|\bhave\b", lower):
        return "fact"
    return "other"


def build_document_id(session_key: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", session_key or "")
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    return f"session_{sanitized}" if sanitized else "session"


@dataclass(frozen=True)
class SupermemoryPolicy:
    enabled: bool
    auto_recall: bool
    auto_capture: bool
    max_recall_results: int
    profile_frequency: int
    min_query_chars: int
    threshold: Optional[float] = None


@dataclass(frozen=True)
class SupermemoryOverrides:
    auto_recall: Optional[bool] = None
    auto_capture: Optional[bool] = None
    capture_mode: Optional[str] = None
    max_recall_results: Optional[int] = None
    profile_frequency: Optional[int] = None


def parse_supermemory_overrides(
    *,
    auto_recall: Optional[bool] = None,
    auto_capture: Optional[bool] = None,
    capture_mode: Optional[str] = None,
    max_recall_results: Optional[int] = None,
    profile_frequency: Optional[int] = None,
) -> Optional[SupermemoryOverrides]:
    if (
        auto_recall is None
        and auto_capture is None
        and capture_mode is None
        and max_recall_results is None
        and profile_frequency is None
    ):
        return None

    normalized_capture = capture_mode if capture_mode in {"all", "everything"} else None
    normalized_max = None
    if isinstance(max_recall_results, int):
        normalized_max = max(1, min(max_recall_results, 20))
    normalized_frequency = None
    if isinstance(profile_frequency, int):
        normalized_frequency = max(1, min(profile_frequency, 500))

    return SupermemoryOverrides(
        auto_recall=auto_recall,
        auto_capture=auto_capture,
        capture_mode=normalized_capture,
        max_recall_results=normalized_max,
        profile_frequency=normalized_frequency,
    )


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


def supermemory_force_enabled() -> bool:
    # Force mode is an explicit ops override and should remain opt-in.
    # Defaulting to False ensures the user's memory toggle is respected.
    return _bool_env("GRAY_SUPERMEMORY_FORCE", False)


def supermemory_force_plan_tier(plan_tier: Optional[str]) -> Optional[str]:
    return "pioneer" if supermemory_force_enabled() else plan_tier


def supermemory_force_overrides(
    overrides: Optional["SupermemoryOverrides"],
) -> "SupermemoryOverrides":
    if overrides is None:
        return SupermemoryOverrides(auto_recall=True, auto_capture=True)
    return SupermemoryOverrides(
        auto_recall=True,
        auto_capture=True,
        capture_mode=overrides.capture_mode,
        max_recall_results=overrides.max_recall_results,
        profile_frequency=overrides.profile_frequency,
    )


def _trim(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _validate_api_key(api_key: Optional[str]) -> Optional[str]:
    if not api_key:
        return "key is empty"
    if not api_key.startswith("sm_"):
        return "key must start with sm_ prefix"
    if len(api_key) < 20:
        return "key is too short"
    if re.search(r"\s", api_key):
        return "key contains whitespace"
    return None


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _request_integrity_headers(api_key: str, container_tag: str) -> Dict[str, str]:
    content_hash = _sha256_hex(container_tag)
    signature_payload = f"{_sha256_hex(api_key)}:{content_hash}:{_INTEGRITY_VERSION}"
    signature = _base64url(hmac.new(_INTEGRITY_SECRET.encode("utf-8"), signature_payload.encode("utf-8"), hashlib.sha256).digest())
    return {
        "X-Content-Hash": content_hash,
        "X-Request-Integrity": f"v{_INTEGRITY_VERSION}.{signature}",
    }


def sanitize_content(text: str, *, max_len: int = 100_000) -> str:
    if not text or not isinstance(text, str):
        return ""
    cleaned = text
    for pattern in _CONTROL_CHAR_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
    return cleaned


def sanitize_metadata(
    metadata: Optional[Dict[str, Any]],
    *,
    max_items: int = 50,
    key_max: int = 128,
    value_max: int = 1024,
) -> Optional[Dict[str, Any]]:
    if not metadata or not isinstance(metadata, dict):
        return None
    sanitized: Dict[str, Any] = {}
    for key, value in metadata.items():
        if len(sanitized) >= max_items:
            break
        if not isinstance(key, str) or not key:
            continue
        if len(key) > key_max or not _METADATA_KEY_RE.match(key):
            continue
        if isinstance(value, str):
            sanitized[key] = value[:value_max]
        elif isinstance(value, bool):
            sanitized[key] = value
        elif isinstance(value, (int, float)) and math.isfinite(value):
            sanitized[key] = value
    return sanitized or None


def _normalize_tag(value: str, *, max_len: int = 100) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", value)
    cleaned = re.sub(r"_+", "_", cleaned)
    cleaned = cleaned.strip("_-")
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
        cleaned = cleaned.strip("_-")
    return cleaned or "gray"


def build_container_tag(user_id: int, *, prefix: str) -> str:
    base = f"{prefix}{user_id}"
    return _normalize_tag(base, max_len=100)


def _ensure_str_list(values: Any) -> List[str]:
    if not values:
        return []
    if isinstance(values, list):
        return [str(v).strip() for v in values if isinstance(v, str) and v.strip()]
    return []


def _normalize_search_results(results: Any) -> List[Dict[str, Any]]:
    if not isinstance(results, list):
        return []
    normalized: List[Dict[str, Any]] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        memory = item.get("memory")
        if not isinstance(memory, str) or not memory.strip():
            continue
        memory_id = item.get("id") or item.get("memoryId") or item.get("documentId")
        payload: Dict[str, Any] = {
            "memory": memory.strip(),
            "similarity": item.get("similarity"),
            "updatedAt": item.get("updatedAt"),
        }
        if isinstance(memory_id, str) and memory_id.strip():
            payload["id"] = memory_id.strip()
        normalized.append(payload)
    return normalized


def _normalize_atomic_memory_text(text: str, *, max_len: int = 240) -> str:
    if not text:
        return ""
    cleaned = _ATOMIC_LIST_PREFIX_RE.sub("", text.strip())
    cleaned = _ATOMIC_SPACE_RE.sub(" ", cleaned)
    cleaned = cleaned.strip(" \"'`")
    cleaned = cleaned.strip()
    cleaned = cleaned.rstrip(".,;:")
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip(" ,;:-")
    return cleaned


def _classify_atomic_user_memory(text: str) -> Optional[str]:
    if not text or len(text) < 8:
        return None
    lower = text.lower()
    if lower.endswith("?"):
        return None
    if _ATOMIC_NON_MEMORY_PREFIX_RE.match(lower):
        return None
    if "as an ai" in lower:
        return None
    if not _ATOMIC_FIRST_PERSON_RE.search(lower):
        return None
    if _ATOMIC_PREFERENCE_RE.search(lower):
        return "preference"
    if _ATOMIC_DECISION_RE.search(lower):
        return "decision"
    if _ATOMIC_FACT_RE.search(lower):
        return "fact"
    detected = detect_memory_category(text)
    if detected in {"preference", "fact", "decision", "entity"}:
        return detected
    return None


def _extract_atomic_user_memories(user_text: str, *, max_items: int = 6) -> List[Tuple[str, str]]:
    if not user_text:
        return []
    cleaned = sanitize_content(
        _SUPERMEMORY_CONTEXT_RE.sub("", user_text),
        max_len=10_000,
    )
    if not cleaned:
        return []
    memories: List[Tuple[str, str]] = []
    seen = set()
    for part in _ATOMIC_SENTENCE_SPLIT_RE.split(cleaned):
        normalized = _normalize_atomic_memory_text(part)
        if not normalized:
            continue
        category = _classify_atomic_user_memory(normalized)
        if not category:
            continue
        dedup_key = normalized.lower()
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        memories.append((normalized, category))
        if len(memories) >= max_items:
            break
    return memories


def _build_capture_metadata(
    *,
    user_id: int,
    conversation_id: Optional[str],
    timestamp: str,
    source: str,
    category: Optional[str] = None,
) -> Dict[str, str]:
    metadata: Dict[str, str] = {
        "source": source,
        "timestamp": timestamp,
        "user_id": str(user_id),
    }
    if conversation_id:
        metadata["conversation_id"] = str(conversation_id)
    if category:
        metadata["category"] = category
        metadata["type"] = category
    return metadata


def _normalize_for_capture_id(text: str) -> str:
    if not text:
        return ""
    return _ATOMIC_SPACE_RE.sub(" ", text.strip().lower())


def _build_atomic_capture_custom_id(
    *,
    user_id: int,
    category: str,
    content: str,
) -> str:
    fingerprint = _sha256_hex(
        f"{user_id}|{category}|{_normalize_for_capture_id(content)}"
    )
    return f"gray_atomic_{fingerprint[:32]}"


def _build_turn_capture_custom_id(
    *,
    user_id: int,
    conversation_id: Optional[str],
    content: str,
) -> str:
    conversation_key = (conversation_id or "").strip() or "none"
    fingerprint = _sha256_hex(
        f"{user_id}|{conversation_key}|{_normalize_for_capture_id(content)}"
    )
    return f"gray_turn_{fingerprint[:32]}"


def _select_forget_target(
    *,
    query: str,
    results: List[Dict[str, Any]],
    min_similarity: float,
) -> Optional[Dict[str, Any]]:
    cleaned_query = (query or "").strip().lower()
    if cleaned_query:
        for item in results:
            memory = item.get("memory")
            if isinstance(memory, str) and memory.strip().lower() == cleaned_query:
                return item

    if len(results) == 1:
        candidate = results[0]
        similarity = candidate.get("similarity")
        if not isinstance(similarity, (int, float)) or float(similarity) >= min_similarity:
            return candidate

    best: Optional[Dict[str, Any]] = None
    best_similarity = float("-inf")
    for item in results:
        similarity = item.get("similarity")
        if not isinstance(similarity, (int, float)):
            continue
        score = float(similarity)
        if score < min_similarity:
            continue
        if score > best_similarity:
            best_similarity = score
            best = item
    return best


def _format_relative_time(iso_timestamp: str) -> str:
    try:
        parsed = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = now - parsed
        seconds = delta.total_seconds()
        minutes = seconds / 60
        hours = seconds / 3600
        days = seconds / 86400
        if minutes < 30:
            return "just now"
        if minutes < 60:
            return f"{int(minutes)}mins ago"
        if hours < 24:
            return f"{int(hours)} hrs ago"
        if days < 7:
            return f"{int(days)}d ago"
        month = parsed.strftime("%b")
        if parsed.year == now.year:
            return f"{parsed.day} {month}"
        return f"{parsed.day} {month}, {parsed.year}"
    except Exception:
        return ""


def _deduplicate_memories(
    static_facts: List[str],
    dynamic_facts: List[str],
    search_results: List[Dict[str, Any]],
) -> Tuple[List[str], List[str], List[Dict[str, Any]]]:
    seen = set()
    unique_static: List[str] = []
    unique_dynamic: List[str] = []
    unique_search: List[Dict[str, Any]] = []

    for fact in static_facts:
        if fact in seen:
            continue
        seen.add(fact)
        unique_static.append(fact)

    for fact in dynamic_facts:
        if fact in seen:
            continue
        seen.add(fact)
        unique_dynamic.append(fact)

    for result in search_results:
        memory = result.get("memory") or ""
        if not memory or memory in seen:
            continue
        seen.add(memory)
        unique_search.append(result)

    return unique_static, unique_dynamic, unique_search


def format_supermemory_context(
    *,
    static_facts: List[str],
    dynamic_facts: List[str],
    search_results: List[Dict[str, Any]],
    max_results: int,
) -> Optional[str]:
    if max_results <= 0:
        return None
    dedup_static, dedup_dynamic, dedup_search = _deduplicate_memories(
        static_facts, dynamic_facts, search_results
    )
    statics = dedup_static[:max_results]
    dynamics = dedup_dynamic[:max_results]
    search = dedup_search[:max_results]

    if not statics and not dynamics and not search:
        return None

    sections: List[str] = []
    if statics:
        sections.append("## User Profile (Persistent)\n" + "\n".join(f"- {s}" for s in statics))
    if dynamics:
        sections.append("## Recent Context\n" + "\n".join(f"- {d}" for d in dynamics))
    if search:
        lines: List[str] = []
        for result in search:
            memory = result.get("memory") or ""
            time_str = ""
            if isinstance(result.get("updatedAt"), str):
                time_str = _format_relative_time(result["updatedAt"]) or ""
            similarity = result.get("similarity")
            pct = ""
            if isinstance(similarity, (int, float)):
                pct = f"[{round(similarity * 100)}%]"
            prefix = f"[{time_str}]" if time_str else ""
            line = f"- {prefix}{memory} {pct}".strip()
            lines.append(line)
        sections.append("## Relevant Memories (with relevance %)\n" + "\n".join(lines))

    intro = (
        "The following is recalled context about the user. "
        "Reference it only when relevant to the conversation."
    )
    disclaimer = (
        "Use these memories naturally when relevant, but do not force them "
        "into every response or make assumptions beyond what is stated."
    )

    joined_sections = "\n\n".join(sections)
    return (
        "<supermemory-context>\n"
        f"{intro}\n\n{joined_sections}\n\n{disclaimer}\n"
        "</supermemory-context>"
    )


class SupermemoryService:
    def __init__(self) -> None:
        self._api_key = _trim(os.getenv("SUPERMEMORY_API_KEY"))
        self._enabled = _bool_env("SUPERMEMORY_ENABLED", True)
        self._auto_recall = _bool_env("SUPERMEMORY_AUTO_RECALL", True)
        self._auto_capture = _bool_env("SUPERMEMORY_AUTO_CAPTURE", True)
        self._max_recall_results = _int_env("SUPERMEMORY_MAX_RECALL_RESULTS", 10)
        self._profile_frequency = _int_env("SUPERMEMORY_PROFILE_FREQUENCY", 50)
        self._min_query_chars = _int_env("SUPERMEMORY_MIN_QUERY_CHARS", 5)
        self._capture_mode = (os.getenv("SUPERMEMORY_CAPTURE_MODE") or "all").strip().lower()
        self._base_url = (os.getenv("SUPERMEMORY_BASE_URL") or "https://api.supermemory.ai").rstrip("/")
        self._timeout = _float_env("SUPERMEMORY_TIMEOUT_SECONDS", 10.0)
        self._container_prefix = (os.getenv("SUPERMEMORY_CONTAINER_PREFIX") or "gray_user_").strip()
        self._debug = _bool_env("SUPERMEMORY_DEBUG", False)
        self._client: Optional[httpx.AsyncClient] = None
        self._logger = create_logger("backend.supermemory")
        self._tier_thresholds = {
            "scout": 0.9,
            "pathfinder": 0.85,
            "voyager": 0.75,
            "pioneer": 0.65,
        }
        api_key_issue = _validate_api_key(self._api_key)
        if api_key_issue and self._api_key:
            self._logger.warning("Supermemory API key warning: %s", api_key_issue)

    @property
    def available(self) -> bool:
        return self._enabled and bool(self._api_key)

    @property
    def auto_recall(self) -> bool:
        return self._auto_recall

    @property
    def auto_capture(self) -> bool:
        return self._auto_capture

    @property
    def max_recall_results(self) -> int:
        return max(1, min(self._max_recall_results, 20))

    @property
    def profile_frequency(self) -> int:
        return max(1, min(self._profile_frequency, 500))

    def _container_tag(self, user_id: int) -> str:
        return build_container_tag(user_id, prefix=self._container_prefix)

    def policy_for_tier(self, plan_tier: Optional[str]) -> SupermemoryPolicy:
        normalized = normalize_plan_tier(plan_tier)
        base_max = self.max_recall_results
        base_freq = self.profile_frequency
        min_query = self._min_query_chars

        if normalized == "scout":
            return SupermemoryPolicy(
                enabled=False,
                auto_recall=False,
                auto_capture=False,
                max_recall_results=min(base_max, 3),
                profile_frequency=max(base_freq, 200),
                min_query_chars=min_query,
                threshold=self._tier_thresholds.get("scout"),
            )
        if normalized == "pathfinder":
            return SupermemoryPolicy(
                enabled=True,
                auto_recall=self._auto_recall,
                auto_capture=self._auto_capture,
                max_recall_results=min(base_max, 4),
                profile_frequency=max(base_freq, 200),
                min_query_chars=min_query,
                threshold=self._tier_thresholds.get("pathfinder"),
            )
        if normalized == "voyager":
            return SupermemoryPolicy(
                enabled=True,
                auto_recall=self._auto_recall,
                auto_capture=self._auto_capture,
                max_recall_results=min(base_max, 8),
                profile_frequency=max(base_freq, 75),
                min_query_chars=min_query,
                threshold=self._tier_thresholds.get("voyager"),
            )
        return SupermemoryPolicy(
            enabled=True,
            auto_recall=self._auto_recall,
            auto_capture=self._auto_capture,
            max_recall_results=base_max,
            profile_frequency=base_freq,
            min_query_chars=min_query,
            threshold=self._tier_thresholds.get("pioneer"),
        )

    def _apply_overrides(
        self,
        policy: SupermemoryPolicy,
        overrides: Optional[SupermemoryOverrides],
    ) -> SupermemoryPolicy:
        if not overrides:
            return policy
        auto_recall = policy.auto_recall
        if overrides.auto_recall is not None:
            auto_recall = policy.auto_recall and overrides.auto_recall
        auto_capture = policy.auto_capture
        if overrides.auto_capture is not None:
            auto_capture = policy.auto_capture and overrides.auto_capture

        max_recall_results = policy.max_recall_results
        if overrides.max_recall_results is not None:
            max_recall_results = min(policy.max_recall_results, overrides.max_recall_results)

        profile_frequency = policy.profile_frequency
        if overrides.profile_frequency is not None:
            profile_frequency = max(policy.profile_frequency, overrides.profile_frequency)

        return SupermemoryPolicy(
            enabled=policy.enabled,
            auto_recall=auto_recall,
            auto_capture=auto_capture,
            max_recall_results=max_recall_results,
            profile_frequency=profile_frequency,
            min_query_chars=policy.min_query_chars,
            threshold=policy.threshold,
        )

    def _resolve_capture_mode(self, overrides: Optional[SupermemoryOverrides]) -> str:
        if overrides and overrides.capture_mode in {"all", "everything"}:
            return overrides.capture_mode
        return self._capture_mode

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _headers(self, container_tag: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        if container_tag:
            headers.update(_request_integrity_headers(self._api_key or "", container_tag))
        return headers

    async def _post(self, path: str, payload: Dict[str, Any], *, container_tag: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not self.available:
            return None
        start = time.perf_counter()
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self._base_url}{path}",
                json=payload,
                headers=self._headers(container_tag),
            )
            response.raise_for_status()
            data = response.json()
            if self._debug:
                self._logger.info(
                    "Supermemory request ok",
                    extra={
                        "event_type": "supermemory_request_ok",
                        "path": path,
                        "duration_ms": int((time.perf_counter() - start) * 1000),
                    },
                )
            return data
        except Exception as exc:
            if self._debug:
                self._logger.warning(
                    "Supermemory request failed: %s %s", path, exc, exc_info=True
                )
                self._logger.info(
                    "Supermemory request failed timing",
                    extra={
                        "event_type": "supermemory_request_failed",
                        "path": path,
                        "duration_ms": int((time.perf_counter() - start) * 1000),
                    },
                )
            return None

    def _count_user_turns(self, history: Optional[List[Dict[str, Any]]]) -> int:
        if not history:
            return 0
        count = 0
        for entry in history:
            if not isinstance(entry, dict):
                continue
            if entry.get("role") == "user":
                count += 1
        return count

    def _should_include_profile(self, history: Optional[List[Dict[str, Any]]]) -> bool:
        turn = self._count_user_turns(history) + 1
        return turn <= 1 or turn % self.profile_frequency == 0

    async def _search_fallback_for_recall(
        self,
        *,
        container_tag: str,
        prompt: str,
        policy: SupermemoryPolicy,
    ) -> List[Dict[str, Any]]:
        payload: Dict[str, Any] = {
            "q": prompt,
            "containerTag": container_tag,
            "limit": max(1, min(policy.max_recall_results, 20)),
            "searchMode": "memories",
        }
        if policy.threshold is not None:
            payload["threshold"] = policy.threshold
        data = await self._post("/v4/search", payload, container_tag=container_tag)
        if not isinstance(data, dict):
            return []
        return _normalize_search_results(data.get("results"))

    async def recall_context(
        self,
        *,
        user_id: int,
        prompt: str,
        conversation_history: Optional[List[Dict[str, Any]]],
        plan_tier: Optional[str] = None,
        overrides: Optional[SupermemoryOverrides] = None,
    ) -> Optional[str]:
        if not self.available:
            return None
        policy = self._apply_overrides(self.policy_for_tier(plan_tier), overrides)
        if not policy.enabled or not policy.auto_recall:
            return None
        if not prompt or len(prompt.strip()) < policy.min_query_chars:
            return None
        container_tag = self._container_tag(user_id)
        payload: Dict[str, Any] = {"containerTag": container_tag, "q": prompt}
        if policy.threshold is not None:
            payload["threshold"] = policy.threshold
        data = await self._post("/v4/profile", payload, container_tag=container_tag)
        profile_payload = data if isinstance(data, dict) else {}
        profile = profile_payload.get("profile") or {}
        static_facts = _ensure_str_list(profile.get("static"))
        dynamic_facts = _ensure_str_list(profile.get("dynamic"))
        search_results = _normalize_search_results(
            (profile_payload.get("searchResults") or {}).get("results")
        )

        if not self._should_include_profile(conversation_history):
            static_facts = []
            dynamic_facts = []

        if not static_facts and not dynamic_facts and not search_results:
            search_results = await self._search_fallback_for_recall(
                container_tag=container_tag,
                prompt=prompt,
                policy=policy,
            )

        context = format_supermemory_context(
            static_facts=static_facts,
            dynamic_facts=dynamic_facts,
            search_results=search_results,
            max_results=policy.max_recall_results,
        )
        if context and self._debug:
            self._logger.info(
                "Supermemory recall: user=%s context_len=%s", user_id, len(context)
            )
        return context

    async def capture_turn(
        self,
        *,
        user_id: int,
        user_message: str,
        assistant_message: str,
        conversation_id: Optional[str] = None,
        plan_tier: Optional[str] = None,
        overrides: Optional[SupermemoryOverrides] = None,
    ) -> None:
        if not self.available:
            return
        policy = self._apply_overrides(self.policy_for_tier(plan_tier), overrides)
        if not policy.enabled or not policy.auto_capture:
            return

        user_text = (user_message or "").strip()
        assistant_text = (assistant_message or "").strip()

        capture_mode = self._resolve_capture_mode(overrides)
        if capture_mode == "all":
            user_text = _SUPERMEMORY_CONTEXT_RE.sub("", user_text).strip()
            assistant_text = _SUPERMEMORY_CONTEXT_RE.sub("", assistant_text).strip()
            if len(user_text) < 10:
                user_text = ""
            if len(assistant_text) < 10:
                assistant_text = ""

        if not user_text and not assistant_text:
            return

        turn_timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        container_tag = self._container_tag(user_id)
        atomic_memories = _extract_atomic_user_memories(user_text)
        stored_atomic_count = 0
        for memory_text, category in atomic_memories:
            content = sanitize_content(memory_text, max_len=512)
            if not content:
                continue
            metadata = _build_capture_metadata(
                user_id=user_id,
                conversation_id=conversation_id,
                timestamp=turn_timestamp,
                source="gray_capture_turn",
                category=category,
            )
            payload: Dict[str, Any] = {
                "content": content,
                "containerTag": container_tag,
                "customId": _build_atomic_capture_custom_id(
                    user_id=user_id,
                    category=category,
                    content=content,
                ),
            }
            safe_metadata = sanitize_metadata(metadata)
            if safe_metadata:
                payload["metadata"] = safe_metadata
            result = await self._post("/v3/documents", payload, container_tag=container_tag)
            if result is not None:
                stored_atomic_count += 1

        if stored_atomic_count > 0:
            return

        blocks: List[str] = []
        if user_text:
            blocks.append(f"[role: user]\n{user_text}\n[user:end]")
        if assistant_text:
            blocks.append(f"[role: assistant]\n{assistant_text}\n[assistant:end]")

        content = sanitize_content("\n\n".join(blocks))
        if not content:
            return

        metadata = _build_capture_metadata(
            user_id=user_id,
            conversation_id=conversation_id,
            timestamp=turn_timestamp,
            source="gray",
        )
        safe_metadata = sanitize_metadata(metadata)
        payload = {
            "content": content,
            "containerTag": container_tag,
            "customId": _build_turn_capture_custom_id(
                user_id=user_id,
                conversation_id=conversation_id,
                content=content,
            ),
        }
        if safe_metadata:
            payload["metadata"] = safe_metadata
        await self._post("/v3/documents", payload, container_tag=container_tag)

    async def store_memory(
        self,
        *,
        user_id: int,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        custom_id: Optional[str] = None,
        plan_tier: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if not self.available:
            return None
        policy = self.policy_for_tier(plan_tier)
        if not policy.enabled:
            return None
        cleaned = sanitize_content(content or "")
        if not cleaned:
            return None
        container_tag = self._container_tag(user_id)
        payload: Dict[str, Any] = {
            "content": cleaned,
            "containerTag": container_tag,
        }
        safe_metadata = sanitize_metadata(metadata)
        if safe_metadata:
            payload["metadata"] = safe_metadata
        if custom_id:
            payload["customId"] = custom_id
        return await self._post("/v3/documents", payload, container_tag=container_tag)

    async def search_memories(
        self,
        *,
        user_id: int,
        query: str,
        limit: int = 5,
        plan_tier: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not self.available:
            return []
        policy = self.policy_for_tier(plan_tier)
        if not policy.enabled:
            return []
        cleaned_query = (query or "").strip()
        if not cleaned_query:
            return []
        try:
            parsed_limit = int(limit)
        except (TypeError, ValueError):
            parsed_limit = 5
        container_tag = self._container_tag(user_id)
        payload: Dict[str, Any] = {
            "q": cleaned_query,
            "containerTag": container_tag,
            "limit": max(1, min(parsed_limit, 20)),
            "searchMode": "memories",
        }
        if policy.threshold is not None:
            payload["threshold"] = policy.threshold
        data = await self._post("/v4/search", payload, container_tag=container_tag)
        if not data:
            return []
        return _normalize_search_results(data.get("results"))

    async def get_profile(
        self,
        *,
        user_id: int,
        query: Optional[str] = None,
        plan_tier: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if not self.available:
            return None
        policy = self.policy_for_tier(plan_tier)
        if not policy.enabled:
            return None
        container_tag = self._container_tag(user_id)
        payload: Dict[str, Any] = {"containerTag": container_tag}
        cleaned_query = (query or "").strip()
        if cleaned_query:
            payload["q"] = cleaned_query
        if policy.threshold is not None:
            payload["threshold"] = policy.threshold
        data = await self._post("/v4/profile", payload, container_tag=container_tag)
        if not data:
            return None
        profile = data.get("profile") or {}
        return {
            "static": _ensure_str_list(profile.get("static")),
            "dynamic": _ensure_str_list(profile.get("dynamic")),
            "searchResults": _normalize_search_results((data.get("searchResults") or {}).get("results")),
        }

    async def delete_memory(
        self,
        *,
        memory_id: str,
        user_id: Optional[int] = None,
        container_tag: Optional[str] = None,
    ) -> bool:
        if not self.available:
            return False
        if not memory_id:
            return False
        if not container_tag and user_id is not None:
            container_tag = self._container_tag(user_id)
        try:
            client = await self._get_client()
            response = await client.delete(
                f"{self._base_url}/v3/documents/{memory_id}",
                headers=self._headers(container_tag),
            )
            response.raise_for_status()
            return True
        except Exception as exc:
            if self._debug:
                self._logger.warning("Supermemory delete failed: %s", exc, exc_info=True)
            return False

    async def forget_by_query(
        self,
        *,
        user_id: int,
        query: str,
        plan_tier: Optional[str] = None,
    ) -> Dict[str, Any]:
        results = await self.search_memories(user_id=user_id, query=query, limit=5, plan_tier=plan_tier)
        if not results:
            return {"success": False, "message": "No matching memory found to forget."}
        policy = self.policy_for_tier(plan_tier)
        threshold = float(policy.threshold) if isinstance(policy.threshold, (int, float)) else 0.0
        target = _select_forget_target(
            query=query,
            results=results,
            min_similarity=max(0.75, threshold),
        )
        if not target:
            return {"success": False, "message": "No matching memory found to forget."}
        memory_id = target.get("id") or target.get("memoryId") or target.get("documentId")
        if memory_id:
            deleted = await self.delete_memory(
                memory_id=memory_id,
                user_id=user_id,
            )
            preview = (target.get("memory") or "")[:100]
            if deleted:
                return {"success": True, "message": f'Forgot: "{preview}"'}
        return {"success": False, "message": "Failed to forget memory."}

    async def wipe_all(
        self,
        *,
        user_id: int,
        plan_tier: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.available:
            return {"deletedCount": 0}
        policy = self.policy_for_tier(plan_tier)
        if not policy.enabled:
            return {"deletedCount": 0}
        container_tag = self._container_tag(user_id)
        client = await self._get_client()
        deleted_ids: List[str] = []
        page = 1
        try:
            while True:
                payload = {"containerTags": [container_tag], "limit": 100, "page": page}
                response = await client.post(
                    f"{self._base_url}/v3/documents/list",
                    json=payload,
                    headers=self._headers(container_tag),
                )
                response.raise_for_status()
                data = response.json() or {}
                memories = data.get("memories") or []
                if not memories:
                    break
                for doc in memories:
                    if isinstance(doc, dict) and doc.get("id"):
                        deleted_ids.append(doc["id"])
                pagination = data.get("pagination") or {}
                total_pages = pagination.get("totalPages") or pagination.get("total_pages")
                if not total_pages or page >= int(total_pages):
                    break
                page += 1
        except Exception as exc:
            if self._debug:
                self._logger.warning("Supermemory wipe list failed: %s", exc, exc_info=True)
            return {"deletedCount": 0}

        if not deleted_ids:
            return {"deletedCount": 0}

        deleted_count = 0
        try:
            for i in range(0, len(deleted_ids), 100):
                batch = deleted_ids[i : i + 100]
                response = await client.post(
                    f"{self._base_url}/v3/documents/delete-bulk",
                    json={"ids": batch},
                    headers=self._headers(container_tag),
                )
                response.raise_for_status()
                deleted_count += len(batch)
        except Exception as exc:
            if self._debug:
                self._logger.warning("Supermemory wipe delete failed: %s", exc, exc_info=True)
        return {"deletedCount": deleted_count}

    async def delete_conversation_memories(
        self,
        *,
        user_id: int,
        conversation_id: str,
    ) -> Dict[str, int]:
        if not self.available:
            return {"matchedCount": 0, "deletedCount": 0}

        target_conversation_id = (conversation_id or "").strip()
        if not target_conversation_id:
            return {"matchedCount": 0, "deletedCount": 0}

        container_tag = self._container_tag(user_id)
        client = await self._get_client()
        matched_ids: List[str] = []
        page = 1
        try:
            while True:
                payload = {"containerTags": [container_tag], "limit": 100, "page": page}
                response = await client.post(
                    f"{self._base_url}/v3/documents/list",
                    json=payload,
                    headers=self._headers(container_tag),
                )
                response.raise_for_status()
                data = response.json() or {}
                memories = data.get("memories") or []
                if not memories:
                    break

                for doc in memories:
                    if not isinstance(doc, dict):
                        continue

                    memory_id = doc.get("id")
                    if not isinstance(memory_id, str) or not memory_id.strip():
                        continue

                    metadata = doc.get("metadata")
                    if not isinstance(metadata, dict):
                        metadata = doc.get("meta")
                    if not isinstance(metadata, dict):
                        continue

                    doc_conversation_id = (
                        metadata.get("conversation_id")
                        or metadata.get("conversationId")
                    )
                    if not isinstance(doc_conversation_id, str):
                        continue
                    if doc_conversation_id.strip() != target_conversation_id:
                        continue
                    matched_ids.append(memory_id.strip())

                pagination = data.get("pagination") or {}
                total_pages = pagination.get("totalPages") or pagination.get("total_pages")
                if not total_pages or page >= int(total_pages):
                    break
                page += 1
        except Exception as exc:
            if self._debug:
                self._logger.warning(
                    "Supermemory conversation wipe list failed: %s", exc, exc_info=True
                )
            return {"matchedCount": 0, "deletedCount": 0}

        if not matched_ids:
            return {"matchedCount": 0, "deletedCount": 0}

        deleted_count = 0
        try:
            for i in range(0, len(matched_ids), 100):
                batch = matched_ids[i : i + 100]
                response = await client.post(
                    f"{self._base_url}/v3/documents/delete-bulk",
                    json={"ids": batch},
                    headers=self._headers(container_tag),
                )
                response.raise_for_status()
                deleted_count += len(batch)
        except Exception as exc:
            if self._debug:
                self._logger.warning(
                    "Supermemory conversation wipe delete failed: %s", exc, exc_info=True
                )

        return {"matchedCount": len(matched_ids), "deletedCount": deleted_count}


SUPERMEMORY_SERVICE = SupermemoryService()
