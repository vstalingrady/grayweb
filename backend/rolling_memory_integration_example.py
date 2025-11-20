"""
Integration Example: How to Use Rolling Memory in Your Backend
===============================================================

This file shows you exactly how to integrate the RollingMemory system
into your existing main.py backend.

Copy the relevant sections into your actual code.
"""

from fastapi import FastAPI, HTTPException
from typing import Optional, List, Dict, Any
from rolling_memory import (
    RollingMemoryOrchestrator,
    RollingMemoryConfig,
    add_long_term_memory_column_migration
)
from gemini_client import GeminiClient

# ============================================================================
# STEP 1: Initialize at Startup
# ============================================================================

# Add this to your app initialization (around line 1498 in main.py)

# Initialize Rolling Memory Orchestrator (GLOBAL)
rolling_memory_orchestrator: Optional[RollingMemoryOrchestrator] = None

@app.on_event("startup")
async def initialize_rolling_memory():
    """Initialize the rolling memory system on startup."""
    global rolling_memory_orchestrator
    
    try:
        # Use your existing gemini client
        gemini_client = GeminiClient(api_key=os.getenv("GEMINI_API_KEY"))
        
        # Optional: Custom configuration
        config = RollingMemoryConfig()
        config.MESSAGE_THRESHOLD = 10  # Compress after 10 messages
        config.ACTIVE_CONTEXT_SIZE = 5  # Keep last 5 raw
        
        # Initialize orchestrator
        # Set enable_archiving=True if you want to archive old messages
        # Set enable_archiving=False if you want to delete them (saves storage)
        rolling_memory_orchestrator = RollingMemoryOrchestrator(
            gemini_client=gemini_client,
            supabase_client=supabase,  # Your existing supabase client
            config=config,
            enable_archiving=False  # Set to True if you want archiving
        )
        
        print("✅ Rolling Memory system initialized successfully")
        
    except Exception as e:
        print(f"❌ Failed to initialize Rolling Memory: {e}")


# ============================================================================
# STEP 2: Modify Your Chat Endpoint
# ============================================================================

# This is how you modify your existing chat endpoint to use rolling memory
# (around line 3869 in main.py)

@app.post("/chat/stream")
async def chat_stream_rolling_memory_example(request: ChatRequest):
    """
    Example chat endpoint with Rolling Memory integration.
    
    This shows you the key changes needed to your existing chat endpoint.
    """
    
    # ... your existing validation code ...
    
    user_id = request.user_id
    conversation_id = request.conversation_id or f"general:{user_id}"
    
    # Check if this is a general conversation (eligible for rolling memory)
    is_general_chat = conversation_id.startswith("general:")
    
    # ========================================================================
    # KEY INTEGRATION: Use Rolling Memory for General Chat
    # ========================================================================
    
    if is_general_chat and rolling_memory_orchestrator:
        # Use rolling memory to prepare context
        enhanced_system_prompt, conversation_history, was_compressed = \
            await rolling_memory_orchestrator.prepare_chat_context(
                user_id=user_id,
                base_system_prompt=request.system_prompt or build_system_prompt(user_id)
            )
        
        # Log compression event
        if was_compressed:
            print(f"🗜️  Compressed conversation history for user {user_id}")
        
    else:
        # Fall back to old method for thread conversations
        conversation_history = await _load_conversation_history(conversation_id)
        enhanced_system_prompt = request.system_prompt or build_system_prompt(user_id)
    
    # ========================================================================
    # Continue with your normal chat generation...
    # ========================================================================
    
    # Now use enhanced_system_prompt and conversation_history as normal
    response_text = await gemini_client.generate_content_stream(
        message=request.message,
        system_prompt=enhanced_system_prompt,
        conversation_history=conversation_history,
        # ... rest of your params
    )
    
    # ... rest of your streaming logic ...
    
    return response_text


# ============================================================================
# STEP 3: Alternative - Modify Existing Endpoint
# ============================================================================

# Here's the minimal diff you need to apply to your existing chat endpoint:

"""
BEFORE (around line 3899 in your main.py):
----------------------------------------
conversation_history: List[Dict[str, Any]] = await _load_conversation_history(conversation_id)


AFTER:
------
# Check if general chat and use rolling memory
is_general_chat = conversation_id and conversation_id.startswith("general:")

if is_general_chat and rolling_memory_orchestrator:
    # Use rolling memory
    enhanced_system_prompt, conversation_history, was_compressed = \
        await rolling_memory_orchestrator.prepare_chat_context(
            user_id=user_id,
            base_system_prompt=system_prompt or build_system_prompt(user_id)
        )
    # Override system_prompt with enhanced version
    system_prompt = enhanced_system_prompt
else:
    # Use original method
    conversation_history: List[Dict[str, Any]] = await _load_conversation_history(conversation_id)
"""


