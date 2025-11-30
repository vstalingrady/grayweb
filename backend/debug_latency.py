import asyncio
import time
import sys
import os
from unittest.mock import AsyncMock, MagicMock

# Add project root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(current_dir)) # Add /home/ubuntu/gray

# Mock dependencies before importing main
sys.modules["backend.database"] = MagicMock()
sys.modules["backend.usage_tracker"] = MagicMock()
sys.modules["usage_tracker"] = MagicMock()

# Define a mock exception
class MockUsageLimitExceeded(Exception):
    pass

sys.modules["usage_tracker"].UsageLimitExceeded = MockUsageLimitExceeded
sys.modules["backend.usage_tracker"].UsageLimitExceeded = MockUsageLimitExceeded

# Mock UsageTracker class
mock_tracker = MagicMock()
mock_tracker.check_limits = AsyncMock()
sys.modules["usage_tracker"].UsageTracker = MagicMock(return_value=mock_tracker)
sys.modules["backend.usage_tracker"].UsageTracker = MagicMock(return_value=mock_tracker)

try:
    from main import stream_ai_response
except ImportError:
    # Try importing from backend.main if running from root
    from backend.main import stream_ai_response

async def test_latency():
    print("Testing stream_ai_response latency...")
    
    # Mock DB
    mock_db = AsyncMock()
    
    # Mock UsageTracker
    # stream_ai_response instantiates UsageTracker(db)
    # We need to patch it or ensure the mock works. 
    # Since we mocked the module above, it might be enough if main imports it.
    # But main imports UsageTracker from usage_tracker.py.
    # Let's just run it and see if it fails, then fix.
    
    start_time = time.perf_counter()
    first_token_time = None
    
    print("Calling stream_ai_response...")
    
    # We need a valid user_id (int)
    user_id = 1
    
    print("\n--- Testing Gemini ---")
    try:
        start_time = time.perf_counter()
        first_token_time = None
        async for kind, payload in stream_ai_response(
            message="Hello, are you there?",
            conversation_history=[],
            user_id=user_id,
            db=mock_db,
            model="models/gemini-flash-lite-latest", 
            search_enabled=False
        ):
            if kind == "delta":
                if first_token_time is None:
                    first_token_time = time.perf_counter()
                    print(f"First token received after: {(first_token_time - start_time)*1000:.2f}ms")
            elif kind == "final":
                print("Stream finished.")
    except Exception as e:
        print(f"Gemini Error: {e}")

    print("\n--- Testing Grok (OpenRouter) ---")
    try:
        start_time = time.perf_counter()
        first_token_time = None
        async for kind, payload in stream_ai_response(
            message="Hello, are you there?",
            conversation_history=[],
            user_id=user_id,
            db=mock_db,
            model="x-ai/grok-4.1-fast:free", 
            search_enabled=False
        ):
            if kind == "delta":
                if first_token_time is None:
                    first_token_time = time.perf_counter()
                    print(f"First token received after: {(first_token_time - start_time)*1000:.2f}ms")
            elif kind == "final":
                print("Stream finished.")
    except Exception as e:
        print(f"Grok Error: {e}")


if __name__ == "__main__":
    asyncio.run(test_latency())
