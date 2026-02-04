import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TEST_DB_PATH = ROOT / "backend" / "tests" / "web_search_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""

import backend.main as main  # noqa: E402


def test_should_enable_search_explicit_request():
    assert main._should_enable_search("Can you google the latest iPhone price?") is True


def test_should_enable_search_live_data():
    assert main._should_enable_search("What's the weather in Paris today?") is True


def test_should_enable_search_not_for_research_word():
    assert main._should_enable_search("I am doing research on transformers.") is False


def test_should_enable_search_not_for_generic_person_question():
    assert main._should_enable_search("Who is Albert Einstein?") is False


def test_should_enable_search_for_what_happened():
    assert main._should_enable_search("What happened in the Epstein files?") is True
