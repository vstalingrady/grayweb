from __future__ import annotations

from backend.model_access import coerce_model_for_tier
from backend.tier_utils import bootstrap_plan_tier, normalize_plan_tier


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


def test_coerce_model_for_tier_remaps_glm_alias() -> None:
    effective_model, coerced = coerce_model_for_tier("z-ai/glm-4.7-2025", "pathfinder")
    assert effective_model == "z-ai/glm-4.7"
    assert coerced is True


def test_bootstrap_plan_tier_defaults_to_scout(monkeypatch) -> None:
    monkeypatch.delenv("BOOTSTRAP_PIONEER_EMAILS", raising=False)
    assert bootstrap_plan_tier("someone@example.com") == "scout"
    assert bootstrap_plan_tier(None) == "scout"


def test_bootstrap_plan_tier_respects_env_list(monkeypatch) -> None:
    monkeypatch.setenv("BOOTSTRAP_PIONEER_EMAILS", "owner@example.com; other@example.com")
    assert bootstrap_plan_tier("OWNER@example.com") == "pioneer"
    assert bootstrap_plan_tier("random@example.com") == "scout"
