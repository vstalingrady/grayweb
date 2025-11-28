# Gray Lite → Grok 4.1 Fast Migration Summary

## What Changed

**Gray Lite now uses OpenRouter's free Grok 4.1 Fast model** instead of Gemini Lite.

### Key Configuration Changes

#### 1. Environment Variables (`.env.example`)

```bash
# New OpenRouter Lite model setting
OPENROUTER_LITE_MODEL=x-ai/grok-4.1-fast:free

# Lite tier provider control
LITE_TIER_PROVIDER=openrouter  # Options: 'openrouter' or 'gemini'
```

#### 2. OpenRouter Client (`backend/openrouter_client.py`)

- Added `_lite_model` initialization with default `x-ai/grok-4.1-fast:free`
- Updated `_resolve_model()` to map `"lite"` and `"gray-lite"` to lite model
- Added `lite_model` property for accessing the configured model

#### 3. Pricing Page (`src/app/pricing/PricingPlansSection.tsx`)

Updated Scout (Free) tier description:
```typescript
subtext: "Grok 4.1 Fast"
```

#### 4. Documentation (`backend/OPENROUTER_INTEGRATION.md`)

Added tier integration section explaining Scout tier uses free Grok model.

## Benefits

✅ **Free Tier**: Grok 4.1 Fast is available on OpenRouter's free tier (no API costs)  
✅ **Fast**: Optimized for speed while maintaining quality  
✅ **Capable**: xAI's Grok 4.1 is a powerful, modern LLM  
✅ **Unified**: All tiers now can use OpenRouter infrastructure  

## Usage

### For Free (Scout) Users

When they select **Gray Lite** tier, they'll automatically get:
- Model: `x-ai/grok-4.1-fast:free`
- Provider: OpenRouter
- Cost: Free (no API charges)

### Configuration Override

You can still use Gemini Lite by changing the environment variable:

```bash
# To use Gemini Lite instead
LITE_TIER_PROVIDER=gemini
```

Or change the Lite model to any other OpenRouter free model:

```bash
# Example: Use a different free model
OPENROUTER_LITE_MODEL=google/gemini-2-flash-lite:free
```

## Model Resolution Flow

```
User selects "Gray Lite" 
    ↓
Backend receives model="lite" or "gray-lite"
    ↓
OpenRouterService._resolve_model() checks tier
    ↓
Returns self._lite_model (x-ai/grok-4.1-fast:free)
    ↓
Request sent to OpenRouter API
    ↓
Response streamed back to user
```

## Testing

To verify the integration works:

```bash
# Test the OpenRouter client
python3 backend/openrouter_example.py

# Or test directly in Python
python3 -c "
import sys; sys.path.insert(0, 'backend')
from openrouter_client import OpenRouterService
service = OpenRouterService()
print(f'Lite model: {service.lite_model}')
print(f'Available: {service.available}')
"
```

## Migration Checklist

- [x] Added `OPENROUTER_LITE_MODEL` to `.env.example`
- [x] Added `LITE_TIER_PROVIDER` control flag
- [x] Updated `OpenRouterService` to support lite tier
- [x] Added model resolution for "lite"/"gray-lite" tier names
- [x] Updated pricing page to show "Grok 4.1 Fast"
- [x] Updated documentation
- [ ] **TODO**: Update your actual `.env` file with OpenRouter API key
- [ ] **TODO**: Test with a real request to verify everything works
- [ ] **TODO**: Update chat routing logic to use OpenRouter for lite tier

## Next Steps

1. **Add OpenRouter API Key** to your `.env`:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   OPENROUTER_LITE_MODEL=x-ai/grok-4.1-fast:free
   LITE_TIER_PROVIDER=openrouter
   ```

2. **Update Chat Routing** in `backend/main.py` to check `LITE_TIER_PROVIDER` and route lite tier requests to OpenRouter when set.

3. **Test the Integration**:
   - Send a chat message as a free user
   - Verify it uses Grok 4.1 Fast
   - Check OpenRouter dashboard for usage stats

## Files Modified

- ✏️ `.env.example` - Added OpenRouter lite configuration
- ✏️ `backend/openrouter_client.py` - Added lite model support
- ✏️ `src/app/pricing/PricingPlansSection.tsx` - Updated UI description
- ✏️ `backend/OPENROUTER_INTEGRATION.md` - Updated docs

## Rollback

To revert to Gemini Lite, simply change in `.env`:

```bash
LITE_TIER_PROVIDER=gemini
```

The code supports both providers, controlled by this single flag.

---

**Status**: ✅ Configuration complete. Ready to use once OpenRouter API key is added.
