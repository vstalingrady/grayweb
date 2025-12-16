import sqlite3

import pytest


@pytest.mark.asyncio
async def test_ensure_user_data_record_handles_unique_constraint_race(monkeypatch):
    import backend.core.conversation_store as conversation_store

    class StubDatabase:
        def __init__(self):
            self.fetch_count = 0
            self.execute_count = 0

        async def fetch_one(self, _query):
            self.fetch_count += 1
            if self.fetch_count == 1:
                return None
            return {"id": 99}

        async def execute(self, _query):
            self.execute_count += 1
            raise sqlite3.IntegrityError("UNIQUE constraint failed: user_data.user_identifier")

    conversation_store._USER_DATA_CACHE.clear()
    stub_db = StubDatabase()
    monkeypatch.setattr(conversation_store, "database", stub_db)

    user_data_id = await conversation_store.ensure_user_data_record(123)
    assert user_data_id == 99
    assert conversation_store._USER_DATA_CACHE.get(123) == 99


@pytest.mark.asyncio
async def test_ensure_user_data_record_retries_until_row_visible(monkeypatch):
    import asyncio
    import backend.core.conversation_store as conversation_store

    async def _no_sleep(_delay: float):
        return None

    monkeypatch.setattr(asyncio, "sleep", _no_sleep)

    class StubDatabase:
        def __init__(self):
            self.fetch_count = 0
            self.execute_count = 0

        async def fetch_one(self, _query):
            self.fetch_count += 1
            # 1 -> initial select (None), 2 -> first retry (None), 3 -> row becomes visible
            if self.fetch_count < 3:
                return None
            return {"id": 101}

        async def execute(self, _query):
            self.execute_count += 1
            raise sqlite3.IntegrityError("UNIQUE constraint failed: user_data.user_identifier")

    conversation_store._USER_DATA_CACHE.clear()
    stub_db = StubDatabase()
    monkeypatch.setattr(conversation_store, "database", stub_db)

    user_data_id = await conversation_store.ensure_user_data_record(123)
    assert user_data_id == 101
    assert conversation_store._USER_DATA_CACHE.get(123) == 101
