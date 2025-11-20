"""
Rolling Memory / Recursive Token Compression System
====================================================

This module implements an intelligent memory compression system for chat applications
that allows infinite context while maintaining low token costs.

Algorithm:
1. Check if conversation history exceeds threshold (10 messages)
2. Keep last 5 messages as "Active Context" (raw)
3. Compress older messages + existing LongTermMemory into dense summary
4. Update LongTermMemory field, delete/archive old messages
5. Inject LongTermMemory + ActiveContext into system prompt for chat generation

Cost Efficiency: ~500 tokens of summary + 5 messages of context per turn
"""

import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import logging

# Gemini client import
from gemini_client import GeminiClient

# Logging setup
logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

class RollingMemoryConfig:
    """Configuration for the rolling memory system."""
    
    # Message count thresholds
    MESSAGE_THRESHOLD: int = 10  # When to trigger compression
    ACTIVE_CONTEXT_SIZE: int = 5  # Number of recent messages to keep raw
    
    # Compression prompt template
    COMPRESSION_SYSTEM_PROMPT = """You are a memory compression specialist. Your job is to create ultra-dense, factual summaries of conversations.

## Instructions:
1. Extract ALL important facts, decisions, preferences, and context
2. Maintain chronological order
3. Use third-person perspective ("User mentioned...", "The AI suggested...")
4. Be extremely concise but preserve ALL meaningful information
5. Include dates/times if mentioned
6. Preserve entity names, numbers, and specific details
7. If there's existing memory, integrate new information seamlessly

## Output Format:
Create a single, flowing paragraph that captures everything important. NO bullet points, NO sections.
Just pure, dense information.

Example:
"User is building a chat app called Cuan for Indonesian consumers. Stack: Node.js backend, Supabase (Postgres), Gemini 2.5 Flash. Working on token compression to save costs. User prefers TypeScript and wants to maintain 14-day retention for Scout tier. Lives in timezone GMT+7. Interested in implementing RAG with file search."
"""

    COMPRESSION_USER_PROMPT_TEMPLATE = """Previous Memory:
{previous_memory}

---

New Conversation to Compress:
{conversation_history}

---

Compress ALL of the above into a single, ultra-dense paragraph that preserves every important fact."""


# ============================================================================
# CORE CLASSES
# ============================================================================

class Message:
    """Represents a single chat message."""
    
    def __init__(
        self,
        role: str,
        content: str,
        grounding_metadata: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None,
        message_id: Optional[int] = None
    ):
        self.role = role  # 'user' or 'model'
        self.content = content
        self.grounding_metadata = grounding_metadata
        self.created_at = created_at or datetime.utcnow()
        self.message_id = message_id
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        result = {
            "role": self.role,
            "text": self.content
        }
        if self.grounding_metadata:
            result["grounding_metadata"] = self.grounding_metadata
        return result
    
    def to_text_format(self) -> str:
        """Convert to human-readable text for compression."""
        prefix = "User" if self.role == "user" else "AI"
        timestamp = self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else ""
        if timestamp:
            return f"[{timestamp}] {prefix}: {self.content}"
        return f"{prefix}: {self.content}"
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Message":
        """Create Message from dictionary."""
        return cls(
            role=data.get("role", "user"),
            content=data.get("text", ""),
            grounding_metadata=data.get("grounding_metadata"),
            message_id=data.get("id")
        )


