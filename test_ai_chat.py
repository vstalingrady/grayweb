
import asyncio
import os
import sys
import logging
from backend.main import stream_ai_response, get_database, _get_cached_user
from backend.database import database
from backend.openrouter_client import OpenRouterService

# Set up logging to see the output
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_ai_response():
    print("Testing AI response generation via code...")
    
    # Mock user ID (using your existing Pioneer account for consistency)
    user_id = 4 
    
    # Connect to DB
    await database.connect()
    
    try:
        # Load the actual system prompt being used
        from backend.main import DEFAULT_SYSTEM_PROMPT

        # Load user to ensure context is correct
        user = await _get_cached_user(user_id, database)
        if not user:
            print(f"User {user_id} not found!")
            return

        # Prepare arguments simulating a real chat request
        message = "i really like interstellar"

        # Simulate "bad/lame" history that might be polluting the context
        bad_history = [
            {"role": "user", "text": "hello"},
            {"role": "model", "text": "Hi there. How can I help?"},
            {"role": "user", "text": "what is this"},
            {"role": "model", "text": "This is Gray. I help you with work."},
        ]
        
        full_response = ""
        async for kind, payload in stream_ai_response(
            message=message,
            conversation_history=bad_history, # Inject the bad history
            workspace_context=None,
            system_prompt=DEFAULT_SYSTEM_PROMPT,
            time_context="Monday, December 6, 2025 at 8:00 PM UTC", 
            model="x-ai/grok-4.1-fast", 
            attachments=None,
            user_id=user_id,
            db=database,
            search_enabled=True,
            reasoning_mode=False
        ):
            if kind == "delta":
                print(payload, end="", flush=True)
                full_response += payload
            elif kind == "error":
                print(f"\n[ERROR]: {payload}")
        
        print("\n\n--- End of Response ---")
        
    except Exception as e:
        print(f"\n[EXCEPTION]: {e}")
    finally:
        await database.disconnect()

if __name__ == "__main__":
    # Ensure we can import backend modules
    sys.path.append(os.getcwd())
    asyncio.run(test_ai_response())
