import json
import io
import zipfile
import sys
from pathlib import Path

# Add the repo root to sys.path to allow importing backend modules
repo_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(repo_root))

from backend.core.chatgpt_import import extract_chatgpt_memory_from_zip

def create_mock_chatgpt_zip():
    conversations = [
        {
            "title": "My Projects",
            "update_time": 1672531200.0,
            "mapping": {
                "node1": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {
                            "content_type": "text",
                            "parts": ["I am an software engineer. My name is Alice."]
                        }
                    }
                },
                "node2": {
                    "message": {
                        "author": {"role": "assistant"},
                        "content": {
                            "content_type": "text",
                            "parts": ["Hello Alice! Nice to meet you."]
                        }
                    }
                }
            }
        },
        {
            "title": "Travel Plans",
            "update_time": 1672617600.0,
            "mapping": {
                "node3": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {
                            "content_type": "text",
                            "parts": ["I live in New York and I want to visit Japan."]
                        }
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

def test_import():
    print("Creating mock ChatGPT zip...")
    zip_buf = create_mock_chatgpt_zip()
    
    print("Testing extraction logic...")
    try:
        summary = extract_chatgpt_memory_from_zip(zip_buf)
        
        print("\n--- Summary Results ---")
        print(f"Conversation Count: {summary.conversation_count}")
        print(f"Message Count:      {summary.message_count}")
        print(f"User Message Count: {summary.user_message_count}")
        print(f"Fact Count:         {summary.fact_count}")
        print(f"Title Count:        {summary.title_count}")
        print("\n--- Summary Content ---")
        print(summary.summary)
        
        # Simple assertions
        assert summary.conversation_count == 2
        assert summary.message_count == 3
        assert summary.user_message_count == 2
        assert "Role: software engineer" in summary.summary
        assert "Name: Alice" in summary.summary
        assert "Location: New York" in summary.summary
        assert "Goal: visit Japan" in summary.summary
        assert "My Projects" in summary.summary
        assert "Travel Plans" in summary.summary
        
        print("\nSUCCESS: ChatGPT import logic verified!")
        
    except Exception as e:
        print(f"\nFAILURE: Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_import()
