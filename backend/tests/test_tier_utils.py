from __future__ import annotations

from backend.model_access import coerce_model_for_tier
from backend.tier_utils import normalize_plan_tier


def test_normalize_plan_tier_handles_standard_tiers() -> None:
    assert normalize_plan_tier(None) == "scout"
    assert normalize_plan_tier(" scout ") == "scout"
    assert normalize_plan_tier("Voyager") == "voyager"
    assert normalize_plan_tier("PIONEER") == "pioneer"


def test_normalize_plan_tier_supports_aliases_and_role_fallback() -> None:
    assert normalize_plan_tier("pro") == "voyager"
    assert normalize_plan_tier("admin") == "pioneer"
    assert normalize_plan_tier(None, role="admin") == "pioneer"


def test_coerce_model_for_tier_treats_pro_as_voyager() -> None:
    # Pro users should not be treated as Scout.
    effective_model, coerced = coerce_model_for_tier("anthropic/claude-sonnet-4.5", "pro")
    assert effective_model == "anthropic/claude-sonnet-4.5"
    assert coerced is False

