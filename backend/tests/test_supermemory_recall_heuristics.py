from __future__ import annotations

from backend.core.ai_service import _should_request_supermemory_recall


def test_recall_requested_by_default_for_non_empty_message(monkeypatch):
    monkeypatch.delenv("GRAY_SUPERMEMORY_RECALL_EVERY_N", raising=False)
    monkeypatch.delenv("GRAY_SUPERMEMORY_MIN_PROMPT_CHARS", raising=False)

    assert _should_request_supermemory_recall("ok", history=[]) is True


def test_recall_not_requested_for_empty_message(monkeypatch):
    monkeypatch.delenv("GRAY_SUPERMEMORY_RECALL_EVERY_N", raising=False)
    monkeypatch.delenv("GRAY_SUPERMEMORY_MIN_PROMPT_CHARS", raising=False)

    assert _should_request_supermemory_recall("   ", history=[]) is False


def test_recall_respects_min_prompt_chars(monkeypatch):
    monkeypatch.setenv("GRAY_SUPERMEMORY_MIN_PROMPT_CHARS", "10")
    monkeypatch.delenv("GRAY_SUPERMEMORY_RECALL_EVERY_N", raising=False)

    assert _should_request_supermemory_recall("short", history=[]) is False
    assert _should_request_supermemory_recall("long enough", history=[]) is True


def test_recall_respects_every_n_turns(monkeypatch):
    monkeypatch.setenv("GRAY_SUPERMEMORY_RECALL_EVERY_N", "3")
    monkeypatch.delenv("GRAY_SUPERMEMORY_MIN_PROMPT_CHARS", raising=False)

    history_before_second_turn = [{"role": "user", "text": "first"}]
    history_before_third_turn = [
        {"role": "user", "text": "first"},
        {"role": "model", "text": "a"},
        {"role": "user", "text": "second"},
    ]

    assert _should_request_supermemory_recall("second", history_before_second_turn) is False
    assert _should_request_supermemory_recall("third", history_before_third_turn) is True
