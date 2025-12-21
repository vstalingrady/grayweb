import asyncio
import os
import sys
from pathlib import Path

# Set up paths to import backend modules
sys.path.append(str(Path(__file__).parent.parent))

from backend.database import database, users
from backend.models.user import serialize_user_row

async def test_serialization():
    # Force use of production DB path for this test if needed, 
    # but here we just want to see how the code handles a row.
    # We can fetch a real row from the user's DB via SSH or just use a mock row.
    
    # Let's mock a row that looks like what SQLite returns
    class MockRow:
        def __init__(self, data):
            self.data = data
        def __getitem__(self, key):
            return self.data[key]
        def __iter__(self):
            return iter(self.data)
        def keys(self):
            return self.data.keys()
        def get(self, key, default=None):
            return self.data.get(key, default)

    mock_data = {
        "id": 6,
        "email": "vstalingrady@gmail.com",
        "full_name": "V Stalingrady",
        "role": "user",
        "plan_tier": "pioneer",
        "visible_model_ids": None,
        "notification_preferences": None
    }
    
    row = MockRow(mock_data)
    serialized = serialize_user_row(row)
    print(f"Serialized plan_tier: {serialized.get('plan_tier')}")
    print(f"Full serialized: {serialized}")

if __name__ == "__main__":
    asyncio.run(test_serialization())
