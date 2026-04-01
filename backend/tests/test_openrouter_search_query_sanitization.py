from backend.core.stream_handlers.openrouter import _extract_search_query, _normalize_search_query


def test_normalize_search_query_collapses_whitespace() -> None:
    normalized = _normalize_search_query(
        "Pope   John   Paul II   Epstein files"
    )
    assert normalized is not None
    assert normalized == "Pope John Paul II Epstein files"


def test_normalize_search_query_truncates_long_values() -> None:
    normalized = _normalize_search_query("x" * 400)
    assert normalized is not None
    assert normalized.endswith("...")
    assert len(normalized) == 180


def test_extract_search_query_ignores_prompt_key_for_search_tools() -> None:
    extracted = _extract_search_query(
        "search",
        {"prompt": "iOS Reminders and switching timezones Apple Support"},
    )
    assert extracted is None


def test_extract_search_query_uses_explicit_query_and_sanitizes() -> None:
    extracted = _extract_search_query(
        "search",
        {"query": "Pope John Paul II Epstein files"},
    )
    assert extracted is not None
    assert extracted == "Pope John Paul II Epstein files"


def test_extract_search_query_supports_queries_list() -> None:
    extracted = _extract_search_query(
        "search",
        {"queries": ["", "Pope John Paul II Epstein files mention"]},
    )
    assert extracted == "Pope John Paul II Epstein files mention"
