# Rolling Memory - Quick Reference Cheat Sheet

> **TL;DR**: Infinite AI memory for the cost of ~10 messages 🚀

---

## 🚀 30-Second Setup

```bash
# 1. Run SQL migration in Supabase
supabase/migrations/20251121000000_rolling_memory_system.sql

# 2. Add to main.py startup
from rolling_memory import RollingMemoryOrchestrator

rolling_memory = RollingMemoryOrchestrator(
    gemini_client=gemini,
    supabase_client=supabase
)

# 3. Update chat endpoint
enhanced_prompt, history, compressed = \
    await rolling_memory.prepare_chat_context(user_id, base_prompt)
```

**Done!** 🎉

---

## 📊 How It Works

```
Messages in DB    Action
--------------    ------
1-10 messages  →  Keep all raw (no compression)
11+ messages   →  Compress old → Keep last 5 raw
100+ messages  →  Still just last 5 + summary!
```

**Cost per turn**: `~500 tokens (summary) + 5 msgs × 200 = ~1,500 tokens`

---

## 🔧 Configuration Options

```python
config = RollingMemoryConfig()

config.MESSAGE_THRESHOLD = 10      # When to compress
config.ACTIVE_CONTEXT_SIZE = 5     # Recent msgs to keep

# Custom prompts
config.COMPRESSION_SYSTEM_PROMPT = "Your prompt..."
config.COMPRESSION_USER_PROMPT_TEMPLATE = "Your template..."
```

---

## 📁 Files Created

```
backend/
├── rolling_memory.py                      # Main implementation
├── rolling_memory_integration_example.py  # How to integrate
└── test_rolling_memory.py                 # Test suite

supabase/migrations/
└── 20251121000000_rolling_memory_system.sql  # DB migration

ROLLING_MEMORY.md                          # Full documentation
ROLLING_MEMORY_CHEATSHEET.md              # This file
```

---

## 🎯 Key Functions

### Prepare Context (Main Function)
```python
enhanced_prompt, active_context, was_compressed = \
    await orchestrator.prepare_chat_context(
        user_id=123,
        base_system_prompt="You are Gray"
    )

# Use enhanced_prompt as your system prompt
# Use active_context as conversation history
```

### Manual Compression
```python
memory = await orchestrator.rolling_memory.compress_messages(
    messages=old_messages,
    previous_memory=existing_memory
)
```

### Load Memory
```python
memory = await orchestrator.db_adapter.load_long_term_memory(user_id)
```

### Save Memory
```python
await orchestrator.db_adapter.save_long_term_memory(user_id, memory)
```

---

## 🗂️ Database Tables

### `user_data.long_term_memory`
- **Type**: `TEXT`
- **Purpose**: Stores compressed conversation summary
- **Max Size**: PostgreSQL default (1GB, but usually <10KB)

### `archived_chat_messages` (optional)
- **Purpose**: Archive old messages instead of deleting
- **Retention**: Use `cleanup_old_archived_messages(90)` to delete after 90 days

---

## 🔍 SQL Queries

### View All Users' Memory Status
```sql
SELECT * FROM public.rolling_memory_overview 
ORDER BY active_messages DESC;
```

### Get Stats for One User
```sql
SELECT * FROM public.get_rolling_memory_stats(123);
```

### Cleanup Old Archives
```sql
SELECT * FROM public.cleanup_old_archived_messages(90);
```

---

## 📡 API Endpoints (Optional)

```http
GET    /api/memory/{user_id}           # View memory
POST   /api/compress-memory/{user_id}  # Force compress
DELETE /api/memory/{user_id}           # Clear memory
```

---

## 🐛 Debugging

### Check if compression triggered
```python
if was_compressed:
    print(f"✅ Compressed for user {user_id}")
else:
    print(f"ℹ️ No compression needed ({len(messages)} messages)")
```

