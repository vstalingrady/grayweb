import datetime
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Gemini 1.5 Flash Pricing (approximate)
PRICE_INPUT_PER_MILLION = 0.075
PRICE_OUTPUT_PER_MILLION = 0.30

LIMITS = {
    "scout": {
        "daily_tokens": 32000,
    },
    "voyager": {
        "monthly_cost": 10.00,
    },
    "pioneer": {
        "monthly_cost": 25.00,
    }
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
        query = "SELECT plan_tier, daily_token_usage, monthly_cost_usage, last_daily_reset, last_monthly_reset FROM users WHERE id = :id"
        return await self.db.fetch_one(query=query, values={"id": user_id})

    async def _reset_counters_if_needed(self, user_id: int, usage_data):
        now = datetime.datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        month_str = now.strftime("%Y-%m")

        last_daily = usage_data["last_daily_reset"]
        last_monthly = usage_data["last_monthly_reset"]
        
        updates = {}
        
        # Check daily reset
        if last_daily != today_str:
            updates["daily_token_usage"] = 0
            updates["last_daily_reset"] = today_str
            
        # Check monthly reset (simple check: if month string changes)
        # Note: last_monthly_reset should be stored as YYYY-MM or similar to track month changes easily, 
        # or we parse the date. If we store full date, we check if month changed.
        # Let's assume we store YYYY-MM-DD, check if YYYY-MM is different.
        
        current_month_prefix = today_str[:7] # YYYY-MM
        last_month_prefix = (last_monthly or "")[:7]
        
        if current_month_prefix != last_month_prefix:
            updates["monthly_cost_usage"] = 0.0
            updates["last_monthly_reset"] = today_str # Store full date of reset
            
        if updates:
            # Construct update query
            set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
            query = f"UPDATE users SET {set_clauses} WHERE id = :id"
            updates["id"] = user_id
            await self.db.execute(query=query, values=updates)
            
            # Return updated values overlaying the old ones
            new_data = dict(usage_data)
            new_data.update(updates)
            return new_data
            
        return usage_data

    async def check_limits(self, user_id: int):
        usage_data = await self._get_user_usage(user_id)
        if not usage_data:
            return # User not found or error, maybe allow or fail safe? 
            
        usage_data = await self._reset_counters_if_needed(user_id, usage_data)
        
        tier = (usage_data["plan_tier"] or "scout").lower()
        if tier not in LIMITS:
            tier = "scout" # Default
            
        limits = LIMITS[tier]
        
        # Check Daily Token Limit (Scout only mostly, but could apply to others if defined)
        if "daily_tokens" in limits:
            current_tokens = usage_data["daily_token_usage"] or 0
            if current_tokens >= limits["daily_tokens"]:
                raise UsageLimitExceeded(f"Daily token limit of {limits['daily_tokens']} reached.", tier)
                
        # Check Monthly Cost Limit
        if "monthly_cost" in limits:
            current_cost = usage_data["monthly_cost_usage"] or 0.0
            if current_cost >= limits["monthly_cost"]:
                raise UsageLimitExceeded(f"Monthly cost limit of ${limits['monthly_cost']:.2f} reached.", tier)

    async def track_usage(self, user_id: int, input_tokens: int, output_tokens: int):
        # Calculate cost
        cost = (input_tokens * PRICE_INPUT_PER_MILLION / 1_000_000) + \
               (output_tokens * PRICE_OUTPUT_PER_MILLION / 1_000_000)
               
        total_tokens = input_tokens + output_tokens
        
        query = """
            UPDATE users 
            SET daily_token_usage = COALESCE(daily_token_usage, 0) + :tokens,
                monthly_cost_usage = COALESCE(monthly_cost_usage, 0) + :cost
            WHERE id = :id
        """
        await self.db.execute(query=query, values= {
            "id": user_id,
            "tokens": total_tokens,
            "cost": cost
        })
