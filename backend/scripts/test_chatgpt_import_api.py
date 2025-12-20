import json
import io
import zipfile
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Add the repo root to sys.path
repo_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(repo_root))

from backend.main import app
from backend.auth import get_current_user
from backend.database import database

# Mock user for testing
MOCK_USER = {
    "id": 1,
    "email": "test@example.com",
    "full_name": "Test User",
    "role": "user"
}

def mock_get_current_user():
    return MOCK_USER

app.dependency_overrides[get_current_user] = mock_get_current_user

def create_mock_chatgpt_zip():
    conversations = [
        {
            "title": "Test Chat",
            "mapping": {
                "1": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["My name is Bob. I am a chef."]}
                    }
                }
            }
        }
    ]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("conversations.json", json.dumps(conversations))
    buf.seek(0)
    return buf

def test_api_import():
    print("Testing API endpoint /api/imports/chatgpt...")
    
    client = TestClient(app)
    zip_buf = create_mock_chatgpt_zip()
    
    response = client.post(
        "/api/imports/chatgpt",
        files={"file": ("export.zip", zip_buf, "application/zip")}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
        
        assert response.status_code == 201
        data = response.json()
        assert "context_cache_id" in data
        assert data["conversation_count"] == 1
        assert "chef" in data["summary_preview"]
        
        print("\nSUCCESS: API integration verified!")

if __name__ == "__main__":
    # Ensure DB is connected for the test if needed (TestClient usually handles lifespan if used as context manager)
    test_api_import()
