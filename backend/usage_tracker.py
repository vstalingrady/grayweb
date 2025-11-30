import datetime
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def _coerce_datetime(value: object) -> Optional[datetime.datetime]:
    """Normalize persisted reset timestamps to timezone-aware datetimes."""
    if isinstance(value, datetime.datetime):
        return value if value.tzinfo else value.replace(tzinfo=datetime.timezone.utc)
    if isinstance(value, datetime.date):
        return datetime.datetime.combine(value, datetime.time.min, tzinfo=datetime.timezone.utc)
    if isinstance(value, str):
        # Try standard ISO format first (handles microseconds and offsets)
        try:
            parsed = datetime.datetime.fromisoformat(value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)
        except Exception:
            pass

        # Try specific formats for backward compatibility
        for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                parsed = datetime.datetime.strptime(value, fmt)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)
            except Exception:
                continue
        # Fallback for legacy six-hour block IDs like "2025-11-29-3"
        try:
            date_part, block_part = value.rsplit("-", 1)
            base_date = datetime.date.fromisoformat(date_part)
            block_index = max(0, min(3, int(block_part)))
            start_hour = block_index * 6
            return datetime.datetime.combine(
                base_date,
                datetime.time(start_hour, 0, 0),
                tzinfo=datetime.timezone.utc,
            )
        except Exception:
            return None
    return None


def _coerce_date(value: object) -> Optional[datetime.date]:
    dt_value = _coerce_datetime(value)
    return dt_value.date() if dt_value else None

# Grok pricing (per million tokens)
# Cached: $0.05, Input: $0.20, Output: $0.50
PRICE_CACHED_PER_MILLION = 0.05
PRICE_INPUT_PER_MILLION = 0.20
PRICE_OUTPUT_PER_MILLION = 0.50

LIMITS = {
    # Scout: temporarily unlimited usage (legacy; we default users to Pioneer)
    "scout": {
        "monthly_cost": None,
        "is_unlimited": True,
    },
    "voyager": {
        "monthly_cost": 6.00,
    },
    "pioneer": {
        "monthly_cost": 24.00,
        "daily_gemini_pro_messages": 50,
    }
}

