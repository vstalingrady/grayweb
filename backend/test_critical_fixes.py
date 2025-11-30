import sys
import os
import asyncio
import unittest
from unittest.mock import MagicMock, patch, AsyncMock

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Mock environment variables to avoid import errors
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["OPENROUTER_API_KEY"] = "fake_key"
os.environ["GEMINI_API_KEY"] = "fake_key"

# Mock dependencies before importing main
sys.modules["backend.database"] = MagicMock()
sys.modules["backend.auth"] = MagicMock()

# Now import the module under test
from backend import main

class TestCriticalFixes(unittest.TestCase):

    def test_cors_restricted(self):
        """Verify that _local_network_origins returns empty set."""
        print("\nTesting CORS Restriction...")
        origins = main._local_network_origins([3000])
        self.assertEqual(origins, set(), "CORS should not allow local network origins")
        print("✅ CORS Restriction Verified")

class TestAsyncFixes(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Setup common mocks
        self.mock_db = AsyncMock()
        self.user_id = 1
        
        # Mock UsageTracker to avoid DB calls
        self.usage_tracker_patcher = patch("backend.main.UsageTracker")
        self.mock_usage_tracker_cls = self.usage_tracker_patcher.start()
        self.mock_usage_tracker = self.mock_usage_tracker_cls.return_value
        self.mock_usage_tracker.check_limits = AsyncMock()
        self.mock_usage_tracker.track_usage = AsyncMock()
        
        # Mock Services
        self.openrouter_mock = AsyncMock()
        self.gemini_mock = AsyncMock()
        
        # Patch the global service instances in main
        self.openrouter_patcher = patch("backend.main.OPENROUTER_SERVICE", self.openrouter_mock)
        self.gemini_patcher = patch("backend.main.GEMINI_SERVICE", self.gemini_mock)
        
        self.openrouter_patcher.start()
        self.gemini_patcher.start()
        
        # Ensure services are "available"
        self.openrouter_mock.available = True
        self.gemini_mock.available = True

    async def asyncTearDown(self):
        self.usage_tracker_patcher.stop()
        self.openrouter_patcher.stop()
        self.gemini_patcher.stop()

    async def test_messaging_fallback(self):
        """Verify fallback to Gemini when OpenRouter fails."""
        print("\nTesting Messaging Runtime Fallback...")
        
        # Setup OpenRouter to fail
        async def fail_stream(*args, **kwargs):
            raise Exception("Simulated OpenRouter Failure")
            yield "should not reach here"
            
        self.openrouter_mock.stream = fail_stream
        
        # Setup Gemini to succeed
        async def success_stream(*args, **kwargs):
            yield MagicMock(text="Gemini response", candidates=[MagicMock(content=MagicMock(parts=[MagicMock(function_call=None)]))])
            
        self.gemini_mock.stream = success_stream
        
        # Call stream_ai_response with a model that prefers OpenRouter
        # We use a model name that doesn't start with "gemini" and no tools
        generator = main.stream_ai_response(
            message="Hello",
            user_id=self.user_id,
            db=self.mock_db,
            model="grok-beta" 
        )
        
        results = []
        try:
            async for chunk in generator:
                results.append(chunk)
        except Exception as e:
            self.fail(f"Stream raised exception instead of falling back: {e}")
            
        # Verify OpenRouter was called
        self.assertTrue(self.openrouter_mock.stream.called, "OpenRouter should have been called first")
        
        # Verify Gemini was called
        self.assertTrue(self.gemini_mock.stream.called, "Gemini should have been called after fallback")
        
        print("✅ Messaging Runtime Fallback Verified")

    async def test_onboarding_tool_forces_gemini(self):
        """Verify that onboarding tool forces Gemini provider."""
        print("\nTesting Onboarding Tool Support...")
        
        # Define a mock tool with complete_onboarding function
        mock_tool = MagicMock()
        mock_fd = MagicMock()
        mock_fd.name = "complete_onboarding"
        mock_tool.function_declarations = [mock_fd]
        
        # Setup Gemini to succeed
        async def success_stream(*args, **kwargs):
            yield MagicMock(text="Gemini response", candidates=[MagicMock(content=MagicMock(parts=[MagicMock(function_call=None)]))])
            
        self.gemini_mock.stream = success_stream
        
        # Call with onboarding tool
        generator = main.stream_ai_response(
            message="My name is Alice",
            user_id=self.user_id,
            db=self.mock_db,
            tools=[mock_tool],
            model="grok-beta" # Even if user asks for Grok
        )
        
        async for _ in generator:
            pass
            
        # Verify OpenRouter was NOT called
        self.assertFalse(self.openrouter_mock.stream.called, "OpenRouter should NOT be called for onboarding tools")
        
        # Verify Gemini WAS called
        self.assertTrue(self.gemini_mock.stream.called, "Gemini SHOULD be called for onboarding tools")
        
        print("✅ Onboarding Tool Support Verified")

if __name__ == "__main__":
    unittest.main()
