"""Test script for Gemini 3 Pro usage limiting."""
import asyncio
import datetime
from usage_tracker import UsageTracker, UsageLimitExceeded, get_limits_for_tier

# Mock database for testing
class MockDB:
    def __init__(self):
        self.user_data = {
            "plan_tier": "pioneer",
            "daily_token_usage": 0,
            "monthly_cost_usage": 0.0,
            "last_daily_reset": None,
            "last_monthly_reset": None,
            "six_hour_cost_usage": 0.0,
            "last_six_hour_reset": None,
            "daily_gemini_pro_usage": 0,
            "last_daily_gemini_pro_reset": None,
        }
        self.updates = []
    
    async def fetch_one(self, query, values):
        return self.user_data
    
    async def execute(self, query, values):
        self.updates.append(values)
        # Update mock data
        for key, value in values.items():
            if key in self.user_data:
                self.user_data[key] = value
        
        # Handle the specific increment query which doesn't pass the new value directly
        if "daily_gemini_pro_usage = COALESCE(daily_gemini_pro_usage, 0) + 1" in query:
            self.user_data["daily_gemini_pro_usage"] += 1

async def test_gemini_pro_limit_config():
    """Test that Pioneer tier has the correct Gemini Pro limit."""
    print("\n=== Testing Gemini Pro Limit Configuration ===")
    
    pioneer_limits = get_limits_for_tier("pioneer")
    print(f"Pioneer limits: {pioneer_limits}")
    assert pioneer_limits["daily_gemini_pro_messages"] == 50, "Pioneer should have 50 daily Gemini Pro messages"
    
    voyager_limits = get_limits_for_tier("voyager")
    # Voyager might not have this limit explicitly set in the code I saw, or it might inherit/default.
    # Based on my edit, I only added it to Pioneer. Let's check what it returns.
    print(f"Voyager limits: {voyager_limits}")
    
    print("✅ Limit configuration correct!")

async def test_gemini_pro_usage_tracking():
    """Test that Gemini Pro usage is tracked."""
    print("\n=== Testing Gemini Pro Usage Tracking ===")
    
    db = MockDB()
    tracker = UsageTracker(db)
    
    # Track usage for a normal model
    await tracker.track_usage(1, 100, 100, model="grok")
    assert db.user_data["daily_gemini_pro_usage"] == 0, "Should not track Gemini Pro usage for Grok"
    
    # Track usage for Gemini Pro
    await tracker.track_usage(1, 100, 100, model="models/gemini-3-pro-preview")
    assert db.user_data["daily_gemini_pro_usage"] == 1, "Should track Gemini Pro usage"
    
    await tracker.track_usage(1, 100, 100, model="gemini-3-pro")
    assert db.user_data["daily_gemini_pro_usage"] == 2, "Should track Gemini Pro usage (partial match)"
    
    print("✅ Usage tracking works correctly!")

async def test_gemini_pro_limit_enforcement():
    """Test that Gemini Pro limit is enforced."""
    print("\n=== Testing Gemini Pro Limit Enforcement ===")
    
    db = MockDB()
    tracker = UsageTracker(db)
    
    # Set usage to limit - 1
    db.user_data["daily_gemini_pro_usage"] = 49
    # Ensure no reset happens
    db.user_data["last_daily_gemini_pro_reset"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # Should pass
    try:
        await tracker.check_limits(1, model="models/gemini-3-pro-preview")
        print("✅ Under limit - check passed")
    except UsageLimitExceeded:
        print("❌ Should not have raised exception when under limit")
        raise
        
    # Set usage to limit
    db.user_data["daily_gemini_pro_usage"] = 50
    
    # Should fail
    try:
        await tracker.check_limits(1, model="models/gemini-3-pro-preview")
        print("❌ Should have raised exception when at limit")
        raise AssertionError("Expected UsageLimitExceeded to be raised")
    except UsageLimitExceeded as e:
        print(f"✅ Limit exceeded - Error message: {e.message}")
        assert "Daily Gemini Pro limit reached" in e.message
        
    # Should NOT fail for other models
    try:
        await tracker.check_limits(1, model="grok")
        print("✅ Other model - check passed")
    except UsageLimitExceeded:
        print("❌ Should not enforce Gemini Pro limit on other models")
        raise

    print("✅ Limit enforcement works correctly!")

async def test_gemini_pro_reset():
    """Test that Gemini Pro counter resets correctly."""
    print("\n=== Testing Gemini Pro Reset Logic ===")
    
    db = MockDB()
    tracker = UsageTracker(db)
    
    # Set usage and old reset date
    db.user_data["daily_gemini_pro_usage"] = 50
    db.user_data["last_daily_gemini_pro_reset"] = "2020-01-01T00:00:00+00:00"
    
    # Check limits should trigger reset
    # Note: check_limits calls _get_user_usage which calls _reset_counters_if_needed
    # We need to simulate the flow or call _reset_counters_if_needed directly
    
    # Let's call _reset_counters_if_needed directly to verify logic
    new_data = await tracker._reset_counters_if_needed(1, db.user_data)
    
    # In the real code, _reset_counters_if_needed updates the DB.
    # Our mock DB execute method updates the internal state.
    
    print(f"Usage after reset: {db.user_data['daily_gemini_pro_usage']}")
    print(f"Reset date after reset: {db.user_data['last_daily_gemini_pro_reset']}")
    
    assert db.user_data["daily_gemini_pro_usage"] == 0, "Should have reset usage to 0"
    
    # Check that today's date is in the reset timestamp
    today_str = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    reset_val = db.user_data["last_daily_gemini_pro_reset"]
    if hasattr(reset_val, 'isoformat'):
        reset_val_str = reset_val.isoformat()
    else:
        reset_val_str = str(reset_val)
        
    assert today_str in reset_val_str, "Should have updated reset date to today"
    
    print("✅ Reset logic works correctly!")

async def main():
    """Run all tests."""
    print("=" * 60)
    print("GEMINI PRO USAGE LIMIT TEST SUITE")
    print("=" * 60)
    
    try:
        await test_gemini_pro_limit_config()
        await test_gemini_pro_usage_tracking()
        await test_gemini_pro_limit_enforcement()
        await test_gemini_pro_reset()
        
        print("\n" + "=" * 60)
        print("✅ ALL GEMINI PRO TESTS PASSED!")
        print("=" * 60)
        
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ TEST FAILED: {e}")
        print("=" * 60)
        raise

if __name__ == "__main__":
    asyncio.run(main())
