from datetime import datetime, timezone

from backend.core.dashboard_helpers import (
    normalize_habit_items,
    normalize_plan_items,
    serialize_dashboard_pulse_record,
)


def test_normalize_habit_items_preserves_completion_and_previous_label():
    payload = normalize_habit_items(
        [
            {
                "id": "habit-1",
                "label": "Read",
                "previousLabel": "Read books",
                "completed": True,
            }
        ]
    )

    assert payload == [
        {
            "id": "habit-1",
            "label": "Read",
            "previous_label": "Read books",
            "completed": True,
        }
    ]


def test_normalize_plan_items_preserves_extended_plan_fields():
    payload = normalize_plan_items(
        [
            {
                "id": "plan-1",
                "label": "Ship dashboard patch",
                "completed": False,
                "deadline": "2026-02-09",
                "scheduleSlot": "09:00-10:00",
                "details": "Carry plan metadata in pulse history",
                "reminderAt": "2026-02-09T08:45:00Z",
                "color": "#6f8bff",
            }
        ]
    )

    assert payload == [
        {
            "id": "plan-1",
            "label": "Ship dashboard patch",
            "completed": False,
            "deadline": "2026-02-09",
            "schedule_slot": "09:00-10:00",
            "description": "Carry plan metadata in pulse history",
            "reminder_at": "2026-02-09T08:45:00Z",
            "color": "#6f8bff",
        }
    ]


def test_serialize_dashboard_pulse_record_converts_datetime_timestamp_to_ms():
    timestamp = datetime(2026, 2, 8, 15, 30, tzinfo=timezone.utc)
    created_at = datetime(2026, 2, 8, 10, 0, tzinfo=timezone.utc)

    payload = serialize_dashboard_pulse_record(
        {
            "id": 9,
            "user_id": 123,
            "date_key": "2026-02-08",
            "timestamp": timestamp,
            "plans": [{"id": "p1", "label": "Plan", "completed": False}],
            "habits": [{"id": "h1", "label": "Habit", "completed": True}],
            "proactivity": {"id": "proactivity-daily", "label": "Daily", "cadence": "Daily", "time": "09:00 AM"},
            "created_at": created_at,
            "updated_at": created_at,
        }
    )

    assert payload is not None
    assert payload["timestamp"] == int(timestamp.timestamp() * 1000)


def test_serialize_dashboard_pulse_record_falls_back_to_created_at_when_timestamp_missing():
    created_at = datetime(2026, 2, 8, 10, 0, tzinfo=timezone.utc)

    payload = serialize_dashboard_pulse_record(
        {
            "id": 10,
            "user_id": 123,
            "date_key": "2026-02-08",
            "timestamp": None,
            "plans": [],
            "habits": [],
            "proactivity": {"id": "proactivity-daily", "label": "Daily", "cadence": "Daily", "time": "09:00 AM"},
            "created_at": created_at,
            "updated_at": created_at,
        }
    )

    assert payload is not None
    assert payload["timestamp"] == int(created_at.timestamp() * 1000)
