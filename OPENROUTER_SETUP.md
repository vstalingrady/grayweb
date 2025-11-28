# OpenRouter Integration - Quick Start

OpenRouter support has been successfully added to your Gray backend! 🎉

## What Was Added

### 1. **OpenRouter Client** (`backend/openrouter_client.py`)
A full-featured OpenRouter service client supporting:
- Multiple LLM models (Claude, GPT, Grok, DeepSeek, Kimi, etc.)
- Streaming and standard generation
- Conversation history management
- Custom system prompts
- Model shorthand names for Pioneer tier

### 2. **Environment Configuration** (`.env.example`)
Updated with OpenRouter settings:
```bash
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_MAX_TOKENS=4096
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_SITE_NAME=Gray
```

### 3. **Backend Integration** (`backend/main.py`)
- Imported `OpenRouterService`
- Initialized `OPENROUTER_SERVICE` instance (available globally)

### 4. **Documentation**
- **Full guide**: `backend/OPENROUTER_INTEGRATION.md`
- **Usage examples**: `backend/openrouter_example.py`

## Getting Started

### Step 1: Get Your OpenRouter API Key

1. Visit [https://openrouter.ai/](https://openrouter.ai/)
2. Sign up or log in
3. Go to **Keys** section
4. Create a new API key
5. Copy it (starts with `sk-or-v1-...`)

### Step 2: Add to Environment

Add your API key to `.env`:

```bash
# Add this line to your .env file
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
```

### Step 3: Use in Your Code

```python
from openrouter_client import OpenRouterService

# Service is already initialized in main.py as OPENROUTER_SERVICE
service = OPENROUTER_SERVICE

# Generate a response
if service.available:
    response = await service.generate(
        message="Hello!",
        model="claude-4.5"  # Shorthand for anthropic/claude-opus-4.5
    )
```

## Supported Models (Pioneer Tier)

| Shorthand | Full Model ID | Provider |
|-----------|---------------|----------|
| `claude-4.5` | `anthropic/claude-opus-4.5` | Anthropic |
| `grok-4.1` | `x-ai/grok-4.1` | xAI |
| `gpt-5.1` | `openai/gpt-5.1-preview` | OpenAI |
| `deepseek-v3.2` | `deepseek/deepseek-chat-v3.2` | DeepSeek |
| `kimi-k2` | `moonshot/kimi-k2-thinking` | Moonshot |

See [OpenRouter Models](https://openrouter.ai/models) for the complete list.

## Testing the Integration

Run the example script to test everything works:

```bash
cd /home/ubuntu/gray
python3 backend/openrouter_example.py
```

This will run through various usage examples if your API key is configured.

## Next Steps

1. **Add your API key** to `.env`
2. **Read the full docs** in `backend/OPENROUTER_INTEGRATION.md`
3. **Try the examples** in `backend/openrouter_example.py`
4. **Integrate into your chat routes** to enable model switching for Pioneer users

## File Reference

- `backend/openrouter_client.py` - Main client implementation
- `backend/OPENROUTER_INTEGRATION.md` - Complete documentation
- `backend/openrouter_example.py` - Usage examples
- `.env.example` - Environment template (updated)
- `backend/main.py` - Service initialization (updated)

## Support

- OpenRouter Documentation: https://openrouter.ai/docs
- OpenRouter Models: https://openrouter.ai/models
- OpenRouter Dashboard: https://openrouter.ai/dashboard

---

**Ready to use!** Add your API key to get started with OpenRouter integration.
