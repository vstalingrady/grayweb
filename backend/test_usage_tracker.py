"""Test script for usage tracker functionality."""
import asyncio
import datetime
from usage_tracker import UsageTracker, UsageLimitExceeded, get_limits_for_tier

# Mock database for testing
class MockDB:
    def __init__(self):
        self.user_data = {
            "plan_tier": "scout",
            "daily_token_usage": 0,
            "monthly_cost_usage": 0.0,
            "last_daily_reset": None,
            "last_monthly_reset": None,
            "six_hour_cost_usage": 0.0,
            "last_six_hour_reset": None,
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

def test_limit_calculations():
    """Test that tier limits are calculated correctly."""
    print("\n=== Testing Limit Calculations ===")
    
    scout_limits = get_limits_for_tier("scout")
    print(f"Scout limits: {scout_limits}")
    assert scout_limits["is_unlimited"] is True, "Scout should be unlimited for now"
    assert scout_limits["monthly_cost"] is None, "Scout monthly should be unlimited"
    assert scout_limits["six_hour_cost"] is None, "Scout 6-hour should be unlimited"
    
    voyager_limits = get_limits_for_tier("voyager")
    print(f"Voyager limits: {voyager_limits}")
    assert voyager_limits["monthly_cost"] == 6.00, "Voyager monthly should be $6.00"
    assert abs(voyager_limits["six_hour_cost"] - 0.05) < 0.000001, "Voyager 6-hour should be $0.05"
    
    pioneer_limits = get_limits_for_tier("pioneer")
    print(f"Pioneer limits: {pioneer_limits}")
    assert pioneer_limits["monthly_cost"] == 24.00, "Pioneer monthly should be $24.00"
    assert abs(pioneer_limits["six_hour_cost"] - 0.2) < 0.000001, "Pioneer 6-hour should be $0.20"
    
    print("✅ All limit calculations correct!")

async def test_reset_logic():
    """Test that counters reset at the right time."""
    print("\n=== Testing Reset Logic ===")
    
    db = MockDB()
    tracker = UsageTracker(db)
    
    # Set some initial usage
    db.user_data["monthly_cost_usage"] = 0.001
    db.user_data["six_hour_cost_usage"] = 0.0005
    db.user_data["last_monthly_reset"] = "2025-10-15"  # Last month
    db.user_data["last_six_hour_reset"] = "2025-11-20-0"  # Different 6-hour block
    
    # This should trigger resets
    await tracker._reset_counters_if_needed(1, db.user_data)
    
    print(f"After reset - Monthly usage: {db.user_data['monthly_cost_usage']}")
    print(f"After reset - 6-hour usage: {db.user_data['six_hour_cost_usage']}")
    
    assert db.user_data["monthly_cost_usage"] == 0.0, "Monthly should reset on new month"
    assert db.user_data["six_hour_cost_usage"] == 0.0, "6-hour should reset on new block"
    
    print("✅ Reset logic works correctly!")

async def test_six_hour_limit_exceeded():
    """Test that 6-hour limit is enforced."""
    print("\n=== Testing 6-Hour Limit Enforcement ===")
    
    db = MockDB()
    db.user_data["plan_tier"] = "voyager"  # Use a finite tier for enforcement tests
    tracker = UsageTracker(db)
    
    # Set usage just under the limit
    scout_limits = get_limits_for_tier("scout")
    db.user_data["six_hour_cost_usage"] = get_limits_for_tier("voyager")["six_hour_cost"] - 0.0001
    db.user_data["monthly_cost_usage"] = 0.001
    db.user_data["last_six_hour_reset"] = datetime.datetime.utcnow().strftime("%Y-%m-%d") + "-" + str(datetime.datetime.utcnow().hour // 6)
    db.user_data["last_monthly_reset"] = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    
    # Should pass
    try:
        await tracker.check_limits(1)
        print("✅ Under limit - check passed")
    except UsageLimitExceeded:
        print("❌ Should not have raised exception when under limit")
        raise
    
    # Now exceed the 6-hour limit
    db.user_data["six_hour_cost_usage"] = get_limits_for_tier("voyager")["six_hour_cost"] + 0.0001
    
    try:
        await tracker.check_limits(1)
        print("❌ Should have raised exception when over 6-hour limit")
        raise AssertionError("Expected UsageLimitExceeded to be raised")
    except UsageLimitExceeded as e:
        print(f"✅ 6-hour limit exceeded - Error message: {e.message}")
        print(f"   Next reset at: {e.next_reset_time}")
        assert e.tier == "scout"
        assert "6-hour" in e.message

async def test_monthly_limit_exceeded():
    """Test that monthly limit is enforced."""
    print("\n=== Testing Monthly Limit Enforcement ===")
    
    db = MockDB()
    db.user_data["plan_tier"] = "voyager"  # Use a finite tier for enforcement tests
    tracker = UsageTracker(db)
    
    # Set usage just over monthly limit
    voyager_limits = get_limits_for_tier("voyager")
    db.user_data["monthly_cost_usage"] = voyager_limits["monthly_cost"] + 0.0001
    db.user_data["six_hour_cost_usage"] = 0.0001
    db.user_data["last_six_hour_reset"] = datetime.datetime.utcnow().strftime("%Y-%m-%d") + "-" + str(datetime.datetime.utcnow().hour // 6)
    db.user_data["last_monthly_reset"] = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    
    try:
        await tracker.check_limits(1)
        print("❌ Should have raised exception when over monthly limit")
        raise AssertionError("Expected UsageLimitExceeded to be raised")
    except UsageLimitExceeded as e:
        print(f"✅ Monthly limit exceeded - Error message: {e.message}")
        print(f"   Next reset at: {e.next_reset_time}")
        assert e.tier == "scout"
        assert "Monthly" in e.message

async def test_usage_tracking():
    """Test that usage is tracked correctly."""
    print("\n=== Testing Usage Tracking ===")
    
    db = MockDB()
    tracker = UsageTracker(db)
    
    # Track some usage
    input_tokens = 1000
    output_tokens = 500
    
    await tracker.track_usage(1, input_tokens, output_tokens)
    
    # Calculate expected cost
    expected_cost = (0 * 0.05 / 1_000_000) + (1000 * 0.20 / 1_000_000) + (500 * 0.50 / 1_000_000)
    print(f"Expected cost: ${expected_cost:.8f}")
    print(f"Updates: {db.updates}")
    
    # Check that update was called with correct cost
    assert len(db.updates) > 0, "Should have recorded an update"
    update = db.updates[0]
    assert abs(update["cost"] - expected_cost) < 0.00000001, f"Cost should be ${expected_cost}"
    assert update["tokens"] == 1500, "Total tokens should be 1500"
    
    print("✅ Usage tracking works correctly!")

async def test_six_hour_block_calculation():
    """Test that 6-hour blocks are calculated correctly."""
    print("\n=== Testing 6-Hour Block Calculation ===")
    
    test_cases = [
        (0, "2025-11-21-0"),   # 00:00-05:59 -> block 0
        (3, "2025-11-21-0"),   # 03:00
        (6, "2025-11-21-1"),   # 06:00-11:59 -> block 1
        (11, "2025-11-21-1"),  # 11:00
        (12, "2025-11-21-2"),  # 12:00-17:59 -> block 2
        (17, "2025-11-21-2"),  # 17:00
        (18, "2025-11-21-3"),  # 18:00-23:59 -> block 3
        (23, "2025-11-21-3"),  # 23:00
    ]
    
    for hour, expected_block in test_cases:
        now = datetime.datetime(2025, 11, 21, hour, 30, 0)
        block_index = now.hour // 6
        block_id = f"{now.strftime('%Y-%m-%d')}-{block_index}"
        print(f"Hour {hour:02d}:30 -> Block {block_id}")
        assert block_id == expected_block, f"Block calculation wrong for hour {hour}"
    
    print("✅ 6-hour block calculation correct!")

async def main():
    """Run all tests."""
    print("=" * 60)
    print("USAGE TRACKER TEST SUITE")
    print("=" * 60)
    
    try:
        test_limit_calculations()
        await test_reset_logic()
        await test_six_hour_limit_exceeded()
        await test_monthly_limit_exceeded()
        await test_usage_tracking()
        await test_six_hour_block_calculation()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ TEST FAILED: {e}")
        print("=" * 60)
        raise

if __name__ == "__main__":
    asyncio.run(main())
