import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TEST_DB_PATH = ROOT / "backend" / "tests" / "structured_tools_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""

from backend.core.message_detection import should_expose_structured_tools  # noqa: E402


def test_exposes_tools_when_reminders_enabled() -> None:
    assert should_expose_structured_tools(
        "hello there",
        reminders_enabled=True,
        is_onboarding_tool=False,
    ) is True


def test_disables_tools_for_onboarding() -> None:
    assert should_expose_structured_tools(
        "set reminder tomorrow at 9",
        reminders_enabled=True,
        is_onboarding_tool=True,
    ) is False


def test_disables_when_reminders_toggle_off() -> None:
    assert should_expose_structured_tools(
        "set reminder tomorrow at 9",
        reminders_enabled=False,
        is_onboarding_tool=False,
    ) is False
