def test_conversation_manager_helpers_importable():
    from backend.core import conversation_manager

    helpers = conversation_manager._get_conversation_store_helpers()
    assert callable(helpers["load_thread_history"])