# Add default sub-limits logic
def get_limits_for_tier(tier: str):
    base = LIMITS.get(tier, LIMITS["pioneer"])
    monthly = base.get("monthly_cost")
    is_unlimited = bool(base.get("is_unlimited", False))

    if monthly is None:
        return {
            "monthly_cost": None,
            "six_hour_cost": None,
            "is_unlimited": True,
        }

    # Default policies:
    # 6-Hour = Monthly / 120 (30 days × 4 six-hour blocks per day)
    # This gives each 6-hour window an equal portion of the monthly budget
    return {
        "monthly_cost": monthly,
        "six_hour_cost": monthly / 120.0,
        "is_unlimited": is_unlimited,
        "daily_gemini_pro_messages": base.get("daily_gemini_pro_messages"),
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
                   six_hour_cost_usage, last_six_hour_reset, daily_gemini_pro_usage, last_daily_gemini_pro_reset
            FROM users WHERE id = :id
        """
        return await self.db.fetch_one(query=query, values={"id": user_id})

    async def _reset_counters_if_needed(self, user_id: int, usage_data):
        # Normalize to a mutable dict; databases.Record lacks .get().
        if not isinstance(usage_data, dict):
            usage_data = dict(usage_data)

        now = datetime.datetime.now(datetime.timezone.utc)
        today = now.date()
        updates = {}

        # 1. Daily Reset (legacy token counter)
        last_daily_date = _coerce_date(usage_data.get("last_daily_reset"))
        if last_daily_date != today:
            updates["daily_token_usage"] = 0
            updates["last_daily_reset"] = now.isoformat()

        # 2. Monthly Reset
        last_monthly_date = _coerce_date(usage_data.get("last_monthly_reset"))
        if not last_monthly_date or (last_monthly_date.year, last_monthly_date.month) != (today.year, today.month):
            updates["monthly_cost_usage"] = 0.0
            updates["last_monthly_reset"] = now.isoformat()

        # 3. 6-Hour Reset
        last_six_hour_dt = _coerce_datetime(usage_data.get("last_six_hour_reset"))
        current_block_index = now.hour // 6
        current_block_start = now.replace(hour=current_block_index * 6, minute=0, second=0, microsecond=0)
        next_block_start = current_block_start + datetime.timedelta(hours=6)

        should_reset_six_hour = (
            last_six_hour_dt is None
            or last_six_hour_dt < current_block_start
            or last_six_hour_dt >= next_block_start
        )

        if should_reset_six_hour:
            updates["six_hour_cost_usage"] = 0.0
            updates["last_six_hour_reset"] = current_block_start.isoformat()

        # 4. Daily Gemini Pro Reset
        last_daily_pro_date = _coerce_date(usage_data.get("last_daily_gemini_pro_reset"))
        if last_daily_pro_date != today:
            updates["daily_gemini_pro_usage"] = 0
            updates["last_daily_gemini_pro_reset"] = now

        if updates:
            set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
            query = f"UPDATE users SET {set_clauses} WHERE id = :id"
            updates["id"] = user_id
            await self.db.execute(query=query, values=updates)

            new_data = dict(usage_data)
            new_data.update(updates)
            return new_data

        return usage_data

    async def check_limits(self, user_id: int, model: Optional[str] = None):
        usage_data = await self._get_user_usage(user_id)
        if not usage_data:
            return 
            
        usage_data = await self._reset_counters_if_needed(user_id, usage_data)
        
        tier = (usage_data["plan_tier"] or "pioneer").lower()
        if tier == "scout":
            tier = "pioneer"
        limits = get_limits_for_tier(tier)
        if limits.get("is_unlimited"):
            return
        now = datetime.datetime.now(datetime.timezone.utc)
        
        # Check Monthly
        current_monthly = usage_data["monthly_cost_usage"] or 0.0
        if current_monthly >= limits["monthly_cost"]:
            if now.month == 12:
                next_reset = datetime.datetime(now.year + 1, 1, 1, tzinfo=datetime.timezone.utc)
            else:
                next_reset = datetime.datetime(now.year, now.month + 1, 1, tzinfo=datetime.timezone.utc)
            
            # Defensive check: Ensure reset is in the future
            if next_reset <= now:
                next_reset = now + datetime.timedelta(minutes=1)

            logger.warning(
                "Monthly usage limit exceeded",
                extra={
                    "user_id": user_id,
                    "tier": tier,
                    "usage": float(current_monthly),
                    "limit": float(limits["monthly_cost"]),
                    "next_reset": next_reset.isoformat() if next_reset else None,
                    "last_monthly_reset": usage_data.get("last_monthly_reset"),
                },
            )
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
            
            # Defensive check: Ensure reset is in the future
            if next_reset <= now:
                next_reset = now + datetime.timedelta(minutes=1)

            logger.warning(
                "6-hour usage limit exceeded",
                extra={
                    "user_id": user_id,
                    "tier": tier,
                    "usage": float(current_six_hour),
                    "limit": float(limits["six_hour_cost"]),
                    "next_reset": next_reset.isoformat() if next_reset else None,
                    "last_six_hour_reset": usage_data.get("last_six_hour_reset"),
                },
            )
            raise UsageLimitExceeded(f"6-hour burst limit reached.", tier, next_reset)

        # Check Gemini Pro Daily Limit
        if model and "gemini-3-pro" in model and limits.get("daily_gemini_pro_messages"):
            current_pro_usage = usage_data.get("daily_gemini_pro_usage") or 0
            pro_limit = limits["daily_gemini_pro_messages"]
            
            if current_pro_usage >= pro_limit:
                next_reset = datetime.datetime.combine(
                    now.date() + datetime.timedelta(days=1),
                    datetime.time.min,
                    tzinfo=datetime.timezone.utc
                )
                
                logger.warning(
                    "Gemini Pro daily limit exceeded",
                    extra={
                        "user_id": user_id,
                        "tier": tier,
                        "usage": current_pro_usage,
                        "limit": pro_limit,
                        "next_reset": next_reset.isoformat(),
                    },
                )
                raise UsageLimitExceeded(f"Daily Gemini Pro limit reached ({pro_limit} messages).", tier, next_reset)

    async def get_usage_status(self, user_id: int) -> dict:
        usage_data = await self._get_user_usage(user_id)
        if not usage_data:
            return None
            
        usage_data = await self._reset_counters_if_needed(user_id, usage_data)
        
        tier = (usage_data["plan_tier"] or "pioneer").lower()
        if tier == "scout":
            tier = "pioneer"
        limits = get_limits_for_tier(tier)
        if limits.get("is_unlimited"):
            return {
                "tier": tier,
                "monthly_usage": float(usage_data["monthly_cost_usage"] or 0.0),
                "monthly_limit": None,
                "is_monthly_limit_reached": False,
                "next_monthly_reset": None,
                "six_hour_usage": float(usage_data["six_hour_cost_usage"] or 0.0),
                "six_hour_limit": None,
                "is_six_hour_limit_reached": False,
                "next_six_hour_reset": None,
                "is_unlimited": True,
            }
        now = datetime.datetime.utcnow()
        
        # Calculate Monthly Status
        current_monthly = usage_data["monthly_cost_usage"] or 0.0
        monthly_limit = limits["monthly_cost"]
        is_monthly_limit_reached = current_monthly >= monthly_limit
        
        if now.month == 12:
            next_monthly_reset = datetime.datetime(now.year + 1, 1, 1, tzinfo=datetime.timezone.utc)
        else:
            next_monthly_reset = datetime.datetime(now.year, now.month + 1, 1, tzinfo=datetime.timezone.utc)

        # Calculate 6-Hour Status
        current_six_hour = usage_data["six_hour_cost_usage"] or 0.0
        six_hour_limit = limits["six_hour_cost"]
        is_six_hour_limit_reached = current_six_hour >= six_hour_limit
        
        current_block = now.hour // 6
        next_block_hour = (current_block + 1) * 6
        
        next_reset_day = now.date()
        if next_block_hour >= 24: # If next block is past midnight
            next_reset_day += datetime.timedelta(days=1)
            next_block_hour = 0 # Reset to 00:00 for the next day

        next_six_hour_reset = datetime.datetime.combine(next_reset_day, datetime.time(next_block_hour, 0, 0), tzinfo=datetime.timezone.utc)

        return {
            "tier": tier,
            "monthly_usage": float(current_monthly),
            "monthly_limit": float(monthly_limit),
            "is_monthly_limit_reached": is_monthly_limit_reached,
            "next_monthly_reset": next_monthly_reset.isoformat(),
            "six_hour_usage": float(current_six_hour),
            "six_hour_limit": float(six_hour_limit),
            "is_six_hour_limit_reached": is_six_hour_limit_reached,
            "next_six_hour_reset": next_six_hour_reset.isoformat(),
        }

    async def track_usage(
        self,
        user_id: int,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int = 0,
        model: Optional[str] = None,
    ):
        cost = (
            (cached_tokens * PRICE_CACHED_PER_MILLION / 1_000_000)
            + (input_tokens * PRICE_INPUT_PER_MILLION / 1_000_000)
            + (output_tokens * PRICE_OUTPUT_PER_MILLION / 1_000_000)
        )

        total_tokens = input_tokens + output_tokens + cached_tokens
        
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

        if model and "gemini-3-pro" in model:
            query_pro = """
                UPDATE users
                SET daily_gemini_pro_usage = COALESCE(daily_gemini_pro_usage, 0) + 1
                WHERE id = :id
            """
            await self.db.execute(query=query_pro, values={"id": user_id})
