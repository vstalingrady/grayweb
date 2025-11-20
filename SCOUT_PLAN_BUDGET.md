# Scout Plan Budget Allocation

## Overview
The Scout plan now has a **$0.1875 per month** budget allocation per user, with automatic cascading limits to ensure fair usage and cost control.

## Budget Breakdown

### Monthly Budget
- **Total**: $0.1875/month per user

### Weekly Allocation
- **Formula**: Monthly ÷ 4
- **Amount**: $0.046875/week
- **Purpose**: Prevents users from burning through their entire monthly allowance in a few days

### 6-Hour Window Allocation
- **Formula**: Weekly ÷ 10
- **Amount**: $0.0046875 per 6-hour block
- **Purpose**: Prevents burst usage that could drain the entire week's budget in one sitting
- **Note**: There are 28 six-hour blocks in a week (168 hours ÷ 6 = 28), so setting the limit to 1/10th of weekly gives users ~3x the average steady-state rate for burst usage

## How It Works

### Automatic Resets
1. **6-Hour Windows**: Reset every 6 hours (00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-24:00 UTC)
2. **Weekly**: Resets every Monday at 00:00 UTC
3. **Monthly**: Resets on the 1st of each month at 00:00 UTC

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
- **Weekly**: ~117,188 tokens
- **Per 6-hour window**: ~11,719 tokens

This translates to roughly:
- **~3-5 medium conversations per 6-hour window** (depending on complexity)
- **~20-30 conversations per week**
- **~80-120 conversations per month**

## Implementation Details

All logic is handled in `/backend/usage_tracker.py`:
- `check_limits()` - Called BEFORE every AI API request
- `track_usage()` - Called AFTER every successful AI response to log actual usage
- Automatic counter resets based on time windows

## Database Tracking

The user table tracks:
- `monthly_cost_usage` - Running total for the month
- `weekly_cost_usage` - Running total for the week
- `six_hour_cost_usage` - Running total for current 6-hour block
- `last_monthly_reset` - Last month reset date
- `last_weekly_reset` - Last week reset date
- `last_six_hour_reset` - Last 6-hour block identifier (format: "YYYY-MM-DD-{0-3}")

## Upgrade Path

Users who frequently hit limits are encouraged to upgrade to:
- **Voyager**: $6.00/month (32x more budget)
- **Pioneer**: $24.00/month (128x more budget)
