# Scout Plan Budget Allocation

## Overview
The Scout plan has a **$0.1875 per month** budget allocation per user, with 6-hour rolling windows to ensure fair usage and cost control.

## Budget Breakdown

### Monthly Budget
- **Total**: $0.1875/month per user

### 6-Hour Window Allocation
- **Formula**: Monthly ÷ 120 (30 days × 4 six-hour blocks per day)
- **Amount**: $0.0015625 per 6-hour block
- **Purpose**: Spreads the monthly budget equally across all 6-hour blocks in the month

## How It Works

### Automatic Resets
1. **6-Hour Windows**: Reset every 6 hours (00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-24:00 UTC)
2. **Monthly**: Resets on the 1st of each month at 00:00 UTC

### Limits Enforced
- **6-Hour Limit**: Primary throttle - once you spend $0.0015625 in a 6-hour window, wait for the next window
- **Monthly Limit**: Hard cap - once you spend $0.1875 in a month, wait for next month

### What Happens When a Limit is Reached

When a Scout user hits their 6-hour limit:
1. The AI will **immediately stop generating responses**
2. A user-friendly message is displayed explaining:
   - Which tier they're on (Scout)
   - What limit was reached (6-hour burst limit)
   - When the next reset will occur (e.g., "Limit resets at 2025-11-21 06:00 UTC")
   - Suggestion to upgrade or wait

### Example Limit Message
```
**Usage Limit Reached**

I've hit the usage cap for your **Scout** plan. 6-hour burst limit reached.

Limit resets at 2025-11-21 06:00 UTC.

To keep chatting without interruption, consider upgrading to a higher tier, or wait for the limit to reset.
```

## Gemini API Pricing (Current Rates)
- **Input tokens**: $0.10 per million tokens
- **Output tokens**: $0.40 per million tokens

## Approximate Token Budget for Scout Users

With the $0.1875/month budget:
- **Monthly**: ~468,750 input tokens OR ~468,750 output tokens (weighted average)
- **Per 6-hour window**: ~3,906 tokens

This translates to roughly:
- **~1-2 medium conversations per 6-hour window** (depending on complexity)
- **~120-240 conversations per month** (if evenly distributed)

## Implementation Details

All logic is handled in `/backend/usage_tracker.py`:
- `check_limits()` - Called BEFORE every AI API request
- `track_usage()` - Called AFTER every successful AI response to log actual usage
- Automatic counter resets based on time windows

## Database Tracking

The user table tracks:
- `monthly_cost_usage` - Running total for the month
- `six_hour_cost_usage` - Running total for current 6-hour block
- `last_monthly_reset` - Last month reset date
- `last_six_hour_reset` - Last 6-hour block identifier (format: "YYYY-MM-DD-{0-3}")

## Upgrade Path

Users who frequently hit limits are encouraged to upgrade to:
- **Voyager**: $6.00/month (32x more budget)
- **Pioneer**: $24.00/month (128x more budget)

