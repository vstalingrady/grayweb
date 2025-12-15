from __future__ import annotations

from typing import Optional, Tuple

try:
    from backend.tier_utils import normalize_plan_tier
except Exception:  # pragma: no cover - fallback when running backend/ directly
    from tier_utils import normalize_plan_tier  # type: ignore

TIERS = ("scout", "voyager", "pioneer")

TIER_LEVELS = {
    "scout": 0,
    "voyager": 1,
    "pioneer": 2,
}

# Keep this list in sync with `src/components/gray/modelCatalog.ts`.
VOYAGER_MODEL_IDS = {
    "anthropic/claude-haiku-4.5",
    "anthropic/claude-sonnet-4.5",
    "google/gemini-3-pro-preview",
    "google/gemini-2.5-flash",
    "openai/gpt-5.2-chat",
    "deepseek/deepseek-v3.2",
    "deepseek/deepseek-v3.2-speciale",
    "x-ai/grok-4.1-fast",
    "moonshotai/kimi-k2-thinking",
}

PIONEER_ONLY_MODEL_IDS = {
    "anthropic/claude-opus-4.5",
    "openai/gpt-5.2-pro",
}

PIONEER_MODEL_IDS = VOYAGER_MODEL_IDS | PIONEER_ONLY_MODEL_IDS

DEFAULT_VOYAGER_MODEL = "anthropic/claude-sonnet-4.5"
DEFAULT_PIONEER_MODEL = "anthropic/claude-sonnet-4.5"

DOWNGRADE_FALLBACKS = {
    "anthropic/claude-opus-4.5": "anthropic/claude-sonnet-4.5",
    "openai/gpt-5.2-pro": "openai/gpt-5.2-chat",
}


def coerce_model_for_tier(requested_model: Optional[str], plan_tier: Optional[str]) -> Tuple[Optional[str], bool]:
    """
    Clamp a user-supplied `model` to the set allowed for their plan tier.

    Returns: (effective_model, was_coerced)
    """
    tier = normalize_plan_tier(plan_tier)
    model_raw = (requested_model or "").strip()
    model = model_raw.lower()

    # Scout is always locked to Lite.
    if tier == "scout":
        return "lite", model not in {"", "lite", "gray-lite"}

    if not model:
        return None, False

    # Removed tier alias support: treat Pro as Lite.
    if model in {"pro", "gray-pro"}:
        return "lite", model_raw != "lite"

    # Allow tier aliases for backward compatibility.
    if model in {"lite", "gray-lite"}:
        return "lite", model != model_raw
    if model == "pioneer":
        return "pioneer", model != model_raw

    # Enforce OpenRouter allowlists for explicit model IDs.
    # The frontend sends model IDs like `anthropic/claude-sonnet-4.5`.
    if "/" in model:
        if tier == "voyager":
            if model in VOYAGER_MODEL_IDS:
                return model, model != model_raw
            if model in PIONEER_ONLY_MODEL_IDS:
                return DOWNGRADE_FALLBACKS.get(model, DEFAULT_VOYAGER_MODEL), True
            return DEFAULT_VOYAGER_MODEL, True

        # Pioneer
        if model in PIONEER_MODEL_IDS:
            return model, model != model_raw
        return DEFAULT_PIONEER_MODEL, True

    # Any other explicit model string is treated as unsupported for user selection.
    return DEFAULT_PIONEER_MODEL if tier == "pioneer" else DEFAULT_VOYAGER_MODEL, True
