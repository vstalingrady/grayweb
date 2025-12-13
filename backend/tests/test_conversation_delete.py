import asyncio
from types import SimpleNamespace


def _make_request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})


def test_delete_conversation_uuid_does_not_require_global_tables(monkeypatch):
    import backend.main as main

    conversation_id = "edb20263-c75c-4961-ab3d-a801461dc9a8"
    current_user = {"id": 1}

    async def stub_require_owner(_conversation_id, _current_user):
        return None

    class StubDb:
        async def execute(self, *_args, **_kwargs):
            return None

    monkeypatch.setattr(main, "_require_conversation_owner", stub_require_owner)
    monkeypatch.setattr(main, "_invalidate_conversation_cache", lambda _conversation_id: None)
    monkeypatch.setattr(main, "database", StubDb())
    monkeypatch.setattr(main, "supabase", None)
    monkeypatch.setattr(main, "_conversation_store_available", lambda: False)

    # Simulate the bug condition by removing the global table symbols.
    if hasattr(main, "user_chat_messages"):
        monkeypatch.delattr(main, "user_chat_messages", raising=False)
    if hasattr(main, "user_chat_threads"):
        monkeypatch.delattr(main, "user_chat_threads", raising=False)

    asyncio.run(main.delete_conversation(_make_request(), conversation_id, current_user))

