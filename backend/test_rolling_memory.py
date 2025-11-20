"""
Rolling Memory System - Test Suite
===================================

Run this to test your Rolling Memory implementation.
"""

import asyncio
import os
import sys
from datetime import datetime
from typing import List

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from rolling_memory import (
    RollingMemory,
    RollingMemoryConfig,
    RollingMemoryOrchestrator,
    Message
)


class MockGeminiClient:
    """Mock Gemini client for testing."""
    
    async def generate_content(self, message, system_prompt, conversation_history, model):
        """Mock compression - just summarize message count."""
        # Simulate Gemini's compression
        lines = message.split('\n')
        msg_count = len([l for l in lines if l.startswith('User:') or l.startswith('AI:')])
        
        # Create a mock compressed summary
        summary = f"Conversation compressed: {msg_count} messages exchanged. "
        summary += "Topics discussed include testing, compression, and AI systems. "
        summary += f"Last interaction at {datetime.utcnow().isoformat()}."
        
        return summary


class MockSupabaseClient:
    """Mock Supabase client for testing."""
    
    def __init__(self):
        self.memory_store = {}
        self.message_store = {}
        self.user_data_ids = {}
    
    def table(self, name):
        """Return mock table."""
        return MockTable(self, name)


class MockTable:
    """Mock Supabase table."""
    
    def __init__(self, client, name):
        self.client = client
        self.name = name
        self._query = {}
    
    def select(self, *args):
        self._query['select'] = args
        return self
    
    def eq(self, col, val):
        self._query['eq'] = (col, val)
        return self
    
    def limit(self, n):
        self._query['limit'] = n
        return self
    
    def order(self, col, desc=False):
        self._query['order'] = (col, desc)
        return self
    
    def insert(self, data):
        self._result = {'data': [{'id': 1, **data}]}
        return self
    
    def update(self, data):
        self._result = {'data': [data]}
        return self
    
    def delete(self):
        self._result = {'data': []}
        return self
    
    def in_(self, col, vals):
        self._query['in'] = (col, vals)
        return self
    
    def execute(self):
        """Execute the query."""
        result = MockResult()
        
        if self.name == "user_data":
            if 'select' in self._query:
                user_id = self._query.get('eq', (None, None))[1]
                
                # Handle user_data_id lookup
                if user_id in self.client.user_data_ids:
                    result.data = [{'id': self.client.user_data_ids[user_id]}]
                else:
                    # Create new
                    new_id = len(self.client.user_data_ids) + 1
                    self.client.user_data_ids[user_id] = new_id
                    result.data = [{'id': new_id}]
                
                # Add memory if requested
                if 'long_term_memory' in str(self._query.get('select', '')):
                    memory = self.client.memory_store.get(user_id, "")
                    result.data = [{'long_term_memory': memory}]
            
            elif hasattr(self, '_result'):
                # Update
                user_id = self._query.get('eq', (None, None))[1]
                update_data = getattr(self, '_result', {}).get('data', [{}])[0]
                if 'long_term_memory' in update_data:
                    self.client.memory_store[user_id] = update_data['long_term_memory']
                result.data = [update_data]
        
        elif self.name == "general_chat_messages":
            user_id = self._query.get('eq', (None, None))[1]
            
            if 'select' in self._query:
                # Load messages
                messages = self.client.message_store.get(user_id, [])
                result.data = messages
            
            elif hasattr(self, '_result') and self._result['data']:
                # Delete
                result.data = []
        
        return result


class MockResult:
    """Mock query result."""
    def __init__(self):
        self.data = []


# ============================================================================
# TEST CASES
# ============================================================================

async def test_message_creation():
    """Test Message class."""
    print("\n🧪 Test 1: Message Creation")
    
    msg = Message(
        role="user",
        content="Hello world",
        created_at=datetime.utcnow()
    )
    
    assert msg.role == "user"
    assert msg.content == "Hello world"
    assert msg.to_dict()["text"] == "Hello world"
    
    text_format = msg.to_text_format()
    assert "User:" in text_format
    assert "Hello world" in text_format
    
    print("✅ Message creation works")


async def test_split_history():
    """Test history splitting."""
    print("\n🧪 Test 2: History Splitting")
    
    mock_gemini = MockGeminiClient()
    rolling_memory = RollingMemory(mock_gemini)
    
    # Create 12 messages
    messages = [
        Message(role="user" if i % 2 == 0 else "model", content=f"Message {i}")
        for i in range(12)
    ]
    
    to_compress, active = rolling_memory.split_history(messages)
    
    assert len(to_compress) == 7
    assert len(active) == 5
    assert active[0].content == "Message 7"
    assert active[-1].content == "Message 11"
    
    print("✅ History splitting works")
    print(f"   - To compress: {len(to_compress)}")
    print(f"   - Active: {len(active)}")


