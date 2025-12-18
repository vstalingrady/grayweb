from __future__ import annotations


def test_app_setup_syncs_proactivity_state_to_backend_main():
    from backend.core import app_setup
    import backend.main as main_module

    original_engine = main_module.proactivity_engine
    original_scheduler = main_module.proactivity_scheduler
    original_reminder = main_module.reminder_scheduler

    engine = object()
    scheduler = object()
    reminder = object()

    try:
        app_setup._sync_scheduler_state_to_main(engine, scheduler, reminder)

        assert main_module.proactivity_engine is engine
        assert main_module.proactivity_scheduler is scheduler
        assert main_module.reminder_scheduler is reminder
    finally:
        main_module.proactivity_engine = original_engine
        main_module.proactivity_scheduler = original_scheduler
        main_module.reminder_scheduler = original_reminder

