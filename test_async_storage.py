import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.database import database
from backend.main import get_or_create_conversation, save_conversation_message, _load_conversation_history

async def main():
    load_dotenv()
    await database.connect()
    
    try:
        print("Testing get_or_create_conversation...")
        user_id = 1  # Assuming user 1 exists
        conv_id = await get_or_create_conversation(None, user_id, title="Async Test")
        print(f"Conversation created: {conv_id}")
        
        print("Testing save_conversation_message...")
        await save_conversation_message(
            conv_id,
            {"role": "user", "text": "Hello async world!"},
            user_id=user_id
        )
        print("Message saved.")
        
        print("Testing _load_conversation_history...")
        history = await _load_conversation_history(conv_id, user_id)
        print(f"History loaded: {len(history)} messages")
        print(history)
        
    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
