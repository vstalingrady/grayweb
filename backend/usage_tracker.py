import datetime
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Gemini 1.5 Flash Pricing (approximate)
PRICE_INPUT_PER_MILLION = 0.075
PRICE_OUTPUT_PER_MILLION = 0.30

LIMITS = {
    "scout": {
        "monthly_cost": 1.50,
    },
    "voyager": {
        "monthly_cost": 6.00,
    },
    "pioneer": {
        "monthly_cost": 24.00,
    }
}

# Add default sub-limits logic
def get_limits_for_tier(tier: str):
    base = LIMITS.get(tier, LIMITS["scout"])
    monthly = base.get("monthly_cost", 1.50)
    
    # Default policies:
    # Weekly = Monthly / 4 (Standard calendar breakdown)
    # 6-Hour = Weekly / 10 (Allows burst usage, but prevents draining the whole week in one sitting. 
    #                       There are 28 6-hour blocks in a week, so 1/10 is ~3x the average steady-state rate)
    return {
        "monthly_cost": monthly,
        "weekly_cost": monthly / 4.0,
        "six_hour_cost": (monthly / 4.0) / 10.0
    }

class UsageLimitExceeded(Exception):
    def __init__(self, message: str, tier: str):
        self.message = message
        self.tier = tier
        super().__init__(message)

class UsageTracker:
    def __init__(self, db):
        self.db = db

    async def _get_user_usage(self, user_id: int):
        query = """
            SELECT plan_tier, daily_token_usage, monthly_cost_usage, last_daily_reset, last_monthly_reset,
                   weekly_cost_usage, last_weekly_reset, six_hour_cost_usage, last_six_hour_reset
            FROM users WHERE id = :id
        """
        return await self.db.fetch_one(query=query, values={"id": user_id})

    async def _reset_counters_if_needed(self, user_id: int, usage_data):
        now = datetime.datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        
        updates = {}
        
        # 1. Daily Reset (Legacy token counter)
        last_daily = usage_data["last_daily_reset"]
        if last_daily != today_str:
            updates["daily_token_usage"] = 0
            updates["last_daily_reset"] = today_str

        # 2. Monthly Reset
        last_monthly = usage_data["last_monthly_reset"]
        current_month_prefix = today_str[:7] # YYYY-MM
        last_month_prefix = (last_monthly or "")[:7]
        
        if current_month_prefix != last_month_prefix:
            updates["monthly_cost_usage"] = 0.0
            updates["last_monthly_reset"] = today_str

        # 3. Weekly Reset
        # We check if the ISO calendar week has changed or if it's been > 7 days.
        # Simplest approach: Store the date of last reset. If (now - last_reset).days >= 7, reset.
        # Or align with Monday. Let's align with Monday for consistency.
        last_weekly = usage_data["last_weekly_reset"]
        current_week_number = now.isocalendar()[1]
        
        should_reset_weekly = False
        if not last_weekly:
            should_reset_weekly = True
        else:
            try:
                last_weekly_date = datetime.datetime.strptime(last_weekly, "%Y-%m-%d")
                # If week number changed or year changed
                if last_weekly_date.isocalendar()[1] != current_week_number or last_weekly_date.year != now.year:
                    should_reset_weekly = True
            except ValueError:
                should_reset_weekly = True

        if should_reset_weekly:
            updates["weekly_cost_usage"] = 0.0
            updates["last_weekly_reset"] = today_str

        # 4. 6-Hour Reset
        # We group time into 4 blocks: 00-06, 06-12, 12-18, 18-24.
        # We check if the current block is different from the last stored block.
        # We store the full timestamp ISO string to compare.
        last_six_hour = usage_data["last_six_hour_reset"] # ISO string
        
        current_block_index = now.hour // 6
        current_block_id = f"{today_str}-{current_block_index}" # e.g. 2023-10-27-1 (06:00-12:00)
        
        should_reset_six_hour = False
        if not last_six_hour:
            should_reset_six_hour = True
        else:
            # We simply store the block ID in the column for simplicity? 
            # The column is TEXT. Let's assume it stores the block ID we just invented.
            # Or if it stores a date, we parse it. 
            # Let's stick to storing the Block ID string to avoid parsing ambiguity.
            if last_six_hour != current_block_id:
                should_reset_six_hour = True
        
        if should_reset_six_hour:
            updates["six_hour_cost_usage"] = 0.0
            updates["last_six_hour_reset"] = current_block_id

        if updates:
            set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
            query = f"UPDATE users SET {set_clauses} WHERE id = :id"
            updates["id"] = user_id
            await self.db.execute(query=query, values=updates)
            
            new_data = dict(usage_data)
            new_data.update(updates)
            return new_data
            
        return usage_data

    async def check_limits(self, user_id: int):
        usage_data = await self._get_user_usage(user_id)
        if not usage_data:
            return 
            
        usage_data = await self._reset_counters_if_needed(user_id, usage_data)
        
        tier = (usage_data["plan_tier"] or "scout").lower()
        limits = get_limits_for_tier(tier)
        
        # Check Monthly
        current_monthly = usage_data["monthly_cost_usage"] or 0.0
        if current_monthly >= limits["monthly_cost"]:
            raise UsageLimitExceeded(f"Monthly cost limit of ${limits['monthly_cost']:.2f} reached.", tier)

        # Check Weekly
        current_weekly = usage_data["weekly_cost_usage"] or 0.0
        if current_weekly >= limits["weekly_cost"]:
             raise UsageLimitExceeded(f"Weekly cost limit of ${limits['weekly_cost']:.2f} reached.", tier)

        # Check 6-Hour
        current_six_hour = usage_data["six_hour_cost_usage"] or 0.0
        if current_six_hour >= limits["six_hour_cost"]:
             raise UsageLimitExceeded(f"6-hour burst limit of ${limits['six_hour_cost']:.2f} reached.", tier)

    async def track_usage(self, user_id: int, input_tokens: int, output_tokens: int):
        cost = (input_tokens * PRICE_INPUT_PER_MILLION / 1_000_000) + \
               (output_tokens * PRICE_OUTPUT_PER_MILLION / 1_000_000)
               
        total_tokens = input_tokens + output_tokens
        
        query = """
            UPDATE users 
            SET daily_token_usage = COALESCE(daily_token_usage, 0) + :tokens,
                monthly_cost_usage = COALESCE(monthly_cost_usage, 0) + :cost,
                weekly_cost_usage = COALESCE(weekly_cost_usage, 0) + :cost,
                six_hour_cost_usage = COALESCE(six_hour_cost_usage, 0) + :cost
            WHERE id = :id
        """
        await self.db.execute(query=query, values= {
            "id": user_id,
            "tokens": total_tokens,
            "cost": cost
        })
