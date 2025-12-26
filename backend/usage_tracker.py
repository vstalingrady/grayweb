"""
Usage Tracker with Dynamic Model Pricing
=========================================

Fetches model pricing from OpenRouter API and tracks usage costs per user.
Supports tier-based limits (Scout/Voyager/Pioneer) with monthly and 8-hour windows.
"""

import datetime
import logging
import os
from typing import Any, Dict, Optional

import httpx
from backend.tier_utils import normalize_plan_tier

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pricing Cache
# ---------------------------------------------------------------------------

_PRICING_CACHE: Dict[str, Dict[str, float]] = {}
_PRICING_CACHE_EXPIRY: Optional[datetime.datetime] = None
_PRICING_CACHE_TTL = datetime.timedelta(hours=6)

# Fallback pricing per token (USD) if API fetch fails
# Fetched from OpenRouter API on Dec 2024
# Only includes models from ModelSelector.tsx + internal Gemini models
FALLBACK_PRICING: Dict[str, Dict[str, float]] = {
    # xAI Grok (Gray Lite default)
    "x-ai/grok-4.1-fast": {"prompt": 2e-07, "completion": 5e-07, "cached": 2e-08},
    
    # Anthropic Claude (Pioneer models)
    "anthropic/claude-sonnet-4.5": {"prompt": 3e-06, "completion": 1.5e-05, "cached": 3e-07},
    "anthropic/claude-opus-4.5": {"prompt": 5e-06, "completion": 2.5e-05, "cached": 5e-07},
    
    # Google Gemini (Gray Pro + Pioneer)
    "google/gemini-3-pro-preview": {"prompt": 2e-06, "completion": 1.2e-05, "cached": 2e-07},
    "google/gemini-3-flash-preview": {"prompt": 5e-07, "completion": 3e-06, "cached": 5e-08},
    # Direct Gemini API model names (internal use)
    "models/gemini-3-pro-preview": {"prompt": 2e-06, "completion": 1.2e-05, "cached": 2e-07},
    "models/gemini-3-flash-lite": {"prompt": 1e-07, "completion": 4e-07, "cached": 1e-08},
    "models/gemini-flash-lite-latest": {"prompt": 1e-07, "completion": 4e-07, "cached": 1e-08},
    
    # OpenAI GPT (Pioneer)
    # Updated Dec 2025: $1.75/M input, $14/M output for GPT 5.2 chat + normal
    "openai/gpt-5.2-chat": {"prompt": 1.75e-06, "completion": 1.4e-05, "cached": 1.75e-07},
    "openai/gpt-5.2": {"prompt": 1.75e-06, "completion": 1.4e-05, "cached": 1.75e-07},
    "openai/gpt-5.2-pro": {"prompt": 2.1e-05, "completion": 1.68e-04, "cached": 2.1e-06},
    
    # DeepSeek (Pioneer)
    "deepseek/deepseek-v3.2": {"prompt": 2.7e-07, "completion": 4e-07, "cached": 2.7e-08},
    "deepseek/deepseek-v3.2-speciale": {"prompt": 2.7e-07, "completion": 4.1e-07, "cached": 2.7e-08},
    
    # Moonshot Kimi (Pioneer)
    "moonshotai/kimi-k2-0905": {"prompt": 3.9e-07, "completion": 1.9e-06, "cached": 3.9e-07},
    "moonshotai/kimi-k2-fast": {"prompt": 1.0e-06, "completion": 3.0e-06, "cached": 5.0e-07},
    "moonshotai/kimi-k2-thinking": {"prompt": 4.8e-07, "completion": 2.0e-06, "cached": 1.5e-07},
    
    # Xiaomi MiMo (Pioneer)
    "xiaomi/mimo-v2-flash:free": {"prompt": 1.0e-07, "completion": 3.0e-07, "cached": 1.0e-08},
}

# Default pricing for unknown models
DEFAULT_PRICING = {"prompt": 1.00e-6, "completion": 5.00e-6, "cached": 0.10e-6}

