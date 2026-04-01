from backend.api.chat import _resolve_provider_routing


def test_gpt_oss_normal_defaults_to_price_sort() -> None:
    routing = _resolve_provider_routing(
        requested_model="openai/gpt-oss-120b",
        effective_model="openai/gpt-oss-120b",
        requested_provider_routing=None,
    )
    assert routing == {"sort": "price"}


def test_gpt_oss_fast_defaults_to_throughput_sort() -> None:
    routing = _resolve_provider_routing(
        requested_model="openai/gpt-oss-120b:fast",
        effective_model="openai/gpt-oss-120b:fast",
        requested_provider_routing=None,
    )
    assert routing == {"sort": "throughput"}


def test_explicit_provider_routing_is_preserved() -> None:
    routing = _resolve_provider_routing(
        requested_model="openai/gpt-oss-120b:fast",
        effective_model="openai/gpt-oss-120b",
        requested_provider_routing={"sort": "latency", "allow_fallbacks": False},
    )
    assert routing == {"sort": "latency", "allow_fallbacks": False}


def test_glm_normal_defaults_to_price_sort() -> None:
    routing = _resolve_provider_routing(
        requested_model="z-ai/glm-5",
        effective_model="z-ai/glm-5",
        requested_provider_routing=None,
    )
    assert routing == {"sort": "price"}


def test_glm_fast_defaults_to_throughput_sort() -> None:
    routing = _resolve_provider_routing(
        requested_model="z-ai/glm-5:fast",
        effective_model="z-ai/glm-5:fast",
        requested_provider_routing=None,
    )
    assert routing == {"sort": "throughput"}


def test_openrouter_auto_defaults_to_price_sort() -> None:
    routing = _resolve_provider_routing(
        requested_model="openrouter/auto",
        effective_model="xiaomi/mimo-v2-flash",
        requested_provider_routing=None,
    )
    assert routing == {"sort": "price"}