# ============================================================================
# STEP 4: Helper Function to Build System Prompt
# ============================================================================

def build_system_prompt(user_id: int) -> str:
    """
    Build your base system prompt.
    
    This is what gets enhanced with the long-term memory injection.
    """
    # Example - customize based on your needs
    return f"""You are Gray, a helpful AI assistant.

## Your Role:
- Help the user with their questions and tasks
- Be conversational and friendly
- Remember context from our conversations

## Current User ID: {user_id}

Respond naturally and helpfully."""


# ============================================================================
# STEP 5: Manual Compression Endpoint (Optional)
# ============================================================================

@app.post("/api/compress-memory/{user_id}")
async def manually_compress_memory(user_id: int):
    """
    Manual endpoint to trigger compression for a user.
    
    Useful for testing or admin operations.
    """
    if not rolling_memory_orchestrator:
        raise HTTPException(status_code=503, detail="Rolling memory not initialized")
    
    try:
        # Force compression by setting threshold to 0
        messages = await rolling_memory_orchestrator.db_adapter.load_message_history(user_id)
        long_term_memory = await rolling_memory_orchestrator.db_adapter.load_long_term_memory(user_id)
        
        if not messages:
            return {"status": "no_messages", "message": "No messages to compress"}
        
        # Compress all messages
        new_memory = await rolling_memory_orchestrator.rolling_memory.compress_messages(
            messages,
            previous_memory=long_term_memory
        )
        
        # Save
        await rolling_memory_orchestrator.db_adapter.save_long_term_memory(user_id, new_memory)
        
        # Archive or delete
        if rolling_memory_orchestrator.enable_archiving:
            await rolling_memory_orchestrator.db_adapter.archive_old_messages(user_id, messages)
        await rolling_memory_orchestrator.db_adapter.delete_old_messages(user_id, messages)
        
        return {
            "status": "success",
            "compressed_messages": len(messages),
            "memory_length": len(new_memory),
            "memory_preview": new_memory[:200] + "..." if len(new_memory) > 200 else new_memory
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STEP 6: View Memory Endpoint (Optional)
# ============================================================================

@app.get("/api/memory/{user_id}")
async def view_user_memory(user_id: int):
    """
    View the current long-term memory for a user.
    
    Useful for debugging and showing users what the AI remembers.
    """
    if not rolling_memory_orchestrator:
        raise HTTPException(status_code=503, detail="Rolling memory not initialized")
    
    try:
        long_term_memory = await rolling_memory_orchestrator.db_adapter.load_long_term_memory(user_id)
        messages = await rolling_memory_orchestrator.db_adapter.load_message_history(user_id)
        
        return {
            "user_id": user_id,
            "long_term_memory": long_term_memory,
            "memory_length": len(long_term_memory),
            "active_message_count": len(messages),
            "will_compress_soon": len(messages) > rolling_memory_orchestrator.rolling_memory.config.MESSAGE_THRESHOLD
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STEP 7: Clear Memory Endpoint (Optional)
# ============================================================================

@app.delete("/api/memory/{user_id}")
async def clear_user_memory(user_id: int):
    """
    Clear the long-term memory for a user.
    
    This doesn't delete messages, just the compressed memory.
    """
    if not rolling_memory_orchestrator:
        raise HTTPException(status_code=503, detail="Rolling memory not initialized")
    
    try:
        await rolling_memory_orchestrator.db_adapter.save_long_term_memory(user_id, "")
        
        return {
            "status": "success",
            "message": f"Cleared long-term memory for user {user_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# USAGE SUMMARY
# ============================================================================

"""
Quick Integration Checklist:
-----------------------------

1. ✅ Run the SQL migration (see rolling_memory.py - add_long_term_memory_column_migration())
2. ✅ Add rolling_memory_orchestrator initialization to your startup
3. ✅ Modify your /chat/stream endpoint to use prepare_chat_context()
4. ✅ Test with a conversation that goes over 10 messages
5. ✅ (Optional) Add the helper endpoints for viewing/managing memory

Performance Notes:
------------------
- Compression happens automatically when messages exceed threshold
- Costs: ~500 tokens for compression + 5 messages = super cheap!
- Memory is cached in DB, no need to recompute until new compression
- Archive old messages if you need them for analytics
- Delete old messages if you want to save storage costs

That's it! Your AI now has infinite memory for the cost of ~10 messages. 🎉
"""
