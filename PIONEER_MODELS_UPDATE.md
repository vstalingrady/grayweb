# Pioneer Tier Models - Updated Configuration

## ✅ Changes Applied

### Updated Pioneer Tier Models

The Pioneer tier now has the correct model lineup:

| Model Name | Shorthand | Full ID | Provider |
|------------|-----------|---------|----------|
| **Claude Sonnet 4.5** | `claude-4.5` or `claude-sonnet-4.5` | `anthropic/claude-sonnet-4.5` | OpenRouter |
| **Gemini 3** | Use directly | `models/gemini-3-pro-preview` | Gemini API (direct) |
| **GPT 5.1** | `gpt-5.1` | `openai/gpt-5.1` | OpenRouter |
| **DeepSeek V3.2 Exp** | `deepseek-v3.2` | `deepseek/deepseek-v3.2-exp` | OpenRouter |
| **Kimi K2 Thinking** | `kimi-k2` | `moonshotai/kimi-k2-thinking` | OpenRouter |

### Files Updated

1. **`backend/openrouter_client.py`**
   - Updated `MODEL_MAPPINGS` with correct model IDs
   - Changed default to `anthropic/claude-sonnet-4.5`
   - Added note about Gemini 3 being handled via direct Gemini API

2. **`.env.example`**
   - Updated `OPENROUTER_DEFAULT_MODEL=anthropic/claude-sonnet-4.5`

3. **`src/app/pricing/PricingPlansSection.tsx`**
   - Changed from: "OpenRouter: Claude 4.5, Grok 4.1, GPT 5.1, DeepSeek V3.2, Kimi K2 Thinking"
   - To: "Claude Sonnet 4.5, Gemini 3, GPT 5.1, DeepSeek V3.2, Kimi K2 Thinking"

4. **`backend/OPENROUTER_INTEGRATION.md`**
   - Updated documentation with correct model list
   - Added note about Gemini 3 using direct API

## Model Provider Strategy

### OpenRouter Models (Pioneer)
- Claude Sonnet 4.5
- GPT 5.1
- DeepSeek V3.2 Exp
- Kimi K2 Thinking

### Direct Gemini API (Pioneer)
- Gemini 3: `models/gemini-3-pro-preview`
  - This uses the existing `GEMINI_SERVICE` in `main.py`
  - Not routed through OpenRouter

### OpenRouter Free (Scout/Lite)
- Grok 4.1 Fast: `x-ai/grok-4.1-fast:free`

## Usage Examples

```python
# Pioneer tier - OpenRouter models
await OPENROUTER_SERVICE.stream(
    message="Hello",
    model="claude-sonnet-4.5"  # Claude Sonnet 4.5
)

await OPENROUTER_SERVICE.stream(
    message="Hello",
    model="gpt-5.1"  # GPT 5.1
)

# Pioneer tier - Gemini 3 (direct API)
await GEMINI_SERVICE.stream(
    message="Hello",
    model="models/gemini-3-pro-preview"  # Gemini 3
)

# Scout tier - Free Grok
await OPENROUTER_SERVICE.stream(
    message="Hello",
    model="lite"  # Grok 4.1 Fast (free)
)
```

## Key Points

✅ **Removed**: Grok 4.1 from Pioneer tier (it was replaced)
✅ **Added**: Correct model IDs (claude-sonnet-4.5, gpt-5.1, deepseek-v3.2-exp, moonshotai/kimi-k2-thinking)
✅ **Clarified**: Gemini 3 uses direct Gemini API, not OpenRouter
✅ **Updated**: Default Pioneer model is now Claude Sonnet 4.5
✅ **Fixed**: Pricing page now shows clean model list without "OpenRouter:" prefix

## Next Steps

When implementing the chat routing logic, remember:
- For Pioneer tier + OpenRouter models → use `OPENROUTER_SERVICE`
- For Pioneer tier + Gemini 3 → use `GEMINI_SERVICE`
- For Scout tier (lite) → use `OPENROUTER_SERVICE` with `model="lite"`
- For Voyager tier → use `GEMINI_SERVICE`
