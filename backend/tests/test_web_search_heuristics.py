import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TEST_DB_PATH = ROOT / "backend" / "tests" / "web_search_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""

from backend.core.message_detection import should_enable_search  # noqa: E402


def test_should_enable_search_explicit_request():
    assert should_enable_search("Can you google the latest iPhone price?") is True


def test_should_enable_search_live_data():
    assert should_enable_search("What's the weather in Paris today?") is True


def test_should_enable_search_not_for_research_word():
    assert should_enable_search("I am doing research on transformers.") is False


def test_should_enable_search_for_generic_fact_question():
    assert should_enable_search("Who is Albert Einstein?") is True


def test_should_enable_search_for_what_happened():
    assert should_enable_search("What happened in the Epstein files?") is True


def test_should_enable_search_slang_guard():
    assert should_enable_search("wtf") is False
    assert should_enable_search("what is wtf") is False
    assert should_enable_search("idk") is False


def test_should_enable_search_small_talk_guard():
    assert should_enable_search("hey how are you") is False
    assert should_enable_search("thanks bro") is False


def test_should_enable_search_not_for_plain_greeting():
    assert should_enable_search("hi") is False
    assert should_enable_search("hello!") is False


def test_should_enable_search_for_non_recency_factual_question():
    assert should_enable_search("Can you explain what RAG means in LLM systems?") is True
