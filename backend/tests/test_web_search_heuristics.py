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


def test_should_enable_search_explicit_command_with_memory_wording():
    assert should_enable_search("search the web for what i asked before") is True


def test_should_enable_search_not_for_memory_meta_prompt():
    assert should_enable_search("what did i search up before this") is False
    assert should_enable_search("did i ask before") is False


def test_should_enable_search_not_for_generic_fact_question():
    assert should_enable_search("Who is Albert Einstein?") is False


def test_should_enable_search_not_for_follow_up_without_explicit_search():
    history = [
        {"role": "user", "text": "What happened in the Epstein files release?"},
        {"role": "model", "text": "I can summarize the key points."},
    ]
    assert should_enable_search("what about him gaming though", conversation_history=history) is False