### View current memory
```python
memory = await orchestrator.db_adapter.load_long_term_memory(user_id)
print(f"Memory: {memory[:200]}...")
```

### Count active messages
```python
messages = await orchestrator.db_adapter.load_message_history(user_id)
print(f"Active: {len(messages)} messages")
```

---

## ⚡ Performance Tips

1. **Enable archiving for compliance**: `enable_archiving=True`
2. **Disable archiving for performance**: `enable_archiving=False`
3. **Adjust threshold by tier**:
   ```python
   if tier == "scout":
       config.MESSAGE_THRESHOLD = 5
   elif tier == "voyager":
       config.MESSAGE_THRESHOLD = 10
   else:  # pioneer
       config.MESSAGE_THRESHOLD = 20
   ```

---

## 💰 Cost Calculator

```
Traditional (all history):
- 100 messages × 200 tokens = 20,000 tokens/turn
- Cost: $0.030/turn

Rolling Memory:
- Summary: 500 tokens
- Active: 5 messages × 200 = 1,000 tokens  
- Total: 1,500 tokens/turn
- Cost: $0.0023/turn

SAVINGS: 93% cheaper! 💰
```

---

## 🔐 Security Checklist

- [ ] Long-term memory may contain PII → Consider encryption
- [ ] RLS policies enabled (done by migration)
- [ ] Set up retention policies for archives
- [ ] Monitor memory size (alert if > 10KB)
- [ ] Audit compression quality regularly

---

## 🚨 Common Issues

### "Column long_term_memory does not exist"
**Solution**: Run the SQL migration

### "No compression happening"
**Check**:
1. `conversation_id.startswith("general:")`?
2. `rolling_memory_orchestrator` initialized?
3. More than 10 messages?

### "Memory is not persisting"
**Check**:
1. Supabase permissions (service_role)
2. `user_data` table accessible
3. No errors in logs

---

## 📚 Full Docs

See `ROLLING_MEMORY.md` for:
- Architecture diagrams
- Advanced use cases  
- Troubleshooting guide
- Best practices
- Performance metrics

---

## 🎓 Learn More

### Key Concepts

**Active Context**: Last N messages kept as-is (default: 5)  
**Long-Term Memory**: Compressed summary of old messages  
**Compression**: Using Gemini to create dense summaries  
**Archiving**: Optionally keep old messages for compliance

### Flow

```
User sends message 
→ Check message count
→ If > 10: compress old messages
→ Update long-term memory
→ Delete/archive old messages
→ Build context (memory + last 5)
→ Send to Gemini
→ Generate response
```

---

## ✅ Production Checklist

Before deploying:

- [ ] SQL migration run in production Supabase
- [ ] Environment variables set (GEMINI_API_KEY)
- [ ] Orchestrator initialized in app startup
- [ ] Chat endpoints updated to use `prepare_chat_context`
- [ ] Tests passing (`python test_rolling_memory.py`)
- [ ] Monitoring set up (check `rolling_memory_overview`)
- [ ] Retention policy configured (if using archiving)
- [ ] Cost tracking enabled
- [ ] User-facing memory view (optional)

---

## 🎉 Quick Wins

After setup, you'll have:

✅ **Infinite context** - Never lose conversation history  
✅ **90% cost savings** - Compared to storing all messages  
✅ **Better UX** - AI remembers everything  
✅ **Scalable** - Works for 10 or 10,000 messages  
✅ **Flexible** - Easy to customize thresholds  
✅ **Observable** - Built-in monitoring views  

---

## 🆘 Need Help?

1. Check `ROLLING_MEMORY.md` (full docs)
2. Look at `rolling_memory_integration_example.py` (examples)
3. Run `test_rolling_memory.py` (verify setup)
4. Review SQL migration (database schema)
5. Check logs for errors

---

**Pro tip**: Start with defaults, then optimize based on your usage patterns! 🚀

---

*Built with ❤️ for Master Vstalin Grady*
