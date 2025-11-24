# Chat Persistence Audit & Fixes

## Current Status

The codebase already has comprehensive chat persistence infrastructure:

### Backend (✅ Already Implemented)
1. **Database Schema**: `user_chat_threads` and `user_chat_messages` tables in Supabase
2. **API Functions**:
   - `get_or_create_conversation()` - creates/retrieves conversation threads
   - `save_conversation_message()` - persists individual messages
   - `_load_conversation_history()` - retrieves message history
3. **General Chat**: Special handling for `/g` route via `_load_general_conversation_history()`

### Frontend Routes (✅ Already Implemented)
1. **`/g`**: Server-side rendered, passes `activeChatId={GENERAL_CHAT_SESSION_ID}`
2. **`/c/[chatId]`**: Server-side rendered, passes `activeChatId={chatId}` from URL param
3. Both routes check for session and redirect to login if needed

## Potential Issues to Verify

### 1. Message Persistence Flow
**Check**: Are messages being saved when sent?
- Location: `GrayPageClient.tsx` - look for where chat messages are sent
- Expected: Should call backend API to save after each message

### 2. History Loading on Mount
**Check**: Is conversation history being loaded when the component mounts?
- Location: `GrayPageClient.tsx` - `useEffect` that depends on `activeChatId`
- Expected: Should fetch messages from backend when `activeChatId` changes

### 3. Session State Management
**Check**: Are chat sessions being properly tracked in state?
- Location: `components/gray/ChatProvider` or similar
- Expected: Should maintain sessions array and sync with Supabase

## Action Items

### Fix #1: Ensure Messages Are Being Saved
```typescript
// In GrayPageClient.tsx or chat submission handler
const handleSendMessage = async (message: string) => {
  // ... send message to AI ...
  
  // CRITICAL: Save to backend
  if (currentChatId) {
    await apiService.saveMessage(currentChatId, {
      role: 'user',
      text: message
    });
    
    // After AI response
    await apiService.saveMessage(currentChatId, {
      role: 'assistant',
      text: aiResponse
    });
  }
};
```

### Fix #2: Load History on Mount
```typescript
// In GrayPageClient.tsx
useEffect(() => {
  if (!activeChatId) return;
  
  const loadHistory = async () => {
    try {
      const history = await apiService.getChatHistory(activeChatId);
      // Update local state with history
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };
  
  loadHistory();
}, [activeChatId]);
```

### Fix #3: Create Missing API Methods
```typescript
// In lib/api/apiService.ts
export const apiService = {
  // ... existing methods ...
  
  async getChatHistory(conversationId: string) {
    const response = await fetch(`/api/backend/chat/history/${conversationId}`);
    if (!response.ok) throw new Error('Failed to load chat history');
    return response.json();
  },
  
  async saveMessage(conversationId: string, message: { role: string; text: string }) {
    const response = await fetch(`/api/backend/chat/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error('Failed to save message');
    return response.json();
  },
};
```

### Fix #4: Add Backend Endpoints
```python
# In backend/main.py

@app.get("/chat/history/{conversation_id}")
async def get_chat_history(
    conversation_id: str,
    request: Request,
):
    """Load conversation history from Supabase."""
    user_id = request.user_id
    if not user_id:
        raise HTTPException(status_code=401)
    history = await _load_conversation_history(conversation_id)
    return {"messages": history}

@app.post("/chat/{conversation_id}/messages")
async def save_chat_message(
    conversation_id: str,
    message: dict,
    request: Request,
):
    """Save a single message to conversation."""
    user_id = request.user_id
    if not user_id:
        raise HTTPException(status_code=401)
    
    await save_conversation_message(
        conversation_id,
        message,
        user_id=user_id
    )
    return {"status": "saved"}
```

## Testing Checklist

- [ ] Send a message in `/g` - verify it saves to Supabase
- [ ] Refresh `/g` - verify messages are still there
- [ ] Create a new conversation `/c/[uuid]` - verify it creates a thread in Supabase
- [ ] Send messages in `/c/[uuid]` - verify they save
- [ ] Refresh `/c/[uuid]` - verify messages persist
- [ ] Check Supabase tables `user_chat_threads` and `user_chat_messages` for data

## Database Schema Verification

Ensure these tables exist in Supabase:

```sql
-- user_chat_threads
CREATE TABLE user_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier INTEGER NOT NULL,
  user_data_id INTEGER,
  title TEXT DEFAULT 'New Conversation',
  context_snapshot JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE
);

-- user_chat_messages
CREATE TABLE user_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES user_chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  text TEXT,
  grounding_metadata JSONB,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- For general chat (user-specific)
CREATE TABLE user_chat_general (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  text TEXT,
  grounding_metadata JSONB,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Next Steps

1. Find where chat messages are being sent in `GrayPageClient.tsx`
2. Verify they're calling the backend to persist
3. Add history loading logic if missing
4. Test the complete flow
