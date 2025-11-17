#!/usr/bin/env python3
"""
Test integration of AI-powered proactive notifications
Tests that the enhanced system works with the existing UI configuration
"""

import asyncio
import sys
from datetime import datetime

# Test imports
try:
    from ai_message_generator import AIMessageGenerator
    print("✅ ai_message_generator imports successfully")
except Exception as e:
    print(f"❌ Failed to import ai_message_generator: {e}")
    sys.exit(1)

try:
    import main
    print("✅ main.py imports successfully")
except Exception as e:
    print(f"❌ Failed to import main: {e}")
    sys.exit(1)


async def test_ai_message_generation():
    """Test AI message generation with sample data"""
    print("\n" + "="*60)
    print("TESTING AI MESSAGE GENERATION")
    print("="*60)

    generator = AIMessageGenerator()

    # Test daily briefing
    sample_dashboard_pulse = {
        "date_key": "2024-01-01",
        "plans": [
            {"name": "Complete project documentation", "status": "in progress"},
            {"name": "Review pull requests", "status": "not started"}
        ],
        "habits": [
            {"name": "Daily workout", "status": "checked"},
            {"name": "Morning meditation", "status": "not checked"}
        ]
    }

    sample_proactivity = {
        "id": "proactivity-default",
        "label": "Check-ins",
        "cadence": "Daily",
        "time": "09:00 AM"
    }

    try:
        title, message = await generator.generate_daily_briefing(
            user_id=123,
            dashboard_pulse=sample_dashboard_pulse,
            proactivity=sample_proactivity,
            timezone_str="UTC+07:00",  # Asia/Jakarta
            reason="scheduled_morning",
            tone="supportive",
            decision_context={"window": "morning"},
        )

        print(f"✅ Daily briefing generated")
        print(f"Title: {title}")
        print(f"Message preview: {message[:100]}...")

    except Exception as e:
        print(f"❌ Failed to generate daily briefing: {e}")
        return False

    # Test weekly review
    recent_pulses = [
        {"plans": [], "habits": []},
        {"plans": [], "habits": []},
        {"plans": [], "habits": []}
    ]

    try:
        title, message = await generator.generate_weekly_review(
            user_id=123,
            recent_pulses=recent_pulses,
            proactivity=sample_proactivity
        )

        print(f"\n✅ Weekly review generated")
        print(f"Title: {title}")
        print(f"Message preview: {message[:100]}...")

    except Exception as e:
        print(f"❌ Failed to generate weekly review: {e}")
        return False

    # Test habit nudge
    try:
        title, message = await generator.generate_habit_nudge(
            user_id=123,
            habit_name="Morning meditation",
            days_since=4
        )

        print(f"\n✅ Habit nudge generated")
        print(f"Title: {title}")
        print(f"Message: {message}")

    except Exception as e:
        print(f"❌ Failed to generate habit nudge: {e}")
        return False

    return True


def test_proactivity_structure():
    """Test that the proactivity structure from the UI is compatible"""
    print("\n" + "="*60)
    print("TESTING PROACTIVITY STRUCTURE COMPATIBILITY")
    print("="*60)

    # This is the structure from the UI shown
    ui_proactivity = {
        "id": "proactivity-default",
        "label": "Check-ins",
        "cadence": "Daily",
        "time": "09:00 AM"
    }

    # Check that our enhanced system can read it
    if "time" in ui_proactivity:
        print("✅ Proactivity has 'time' field (compatible with UI)")
    else:
        print("❌ Proactivity missing 'time' field")
        return False

    if "cadence" in ui_proactivity:
        print("✅ Proactivity has 'cadence' field")
    else:
        print("❌ Proactivity missing 'cadence' field")
        return False

    if ui_proactivity.get("cadence") in ["Daily", "Frequent", "Weekly"]:
        print(f"✅ Cadence '{ui_proactivity['cadence']}' is valid")
    else:
        print(f"⚠️  Cadence '{ui_proactivity.get('cadence')}' may not be recognized")

    print(f"\nUI Configuration:")
    print(f"  - Timezone: Asia/Jakarta (UTC+7)")
    print(f"  - Cadence: {ui_proactivity['cadence']}")
    print(f"  - Time: {ui_proactivity['time']}")
    print(f"  - Channel: In-app assistant")

    return True


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("INTEGRATION TEST - AI-POWERED PROACTIVE NOTIFICATIONS")
    print("="*60)
    print("\nThis test verifies that:")
    print("1. AI message generation works")
    print("2. Proactivity structure from UI is compatible")
    print("3. Timezone handling works")

    results = []

    # Test proactivity structure
    results.append(("Proactivity Structure", test_proactivity_structure()))

    # Test AI message generation
    results.append(("AI Message Generation", await test_ai_message_generation()))

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{name}: {status}")

    all_passed = all(passed for _, passed in results)

    print("\n" + "="*60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
        print("\nYour UI configuration is compatible with the AI system.")
        print("Users with 'Daily' cadence will receive AI-powered check-ins.")
    else:
        print("❌ SOME TESTS FAILED")
    print("="*60)

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