class RollingMemory:
    """
    Main class for managing rolling memory compression.
    
    This handles the intelligent compression of conversation history
    to maintain infinite context while keeping costs low.
    """
    
    def __init__(
        self,
        gemini_client: GeminiClient,
        config: Optional[RollingMemoryConfig] = None
    ):
        """
        Initialize the RollingMemory system.
        
        Args:
            gemini_client: Initialized Gemini client for compression
            config: Optional custom configuration
        """
        self.gemini_client = gemini_client
        self.config = config or RollingMemoryConfig()
        self.logger = logging.getLogger(__name__)
    
    def should_compress(self, message_count: int) -> bool:
        """
        Check if compression should be triggered.
        
        Args:
            message_count: Current number of messages in history
            
        Returns:
            True if compression should happen
        """
        return message_count > self.config.MESSAGE_THRESHOLD
    
    def split_history(
        self,
        messages: List[Message]
    ) -> Tuple[List[Message], List[Message]]:
        """
        Split message history into active context and old messages.
        
        Args:
            messages: Full list of messages
            
        Returns:
            Tuple of (messages_to_compress, active_context)
        """
        if len(messages) <= self.config.ACTIVE_CONTEXT_SIZE:
            return [], messages
        
        split_point = len(messages) - self.config.ACTIVE_CONTEXT_SIZE
        messages_to_compress = messages[:split_point]
        active_context = messages[split_point:]
        
        self.logger.info(
            f"Split history: {len(messages_to_compress)} to compress, "
            f"{len(active_context)} active"
        )
        
        return messages_to_compress, active_context
    
    async def compress_messages(
        self,
        messages: List[Message],
        previous_memory: str = ""
    ) -> str:
        """
        Compress messages into a dense summary using Gemini.
        
        Args:
            messages: Messages to compress
            previous_memory: Existing long-term memory to integrate
            
        Returns:
            Compressed memory string
        """
        if not messages:
            return previous_memory
        
        # Format messages for compression
        conversation_text = "\n".join([
            msg.to_text_format() for msg in messages
        ])
        
        # Build the compression prompt
        user_prompt = self.config.COMPRESSION_USER_PROMPT_TEMPLATE.format(
            previous_memory=previous_memory or "(No previous memory)",
            conversation_history=conversation_text
        )
        
        self.logger.info(f"Compressing {len(messages)} messages with Gemini...")
        
        try:
            # Call Gemini for compression
            compressed = await self.gemini_client.generate_content(
                message=user_prompt,
                system_prompt=self.config.COMPRESSION_SYSTEM_PROMPT,
                conversation_history=[],  # No history for compression itself
                model="gemini-2.0-flash-exp",  # Use fast model for compression
            )
            
            self.logger.info(f"Compression successful: {len(compressed)} chars")
            return compressed.strip()
            
        except Exception as e:
            self.logger.error(f"Compression failed: {e}")
            # Fallback: just concatenate if Gemini fails
            return f"{previous_memory}\n\n{conversation_text}"[:2000]
    
    def build_chat_context(
        self,
        long_term_memory: str,
        active_context: List[Message],
        base_system_prompt: str = ""
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Build the final system prompt and conversation history for chat.
        
        This injects the long-term memory at the top of the system prompt,
        followed by the active context messages.
        
        Args:
            long_term_memory: Compressed memory summary
            active_context: Recent raw messages
            base_system_prompt: Base system prompt to prepend to
            
        Returns:
            Tuple of (enhanced_system_prompt, active_context_dicts)
        """
        # Build enhanced system prompt with memory injection
        memory_section = ""
        if long_term_memory and long_term_memory.strip():
            memory_section = f"""
## Long-Term Memory
The following is a compressed summary of your conversation history with this user:

{long_term_memory}

---
"""
        
        enhanced_system_prompt = f"{memory_section}\n{base_system_prompt}"
        
        # Convert active context to dict format
        active_context_dicts = [msg.to_dict() for msg in active_context]
        
        return enhanced_system_prompt, active_context_dicts


# ============================================================================
# SUPABASE INTEGRATION
# ============================================================================

class RollingMemorySupabaseAdapter:
    """
    Adapter for integrating RollingMemory with Supabase.
    
    This handles all database operations for storing/retrieving
    long-term memory and managing message history.
    """
    
    def __init__(self, supabase_client):
        """
        Initialize the Supabase adapter.
        
        Args:
            supabase_client: Initialized Supabase client
        """
        self.supabase = supabase_client
        self.logger = logging.getLogger(__name__)
    
    async def get_user_data_id(self, user_id: int) -> Optional[int]:
        """Get or create user_data record."""
        try:
            # Try to get existing
            result = (
                self.supabase.table("user_data")
                .select("id")
                .eq("user_identifier", user_id)
                .limit(1)
                .execute()
            )
            
            if result.data:
                return result.data[0]["id"]
            
            # Create new
            created = (
                self.supabase.table("user_data")
                .insert({"user_identifier": user_id})
                .execute()
            )
            
            if created.data:
                return created.data[0]["id"]
            
        except Exception as e:
            self.logger.error(f"Error getting user_data_id: {e}")
        
        return None
    
    async def load_long_term_memory(self, user_id: int) -> str:
        """
        Load the long-term memory for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            Long-term memory string (empty if none exists)
        """
        try:
            result = (
                self.supabase.table("user_data")
                .select("long_term_memory")
                .eq("user_identifier", user_id)
                .limit(1)
                .execute()
            )
            
            if result.data and result.data[0].get("long_term_memory"):
                return result.data[0]["long_term_memory"]
            
        except Exception as e:
            self.logger.error(f"Error loading long-term memory: {e}")
        
        return ""
    
    async def save_long_term_memory(self, user_id: int, memory: str) -> bool:
        """
        Save long-term memory for a user.
        
        Args:
            user_id: User identifier
            memory: Memory string to save
            
        Returns:
            True if successful
        """
        try:
            user_data_id = await self.get_user_data_id(user_id)
            if not user_data_id:
                self.logger.error("Could not get user_data_id")
                return False
            
            result = (
                self.supabase.table("user_data")
                .update({
                    "long_term_memory": memory,
                    "updated_at": datetime.utcnow().isoformat()
                })
                .eq("user_identifier", user_id)
                .execute()
            )
            
            self.logger.info(f"Saved long-term memory for user {user_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving long-term memory: {e}")
            return False
    
    async def load_message_history(self, user_id: int) -> List[Message]:
        """
        Load all messages for a user from general_chat_messages.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of Message objects
        """
        try:
            result = (
                self.supabase.table("general_chat_messages")
                .select("id, role, content, grounding_metadata, created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=False)
                .execute()
            )
            
            messages = []
            for row in result.data or []:
                messages.append(Message(
                    role=row.get("role"),
                    content=row.get("content"),
                    grounding_metadata=row.get("grounding_metadata"),
                    created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                        if row.get("created_at") else None,
                    message_id=row.get("id")
                ))
            
            self.logger.info(f"Loaded {len(messages)} messages for user {user_id}")
            return messages
            
        except Exception as e:
            self.logger.error(f"Error loading messages: {e}")
            return []
    
    async def delete_old_messages(
        self,
        user_id: int,
        messages_to_delete: List[Message]
    ) -> bool:
        """
        Delete old messages from the database.
        
        Args:
            user_id: User identifier
            messages_to_delete: Messages to remove
            
        Returns:
            True if successful
        """
        if not messages_to_delete:
            return True
        
        try:
            # Get IDs of messages to delete
            message_ids = [
                msg.message_id for msg in messages_to_delete 
                if msg.message_id is not None
            ]
            
            if not message_ids:
                self.logger.warning("No message IDs to delete")
                return True
            
            # Delete from database
            result = (
                self.supabase.table("general_chat_messages")
                .delete()
                .in_("id", message_ids)
                .execute()
            )
            
            self.logger.info(f"Deleted {len(message_ids)} old messages for user {user_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting messages: {e}")
            return False
    
    async def archive_old_messages(
        self,
        user_id: int,
        messages_to_archive: List[Message]
    ) -> bool:
        """
        Archive old messages to a separate table (optional, for data retention).
        
        This is useful if you want to keep old messages for analytics
        but not load them in the active conversation.
        
        Args:
            user_id: User identifier
            messages_to_archive: Messages to archive
            
        Returns:
            True if successful
        """
        if not messages_to_archive:
            return True
        
        try:
            # Prepare archive records
            archive_records = []
            user_data_id = await self.get_user_data_id(user_id)
            
            for msg in messages_to_archive:
                archive_records.append({
                    "user_id": user_id,
                    "user_data_id": user_data_id,
                    "role": msg.role,
                    "content": msg.content,
                    "grounding_metadata": msg.grounding_metadata,
                    "original_created_at": msg.created_at.isoformat() if msg.created_at else None,
                    "archived_at": datetime.utcnow().isoformat()
                })
            
            # Insert into archive table (you'll need to create this table)
            result = (
                self.supabase.table("archived_chat_messages")
                .insert(archive_records)
                .execute()
            )
            
            self.logger.info(f"Archived {len(archive_records)} messages for user {user_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error archiving messages: {e}")
            return False


# ============================================================================
# MAIN ORCHESTRATOR
# ============================================================================

class RollingMemoryOrchestrator:
    """
    Main orchestrator that ties everything together.
    
    This is what you'll actually use in your backend endpoints.
    """
    
    def __init__(
        self,
        gemini_client: GeminiClient,
        supabase_client,
        config: Optional[RollingMemoryConfig] = None,
        enable_archiving: bool = False
    ):
        """
        Initialize the orchestrator.
        
        Args:
            gemini_client: Gemini client for compression
            supabase_client: Supabase client for storage
            config: Optional custom configuration
            enable_archiving: If True, archive old messages instead of deleting
        """
        self.rolling_memory = RollingMemory(gemini_client, config)
        self.db_adapter = RollingMemorySupabaseAdapter(supabase_client)
        self.enable_archiving = enable_archiving
        self.logger = logging.getLogger(__name__)
    
    async def prepare_chat_context(
        self,
        user_id: int,
        base_system_prompt: str = ""
    ) -> Tuple[str, List[Dict[str, Any]], bool]:
        """
        Prepare chat context with rolling memory compression.
        
        This is the main function you call before generating a chat response.
        It handles everything: loading history, checking if compression is needed,
        compressing if necessary, and returning the enhanced context.
        
        Args:
            user_id: User identifier
            base_system_prompt: Base system prompt to enhance
            
        Returns:
            Tuple of (enhanced_system_prompt, active_context, was_compressed)
        """
        self.logger.info(f"Preparing chat context for user {user_id}")
        
        # 1. Load current state
        messages = await self.db_adapter.load_message_history(user_id)
        long_term_memory = await self.db_adapter.load_long_term_memory(user_id)
        
        was_compressed = False
        
        # 2. Check if compression is needed
        if self.rolling_memory.should_compress(len(messages)):
            self.logger.info(f"Compression triggered: {len(messages)} messages")
            
            # 3. Split history
            messages_to_compress, active_context = self.rolling_memory.split_history(messages)
            
            # 4. Compress old messages
            new_memory = await self.rolling_memory.compress_messages(
                messages_to_compress,
                previous_memory=long_term_memory
            )
            
            # 5. Save new memory
            await self.db_adapter.save_long_term_memory(user_id, new_memory)
            
            # 6. Archive or delete old messages
            if self.enable_archiving:
                await self.db_adapter.archive_old_messages(user_id, messages_to_compress)
            
            await self.db_adapter.delete_old_messages(user_id, messages_to_compress)
            
            # Update for context building
            long_term_memory = new_memory
            was_compressed = True
            
        else:
            # No compression needed, use all messages as active context
            active_context = messages
            self.logger.info(f"No compression needed: {len(messages)} messages")
        
        # 7. Build final context
        enhanced_prompt, active_context_dicts = self.rolling_memory.build_chat_context(
            long_term_memory,
            active_context,
            base_system_prompt
        )
        
        self.logger.info(
            f"Context prepared: {len(active_context_dicts)} active messages, "
            f"{len(long_term_memory)} chars of memory"
        )
        
        return enhanced_prompt, active_context_dicts, was_compressed


# ============================================================================
# MIGRATION HELPER
# ============================================================================

async def add_long_term_memory_column_migration():
    """
    SQL migration to add the long_term_memory column to user_data table.
    
    Run this once to set up your database schema.
    """
    migration_sql = """
-- Add long_term_memory column to user_data table
ALTER TABLE IF EXISTS public.user_data
    ADD COLUMN IF NOT EXISTS long_term_memory TEXT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_data_memory 
    ON public.user_data (user_identifier)
    WHERE long_term_memory IS NOT NULL;

-- Optional: Create archived_chat_messages table for data retention
CREATE TABLE IF NOT EXISTS public.archived_chat_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_data_id BIGINT,
    role TEXT NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    grounding_metadata JSONB NULL,
    original_created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archived_messages_user
    ON public.archived_chat_messages (user_id, archived_at DESC);

-- Enable RLS
ALTER TABLE IF EXISTS public.archived_chat_messages
    ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "archived_messages_service_role_full_access"
    ON public.archived_chat_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
"""
    print(migration_sql)
    print("\n✅ Copy and run the above SQL in your Supabase SQL editor")


# Export main classes
__all__ = [
    "RollingMemory",
    "RollingMemoryConfig", 
    "RollingMemoryOrchestrator",
    "RollingMemorySupabaseAdapter",
    "Message",
    "add_long_term_memory_column_migration"
]
