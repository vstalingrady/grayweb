"""Proactivity-related helper functions.

Utilities for building proactivity summaries and related data.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import databases

# Lazy imports
_tables = None
_row_get_fn = None


def _get_tables():
    """Get database tables."""
    global _tables
    if _tables is None:
        from backend.database import plans, habits
        _tables = {"plans": plans, "habits": habits}
    return _tables


def _get_row_get():
    """Get _row_get helper function."""
    global _row_get_fn
    if _row_get_fn is None:
        from backend.core.serializers import _row_get
        _row_get_fn = _row_get
    return _row_get_fn


async def fetch_proactivity_summary(
    user_id: int,
    info_type: Optional[str],
    db: "databases.Database",
) -> Dict[str, Any]:
    """Build a lightweight proactivity summary based on the current plans and habits.

    This function queries the plans and habits tables to build a summary
    of the user's active plans and tracked habits.

    Args:
        user_id: The user's ID
        info_type: Optional focus type (e.g., "plans", "habits", "general")
        db: Database connection

    Returns:
        Dictionary with summary, focus, plans list, habits list, and latest_date
    """
    tables = _get_tables()
    _row_get = _get_row_get()
    plans_table = tables["plans"]
    habits_table = tables["habits"]

    plan_labels: List[str] = []
    habit_labels: List[str] = []  # Fixed: This was missing in original

    # Load plans from local database
    if not plan_labels:
        rows = await db.fetch_all(
            plans_table.select()
            .where(plans_table.c.user_id == user_id)
            .order_by(plans_table.c.created_at)
        )
        for row in rows:
            label = str(_row_get(row, "label") or "").strip()
            if label:
                plan_labels.append(label)

    # Load habits from local database
    if not habit_labels:
        rows = await db.fetch_all(
            habits_table.select()
            .where(habits_table.c.user_id == user_id)
            .order_by(habits_table.c.created_at)
        )
        for row in rows:
            label = str(_row_get(row, "label") or "").strip()
            if label:
                habit_labels.append(label)

    # Limit to 6 items each
    plan_labels = plan_labels[:6]
    habit_labels = habit_labels[:6]

    # Build summary text
    summary_parts: List[str] = []
    if plan_labels:
        summary_parts.append(f"{len(plan_labels)} active plans")
    if habit_labels:
        summary_parts.append(f"{len(habit_labels)} tracked habits")
    if not summary_parts:
        summary_parts.append("No recorded plan or habit data yet.")

    return {
        "summary": " | ".join(summary_parts),
        "focus": info_type or "general",
        "plans": plan_labels,
        "habits": habit_labels,
        "latest_date": None,
    }