async def test_compression():
    """Test message compression."""
    print("\n🧪 Test 3: Message Compression")
    
    mock_gemini = MockGeminiClient()
    rolling_memory = RollingMemory(mock_gemini)
    
    messages = [
        Message(role="user", content="I'm building a chat app"),
        Message(role="model", content="That's great! What features?"),
        Message(role="user", content="I want rolling memory"),
        Message(role="model", content="Smart choice for cost savings"),
    ]
    
    compressed = await rolling_memory.compress_messages(messages)
    
    assert len(compressed) > 0
    assert "messages exchanged" in compressed
    
    print("✅ Compression works")
    print(f"   - Original: {len(messages)} messages")
    print(f"   - Compressed: {len(compressed)} chars")
    print(f"   - Preview: {compressed[:100]}...")


async def test_context_building():
    """Test context building."""
    print("\n🧪 Test 4: Context Building")
    
    mock_gemini = MockGeminiClient()
    rolling_memory = RollingMemory(mock_gemini)
    
    long_term_memory = "User is building a chat app with rolling memory."
    active_messages = [
        Message(role="user", content="What's the next step?"),
        Message(role="model", content="Let's implement the API"),
    ]
    
    base_prompt = "You are a helpful AI assistant."
    
    enhanced_prompt, active_dicts = rolling_memory.build_chat_context(
        long_term_memory,
        active_messages,
        base_prompt
    )
    
    assert "Long-Term Memory" in enhanced_prompt
    assert "rolling memory" in enhanced_prompt
    assert "helpful AI" in enhanced_prompt
    assert len(active_dicts) == 2
    
    print("✅ Context building works")
    print(f"   - System prompt: {len(enhanced_prompt)} chars")
    print(f"   - Active messages: {len(active_dicts)}")


async def test_supabase_adapter():
    """Test Supabase adapter."""
    print("\n🧪 Test 5: Supabase Adapter")
    
    from rolling_memory import RollingMemorySupabaseAdapter
    
    mock_supabase = MockSupabaseClient()
    adapter = RollingMemorySupabaseAdapter(mock_supabase)
    
    # Test user_data_id creation
    user_id = 123
    data_id = await adapter.get_user_data_id(user_id)
    assert data_id is not None
    
    # Test memory save/load
    test_memory = "This is a test memory"
    await adapter.save_long_term_memory(user_id, test_memory)
    loaded_memory = await adapter.load_long_term_memory(user_id)
    assert loaded_memory == test_memory
    
    print("✅ Supabase adapter works")
    print(f"   - User data ID: {data_id}")
    print(f"   - Memory saved and loaded: {len(loaded_memory)} chars")


async def test_full_orchestration():
    """Test full orchestration."""
    print("\n🧪 Test 6: Full Orchestration")
    
    mock_gemini = MockGeminiClient()
    mock_supabase = MockSupabaseClient()
    
    orchestrator = RollingMemoryOrchestrator(
        gemini_client=mock_gemini,
        supabase_client=mock_supabase,
        enable_archiving=False
    )
    
    user_id = 456
    
    # Simulate 12 messages in DB
    mock_supabase.message_store[user_id] = [
        {
            'id': i,
            'role': 'user' if i % 2 == 0 else 'model',
            'content': f'Message {i}',
            'grounding_metadata': None,
            'created_at': datetime.utcnow().isoformat()
        }
        for i in range(12)
    ]
    
    # Prepare chat context
    enhanced_prompt, active_context, was_compressed = \
        await orchestrator.prepare_chat_context(user_id, "You are Gray")
    
    assert was_compressed  # Should trigger compression
    assert len(active_context) <= 5  # Active context size
    assert "Long-Term Memory" in enhanced_prompt
    assert "You are Gray" in enhanced_prompt
    
    print("✅ Full orchestration works")
    print(f"   - Was compressed: {was_compressed}")
    print(f"   - Active context: {len(active_context)} messages")
    print(f"   - Enhanced prompt: {len(enhanced_prompt)} chars")


async def test_threshold_detection():
    """Test compression threshold."""
    print("\n🧪 Test 7: Threshold Detection")
    
    mock_gemini = MockGeminiClient()
    config = RollingMemoryConfig()
    rolling_memory = RollingMemory(mock_gemini, config)
    
    # Test different message counts
    test_cases = [
        (5, False),   # Below threshold
        (10, False),  # At threshold
        (11, True),   # Above threshold
        (20, True),   # Well above
    ]
    
    for count, expected in test_cases:
        result = rolling_memory.should_compress(count)
        assert result == expected, f"Failed for {count} messages"
    
    print("✅ Threshold detection works")
    for count, expected in test_cases:
        print(f"   - {count} messages: {'compress' if expected else 'no compress'}")


async def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("  ROLLING MEMORY SYSTEM - TEST SUITE")
    print("=" * 60)
    
    tests = [
        test_message_creation,
        test_split_history,
        test_compression,
        test_context_building,
        test_supabase_adapter,
        test_full_orchestration,
        test_threshold_detection,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            await test()
            passed += 1
        except Exception as e:
            print(f"\n❌ {test.__name__} FAILED: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"  RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Your Rolling Memory system is ready to ship!")
    else:
        print(f"\n⚠️  {failed} tests failed. Please review the errors above.")
    
    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
