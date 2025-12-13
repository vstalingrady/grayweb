import os
import sys
from pathlib import Path


# Ensure backend module is importable
ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

TEST_DB_PATH = ROOT / "backend" / "tests" / "web_search_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB_PATH}")
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_KEY", "")

import main  # noqa: E402


def test_should_enable_search_explicit_request():
    assert main._should_enable_search("Can you google the latest iPhone price?") is True


def test_should_enable_search_live_data():
    assert main._should_enable_search("What's the weather in Paris today?") is True


def test_should_enable_search_not_for_research_word():
    assert main._should_enable_search("I am doing research on transformers.") is False


def test_should_enable_search_not_for_generic_person_question():
    assert main._should_enable_search("Who is Albert Einstein?") is False

