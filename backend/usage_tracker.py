import datetime
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Gemini 1.5 Flash Pricing (approximate)
PRICE_INPUT_PER_MILLION = 0.10
PRICE_OUTPUT_PER_MILLION = 0.40

LIMITS = {
    "scout": {
        "monthly_cost": 0.1875,
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
    # 6-Hour = Monthly / 120 (30 days × 4 six-hour blocks per day)
    # This gives each 6-hour window an equal portion of the monthly budget
    return {
        "monthly_cost": monthly,
        "six_hour_cost": monthly / 120.0
    }

class UsageLimitExceeded(Exception):
    def __init__(self, message: str, tier: str, next_reset_time: Optional[datetime.datetime] = None):
        self.message = message
        self.tier = tier
        self.next_reset_time = next_reset_time
        super().__init__(message)

class UsageTracker:
    def __init__(self, db):
        self.db = db

    async def _get_user_usage(self, user_id: int):
        query = """
            SELECT plan_tier, daily_token_usage, monthly_cost_usage, last_daily_reset, last_monthly_reset,
                   six_hour_cost_usage, last_six_hour_reset
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

        # 3. 6-Hour Reset
        last_six_hour = usage_data["last_six_hour_reset"]
        current_block_index = now.hour // 6
        current_block_id = f"{today_str}-{current_block_index}"
        
        should_reset_six_hour = False
        if not last_six_hour:
            should_reset_six_hour = True
        else:
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
        now = datetime.datetime.utcnow()
        
        # Check Monthly
        current_monthly = usage_data["monthly_cost_usage"] or 0.0
        if current_monthly >= limits["monthly_cost"]:
            if now.month == 12:
                next_reset = datetime.datetime(now.year + 1, 1, 1)
            else:
                next_reset = datetime.datetime(now.year, now.month + 1, 1, tzinfo=datetime.timezone.utc)
            raise UsageLimitExceeded(f"Monthly limit reached.", tier, next_reset)

        # Check 6-Hour
        current_six_hour = usage_data["six_hour_cost_usage"] or 0.0
        if current_six_hour >= limits["six_hour_cost"]:
            current_block = now.hour // 6
            next_block_hour = (current_block + 1) * 6
            
            next_reset_day = now.date()
            if next_block_hour >= 24: # If next block is past midnight
                next_reset_day += datetime.timedelta(days=1)
                next_block_hour = 0 # Reset to 00:00 for the next day

            next_reset = datetime.datetime.combine(next_reset_day, datetime.time(next_block_hour, 0, 0), tzinfo=datetime.timezone.utc)
            raise UsageLimitExceeded(f"6-hour burst limit reached.", tier, next_reset)

    async def track_usage(self, user_id: int, input_tokens: int, output_tokens: int):
        cost = (input_tokens * PRICE_INPUT_PER_MILLION / 1_000_000) + \
               (output_tokens * PRICE_OUTPUT_PER_MILLION / 1_000_000)
               
        total_tokens = input_tokens + output_tokens
        
        query = """
            UPDATE users 
            SET daily_token_usage = COALESCE(daily_token_usage, 0) + :tokens,
                monthly_cost_usage = COALESCE(monthly_cost_usage, 0) + :cost,
                six_hour_cost_usage = COALESCE(six_hour_cost_usage, 0) + :cost
            WHERE id = :id
        """
        await self.db.execute(query=query, values= {
            "id": user_id,
            "tokens": total_tokens,
            "cost": cost
        })
