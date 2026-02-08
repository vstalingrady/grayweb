from __future__ import annotations

from typing import Optional, Tuple

from backend.tier_utils import normalize_plan_tier

TIERS = ("scout", "pathfinder", "voyager", "pioneer")

TIER_LEVELS = {
    "scout": 0,
    "pathfinder": 1,
    "voyager": 2,
    "pioneer": 3,
}

# Backward-compatible model ID aliases.
MODEL_ALIASES = {
    "z-ai/glm-4.7-2025": "z-ai/glm-4.7",
    # Backward compatibility for older stored selections.
    "anthropic/claude-opus-4.5": "anthropic/claude-opus-4.6",
}

# Keep this list in sync with `src/components/gray/modelCatalog.ts`.
# Pathfinder: Budget models only (no Sonnet, Gemini Pro, GPT 5.2)
PATHFINDER_MODEL_IDS = {
    "anthropic/claude-haiku-4.5",
    "google/gemini-3-flash-preview",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-120b:fast",
    "deepseek/deepseek-v3.2",
    "deepseek/deepseek-v3.2-speciale",
    "x-ai/grok-4.1-fast",
    "moonshotai/kimi-k2.5",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "xiaomi/mimo-v2-flash:free",
    "z-ai/glm-4.7",
    "z-ai/glm-4.7:fast",
    # Legacy alias support (kept for existing stored selections).
    "z-ai/glm-4.7-flash",
    "minimax/minimax-m2.1",
    "minimax/minimax-m2-her",
}

# Voyager: All mid-tier models including Sonnet, Gemini Pro, GPT 5.2
VOYAGER_MODEL_IDS = PATHFINDER_MODEL_IDS | {
    "anthropic/claude-sonnet-4.5",
    "google/gemini-3-pro-preview",
    "openai/gpt-5.2-chat",
    "moonshotai/kimi-k2-0905",
    "moonshotai/kimi-k2-0905",
}

# Pioneer-only: Top-tier models
PIONEER_ONLY_MODEL_IDS = {
    "anthropic/claude-opus-4.6",
    "openai/gpt-5.2-pro",
}

PIONEER_MODEL_IDS = VOYAGER_MODEL_IDS | PIONEER_ONLY_MODEL_IDS

DEFAULT_PATHFINDER_MODEL = "x-ai/grok-4.1-fast"
DEFAULT_VOYAGER_MODEL = "anthropic/claude-sonnet-4.5"
DEFAULT_PIONEER_MODEL = "anthropic/claude-sonnet-4.5"

# Downgrade fallbacks when user requests model above their tier
DOWNGRADE_FALLBACKS = {
    # Pioneer → Voyager
    "anthropic/claude-opus-4.6": "anthropic/claude-sonnet-4.5",
    "openai/gpt-5.2-pro": "openai/gpt-5.2-chat",
    # Voyager → Pathfinder
    "anthropic/claude-sonnet-4.5": "anthropic/claude-haiku-4.5",
    "google/gemini-3-pro-preview": "google/gemini-3-flash-preview",
    "openai/gpt-5.2-chat": "x-ai/grok-4.1-fast",
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

    if model in MODEL_ALIASES:
        return MODEL_ALIASES[model], True

    # Removed tier alias support: treat Pro as Lite.
    if model in {"pro", "gray-pro"}:
        return "lite", model_raw != "lite"

    # Allow tier aliases for backward compatibility.
    if model in {"lite", "gray-lite"}:
        return "lite", model != model_raw
    if model == "pioneer":
        return "pioneer", model != model_raw
    if model in {"moonshotai/kimi-k2-fast", "kimi-k2-fast"}:
        return "moonshotai/kimi-k2-0905", True

    # Enforce OpenRouter allowlists for explicit model IDs.
    # The frontend sends model IDs like `anthropic/claude-sonnet-4.5`.
    if "/" in model:
        # Pathfinder: Budget models only
        if tier == "pathfinder":
            if model in PATHFINDER_MODEL_IDS:
                return model, model != model_raw
            # Downgrade higher-tier models
            if model in DOWNGRADE_FALLBACKS:
                return DOWNGRADE_FALLBACKS[model], True
            return DEFAULT_PATHFINDER_MODEL, True

        # Voyager: All mid-tier models
        if tier == "voyager":
            if model in VOYAGER_MODEL_IDS:
                return model, model != model_raw
            if model in PIONEER_ONLY_MODEL_IDS:
                return DOWNGRADE_FALLBACKS.get(model, DEFAULT_VOYAGER_MODEL), True
            return DEFAULT_VOYAGER_MODEL, True

        # Pioneer: All models
        if model in PIONEER_MODEL_IDS:
            return model, model != model_raw
        return DEFAULT_PIONEER_MODEL, True

    # Any other explicit model string is treated as unsupported.
    if tier == "pathfinder":
        return DEFAULT_PATHFINDER_MODEL, True
    return DEFAULT_PIONEER_MODEL if tier == "pioneer" else DEFAULT_VOYAGER_MODEL, True
