# OpenRouter Integration

This Gray backend now includes OpenRouter support for accessing a variety of cutting-edge AI models through a single API.

## What is OpenRouter?

OpenRouter is a unified API that provides access to multiple LLM providers including:
- Anthropic Claude models (Claude 4.5, Claude 3.5 Sonnet, etc.)
- OpenAI GPT models (GPT-5.1, GPT-4, etc.)
- xAI Grok models (Grok 4.1, etc.)
- DeepSeek models (DeepSeek V3.2, etc.)
- Moonshot Kimi models (Kimi K2 Thinking, etc.)
- And many more!

## Configuration

### 1. Get Your OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up or log in
3. Navigate to your API Keys section
4. Create a new API key
5. Copy the key (it starts with `sk-or-v1-...`)

### 2. Add to Environment Variables

Add your OpenRouter API key to your `.env` file:

```bash
# OpenRouter (for Pioneer tier model switching)
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_MAX_TOKENS=4096
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_SITE_NAME=Gray
```

### Environment Variables Explained

- **OPENROUTER_API_KEY** (required): Your OpenRouter API key
- **OPENROUTER_DEFAULT_MODEL** (optional): Default model to use. Defaults to `anthropic/claude-3.5-sonnet`
- **OPENROUTER_MAX_TOKENS** (optional): Maximum tokens in response. Defaults to `4096`
- **OPENROUTER_TEMPERATURE** (optional): Model temperature (0.0-1.0). Defaults to `0.7`
- **OPENROUTER_SITE_NAME** (optional): Site name for OpenRouter analytics. Defaults to `Gray`

## Usage

### Gray Tier Integration

OpenRouter is now integrated across Gray's tier system:

#### **Scout (Free) Tier - Gray Lite**
Uses OpenRouter's **free Grok 4.1 Fast** model (`x-ai/grok-4.1-fast:free`) by default. This provides fast, capable responses at no API cost for free tier users.

#### **Voyager Tier**
Uses Gemini 2.5 Flash (Base) and limited Gemini 3 Pro access.

#### **Pioneer Tier - Model Switching**
Full access to premium model catalog with the following shorthand model names:

- `claude-4.5` or `claude-sonnet-4.5` → `anthropic/claude-sonnet-4.5` (OpenRouter)
- `gpt-5.1` → `openai/gpt-5.1` (OpenRouter)
- `deepseek-v3.2` → `deepseek/deepseek-v3.2-exp` (OpenRouter)
- `kimi-k2` → `moonshotai/kimi-k2-thinking` (OpenRouter)
- Gemini 3: `models/gemini-3-pro-preview` (Direct Gemini API, not OpenRouter)

### Using OpenRouter in the Backend

The `OpenRouterService` is available as `OPENROUTER_SERVICE` in your backend code:

```python
from openrouter_client import OpenRouterService

# Initialize (already done in main.py)
service = OpenRouterService()

# Check if available
if service.available:
    # Generate a response
    response = await service.generate(
        message="What is quantum computing?",
        conversation_history=[],
        model="claude-4.5"  # Use shorthand or full model ID
    )
    
    # Stream a response
    async for chunk in service.stream(
        message="Explain neural networks",
        conversation_history=[],
        model="gpt-5.1"
    ):
        print(chunk, end="", flush=True)
```

### Full Model IDs

You can also use full OpenRouter model IDs directly:

```python
response = await service.generate(
    message="Hello!",
    model="anthropic/claude-3.5-sonnet"
)
```

See the [OpenRouter Models](https://openrouter.ai/models) page for a complete list of available models.

## Features

- **Streaming Support**: Real-time token streaming for responsive UX
- **Conversation History**: Maintains context across multi-turn conversations
- **System Prompts**: Supports custom system instructions and workspace context
- **Model Flexibility**: Easy model switching with shorthand names
- **Error Handling**: Robust error handling with clear error messages

## Cost Management

OpenRouter models have different pricing. Always check the [OpenRouter pricing page](https://openrouter.ai/models) for current rates. The service uses your OpenRouter credits, which you can monitor in your OpenRouter dashboard.

## Troubleshooting

### "OpenRouter client is not configured"

- Check that `OPENROUTER_API_KEY` is set in your `.env` file
- Ensure the API key is valid and starts with `sk-or-v1-`
- Restart your backend server after adding the key

### HTTP 401 Unauthorized

- Your API key may be invalid or expired
- Generate a new key from the OpenRouter dashboard

### HTTP 402 Payment Required

- Your OpenRouter account has insufficient credits
- Add credits to your OpenRouter account

### Model Not Found

- Check that the model ID is correct
- Visit https://openrouter.ai/models for available models
- Some models may require special access or additional credits

## Integration with Gray Tiers

- **Scout (Free)**: Uses Gemini Lite models only
- **Voyager**: Uses Gemini Base + limited Gemini Pro
- **Pioneer**: Full access to OpenRouter model switching

The Pioneer tier provides the most flexibility with access to cutting-edge models from multiple providers.

## See Also

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter Models](https://openrouter.ai/models)
- [Gray Pricing Plans](/pricing)
