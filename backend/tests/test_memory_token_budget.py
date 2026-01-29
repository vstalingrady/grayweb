from __future__ import annotations

from backend.openrouter_client import OpenRouterService
from backend.token_utils import trim_history_by_token_budget


def test_trim_history_by_token_budget_keeps_all_when_budget_large():
    history = [{"role": "user", "text": "hello"} for _ in range(30)]
    trimmed = trim_history_by_token_budget(history, 10_000)
    assert len(trimmed) == len(history)


def test_trim_history_by_token_budget_trims_from_front_and_keeps_tail():
    history = [{"role": "user", "text": "word " * 2000} for _ in range(20)]
    trimmed = trim_history_by_token_budget(history, 2_000)
    assert 1 <= len(trimmed) < len(history)
    assert trimmed[-1] == history[-1]


def test_openrouter_build_messages_uses_token_budget_over_message_limit():
    history = []
    for index in range(25):
        role = "user" if index % 2 == 0 else "model"
        history.append({"role": role, "text": "hi"})

    client = OpenRouterService()
    messages = client._build_messages(
        history,
        "current",
        history_limit=10,
        history_token_budget=10_000,
    )

    assert len(messages) == len(history) + 1
    assert messages[-1]["role"] == "user"