def _get_burst_exempt_emails() -> set[str]:
    raw = os.getenv("USAGE_BURST_EXEMPT_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


async def _fetch_openrouter_pricing() -> Dict[str, Dict[str, float]]:
    """Fetch current model pricing from OpenRouter API."""
    global _PRICING_CACHE, _PRICING_CACHE_EXPIRY
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Return cached if still valid
    if _PRICING_CACHE and _PRICING_CACHE_EXPIRY and now < _PRICING_CACHE_EXPIRY:
        return _PRICING_CACHE
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://openrouter.ai/api/v1/models")
            response.raise_for_status()
            data = response.json()
        
        pricing = {}
        for model in data.get("data", []):
            model_id = model.get("id", "")
            model_pricing = model.get("pricing", {})
            
            # OpenRouter returns per-token prices as strings
            try:
                prompt_price = float(model_pricing.get("prompt", 0))
                completion_price = float(model_pricing.get("completion", 0))
                # Cached pricing if available, otherwise estimate as 10% of prompt
                cached_price = prompt_price * 0.1
                
                # Skip models with -1 (variable pricing)
                if prompt_price < 0 or completion_price < 0:
                    continue
                    
                pricing[model_id] = {
                    "prompt": prompt_price,
                    "completion": completion_price,
                    "cached": cached_price,
                }
            except (ValueError, TypeError):
                continue
        
        if pricing:
            _PRICING_CACHE = pricing
            _PRICING_CACHE_EXPIRY = now + _PRICING_CACHE_TTL
            logger.info(f"Fetched pricing for {len(pricing)} models from OpenRouter")
            return pricing
            
    except Exception as e:
        logger.warning(
            "Failed to fetch OpenRouter pricing; using cached/fallback pricing",
            extra={"event_type": "fallback_activation", "fallback": "openrouter_pricing_fetch_failed", "error": str(e)},
        )
    
    return {}


def _get_model_pricing(model_id: str) -> Dict[str, float]:
    """Get pricing for a specific model, checking cache and fallbacks."""
    # Check dynamic cache first
    if model_id in _PRICING_CACHE:
        return _PRICING_CACHE[model_id]
    
    # Check fallback pricing
    if model_id in FALLBACK_PRICING:
        return FALLBACK_PRICING[model_id]
    
    # Try to find by partial match (e.g., "grok-4.1-fast" matches "x-ai/grok-4.1-fast")
    model_lower = model_id.lower()
    for key, value in FALLBACK_PRICING.items():
        if model_lower in key.lower() or key.lower() in model_lower:
            return value
    
    # Return default pricing
    logger.warning(
        "No pricing found for model; using default pricing",
        extra={"event_type": "fallback_activation", "fallback": "model_pricing_missing", "model_id": model_id},
    )
    return DEFAULT_PRICING


def calculate_cost(
    model_id: str,
    input_tokens: int,
    output_tokens: int,
    cached_tokens: int = 0,
) -> float:
    """Calculate the cost for a request based on token counts and model pricing."""
    pricing = _get_model_pricing(model_id)
    
    cost = (
        (cached_tokens * pricing["cached"])
        + (input_tokens * pricing["prompt"])
        + (output_tokens * pricing["completion"])
    )
    
    return cost


# ---------------------------------------------------------------------------
# Tier Limits
# ---------------------------------------------------------------------------

# All limits are in USD
# Credit structure: Scout = base, then 6x/18x/36x multipliers
LIMITS = {
    # Scout: free tier - loss leader for conversions
    # Base: $0.60/month
    "scout": {
        "monthly_cost": 0.60,
        "six_hour_cost": 0.0184,
    },
    # Pathfinder: 6x Scout credits
    "pathfinder": {
        "monthly_cost": 3.6,
        "six_hour_cost": 0.1104,
    },
    # Voyager: 18x Scout credits
    "voyager": {
        "monthly_cost": 10.8,
        "six_hour_cost": 0.3312,
    },
    # Pioneer: 36x Scout credits
    # NOTE: Premium models (Claude Opus, GPT Pro) burn credits faster
    "pioneer": {
        "monthly_cost": 21.6,
        "six_hour_cost": 0.6624,
    },
}


def get_limits_for_tier(tier: str) -> Dict[str, Any]:
    """Get usage limits for a specific tier."""
    base = LIMITS.get(tier.lower(), LIMITS["pioneer"])
    return {
        "monthly_cost": base["monthly_cost"],
        "six_hour_cost": base["six_hour_cost"],
        "is_unlimited": False,
    }


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _coerce_datetime(value: object) -> Optional[datetime.datetime]:
    """Normalize persisted reset timestamps to timezone-aware datetimes."""
    if isinstance(value, datetime.datetime):
        return value if value.tzinfo else value.replace(tzinfo=datetime.timezone.utc)
    if isinstance(value, datetime.date):
        return datetime.datetime.combine(value, datetime.time.min, tzinfo=datetime.timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.datetime.fromisoformat(value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            pass
        for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                parsed = datetime.datetime.strptime(value, fmt)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)
            except ValueError:
                continue
    return None


def _coerce_date(value: object) -> Optional[datetime.date]:
    dt_value = _coerce_datetime(value)
    return dt_value.date() if dt_value else None


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class UsageLimitExceeded(Exception):
    """Raised when a user exceeds their usage limits."""
    
    def __init__(
        self,
        message: str,
        tier: str,
        next_reset_time: Optional[datetime.datetime] = None,
    ):
        self.message = message
        self.tier = tier
        self.next_reset_time = next_reset_time
        super().__init__(message)


# ---------------------------------------------------------------------------
# Usage Tracker
# ---------------------------------------------------------------------------

class UsageTracker:
    """Tracks and enforces user usage limits based on cost."""
    
    def __init__(self, db):
        self.db = db

    async def _get_user_usage(self, user_id: int):
        """Fetch current usage data for a user."""
        query = """
            SELECT email, plan_tier, daily_token_usage, monthly_cost_usage, 
                   last_daily_reset, last_monthly_reset,
                   six_hour_cost_usage, last_six_hour_reset,
                   subscription_expires_at
            FROM users WHERE id = :id
        """
        return await self.db.fetch_one(query=query, values={"id": user_id})

    async def _reset_counters_if_needed(self, user_id: int, usage_data) -> Dict[str, Any]:
        """Reset usage counters if their time windows have expired."""
        if not isinstance(usage_data, dict):
            usage_data = dict(usage_data)

        now = datetime.datetime.now(datetime.timezone.utc)
        today = now.date()
        updates = {}

        # Daily Reset (legacy token counter)
        last_daily_date = _coerce_date(usage_data.get("last_daily_reset"))
        if last_daily_date != today:
            updates["daily_token_usage"] = 0
            updates["last_daily_reset"] = now.isoformat()

        # Monthly Reset
        last_monthly_date = _coerce_date(usage_data.get("last_monthly_reset"))
        if not last_monthly_date or (last_monthly_date.year, last_monthly_date.month) != (today.year, today.month):
            updates["monthly_cost_usage"] = 0.0
            updates["last_monthly_reset"] = now.isoformat()

        # 8-Hour Reset
        last_six_hour_dt = _coerce_datetime(usage_data.get("last_six_hour_reset"))
        current_block_index = now.hour // 8
        current_block_start = now.replace(hour=current_block_index * 8, minute=0, second=0, microsecond=0)
        next_block_start = current_block_start + datetime.timedelta(hours=8)

        should_reset_six_hour = (
            last_six_hour_dt is None
            or last_six_hour_dt < current_block_start
            or last_six_hour_dt >= next_block_start
        )

        if should_reset_six_hour:
            updates["six_hour_cost_usage"] = 0.0
            updates["last_six_hour_reset"] = current_block_start.isoformat()

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
        """Check if user has exceeded their usage limits."""
        usage_data = await self._get_user_usage(user_id)
        if not usage_data:
            return

        usage_data = await self._reset_counters_if_needed(user_id, usage_data)

        # Get user tier with subscription expiration check
        subscription_expires_at = usage_data.get("subscription_expires_at")
        tier = normalize_plan_tier(
            usage_data.get("plan_tier"),
            None,  # role not available in usage_data
            subscription_expires_at
        )
        limits = get_limits_for_tier(tier)
        email = (usage_data.get("email") or "").strip().lower()
        burst_exempt = email in _get_burst_exempt_emails()
        
        if limits.get("is_unlimited"):
            return

        now = datetime.datetime.now(datetime.timezone.utc)

        # Check Monthly Limit
        current_monthly = usage_data["monthly_cost_usage"] or 0.0
        if current_monthly >= limits["monthly_cost"]:
            if now.month == 12:
                next_reset = datetime.datetime(now.year + 1, 1, 1, tzinfo=datetime.timezone.utc)
            else:
                next_reset = datetime.datetime(now.year, now.month + 1, 1, tzinfo=datetime.timezone.utc)

            if next_reset <= now:
                next_reset = now + datetime.timedelta(minutes=1)

            logger.warning(
                "Monthly usage limit exceeded",
                extra={
                    "user_id": user_id,
                    "tier": tier,
                    "usage": float(current_monthly),
                    "limit": float(limits["monthly_cost"]),
                },
            )
            raise UsageLimitExceeded("Monthly limit reached.", tier, next_reset)

        # Check 8-Hour Limit
        current_six_hour = usage_data["six_hour_cost_usage"] or 0.0
        if not burst_exempt and current_six_hour >= limits["six_hour_cost"]:
            current_block = now.hour // 8
            next_block_hour = (current_block + 1) * 8

            next_reset_day = now.date()
            if next_block_hour >= 24:
                next_reset_day += datetime.timedelta(days=1)
                next_block_hour = 0

            next_reset = datetime.datetime.combine(
                next_reset_day,
                datetime.time(next_block_hour, 0, 0),
                tzinfo=datetime.timezone.utc,
            )

            if next_reset <= now:
                next_reset = now + datetime.timedelta(minutes=1)

            logger.warning(
                "8-hour usage limit exceeded",
                extra={
                    "user_id": user_id,
                    "tier": tier,
                    "usage": float(current_six_hour),
                    "limit": float(limits["six_hour_cost"]),
                },
            )
            raise UsageLimitExceeded("8-hour burst limit reached.", tier, next_reset)

    async def get_usage_status(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get current usage status for a user."""
        usage_data = await self._get_user_usage(user_id)
        if not usage_data:
            return None

        usage_data = await self._reset_counters_if_needed(user_id, usage_data)

        # Get user tier with subscription expiration check
        subscription_expires_at = usage_data.get("subscription_expires_at")
        tier = normalize_plan_tier(
            usage_data.get("plan_tier"),
            None,  # role not available in usage_data
            subscription_expires_at
        )
        limits = get_limits_for_tier(tier)
        email = (usage_data.get("email") or "").strip().lower()
        burst_exempt = email in _get_burst_exempt_emails()
        
        if limits.get("is_unlimited"):
            return {
                "tier": tier,
                "monthly_usage": float(usage_data["monthly_cost_usage"] or 0.0),
                "monthly_limit": None,
                "is_monthly_limit_reached": False,
                "six_hour_usage": float(usage_data["six_hour_cost_usage"] or 0.0),
                "six_hour_limit": None,
                "is_six_hour_limit_reached": False,
                "is_unlimited": True,
            }

        now = datetime.datetime.now(datetime.timezone.utc)

        current_monthly = usage_data["monthly_cost_usage"] or 0.0
        monthly_limit = limits["monthly_cost"]
        is_monthly_limit_reached = current_monthly >= monthly_limit

        if now.month == 12:
            next_monthly_reset = datetime.datetime(now.year + 1, 1, 1, tzinfo=datetime.timezone.utc)
        else:
            next_monthly_reset = datetime.datetime(now.year, now.month + 1, 1, tzinfo=datetime.timezone.utc)

        current_six_hour = usage_data["six_hour_cost_usage"] or 0.0
        six_hour_limit = limits["six_hour_cost"]
        is_six_hour_limit_reached = current_six_hour >= six_hour_limit
        if burst_exempt:
            is_six_hour_limit_reached = False

        current_block = now.hour // 8
        next_block_hour = (current_block + 1) * 8
        next_reset_day = now.date()
        if next_block_hour >= 24:
            next_reset_day += datetime.timedelta(days=1)
            next_block_hour = 0

        next_six_hour_reset = datetime.datetime.combine(
            next_reset_day,
            datetime.time(next_block_hour, 0, 0),
            tzinfo=datetime.timezone.utc,
        )

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
        """Track token usage and update cost counters."""
        # Calculate cost based on model-specific pricing
        model_id = model or "x-ai/grok-4.1-fast"  # Default to Grok lite
        cost = calculate_cost(model_id, input_tokens, output_tokens, cached_tokens)

        total_tokens = input_tokens + output_tokens + cached_tokens

        query = """
            UPDATE users 
            SET daily_token_usage = COALESCE(daily_token_usage, 0) + :tokens,
                monthly_cost_usage = COALESCE(monthly_cost_usage, 0) + :cost,
                six_hour_cost_usage = COALESCE(six_hour_cost_usage, 0) + :cost
            WHERE id = :id
        """
        await self.db.execute(
            query=query,
            values={"id": user_id, "tokens": total_tokens, "cost": cost},
        )

        logger.debug(
            f"Tracked usage for user {user_id}: {total_tokens} tokens, ${cost:.6f} cost",
            extra={
                "user_id": user_id,
                "model": model_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cached_tokens": cached_tokens,
                "cost": cost,
            },
        )


    async def track_cost(
        self,
        user_id: int,
        cost: float,
        description: str = "service_cost",
    ):
        """Track explicit cost (e.g., search queries) without token counting."""
        query = """
            UPDATE users 
            SET monthly_cost_usage = COALESCE(monthly_cost_usage, 0) + :cost,
                six_hour_cost_usage = COALESCE(six_hour_cost_usage, 0) + :cost
            WHERE id = :id
        """
        await self.db.execute(
            query=query,
            values={"id": user_id, "cost": cost},
        )

        logger.debug(
            f"Tracked explicit cost for user {user_id}: ${cost:.6f} ({description})",
            extra={
                "user_id": user_id,
                "cost": cost,
                "type": description,
            },
        )


async def refresh_pricing_cache():
    """Manually refresh the pricing cache from OpenRouter."""
    global _PRICING_CACHE, _PRICING_CACHE_EXPIRY
    _PRICING_CACHE = {}
    _PRICING_CACHE_EXPIRY = None
    return await _fetch_openrouter_pricing()
