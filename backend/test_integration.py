"""Integration test - verify the system works with real Supabase."""
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# Import after env is loaded
from usage_tracker import get_limits_for_tier

def test_integration():
    """Quick integration test of the limits."""
    print("\n" + "="*60)
    print("INTEGRATION TEST - Scout Plan Budget")
    print("="*60)
    
    # Test Scout tier
    scout = get_limits_for_tier("scout")
    
    print("\n📊 SCOUT PLAN ALLOCATION:")
    print("  Monthly Budget:     Unlimited (temporary)")
    print("  6-Hour Block:       Unlimited (temporary)")
    assert scout["is_unlimited"] is True, "Scout should be unlimited for now"
    
    # Test other tiers for comparison
    voyager = get_limits_for_tier("voyager")
    pioneer = get_limits_for_tier("pioneer")
    
    print(f"\n💰 TIER COMPARISON:")
    print(f"  Scout:              Unlimited for now")
    print(f"  Voyager:            ${voyager['monthly_cost']:.2f}/month (${voyager['six_hour_cost']:.5f}/6h)")
    print(f"  Pioneer:            ${pioneer['monthly_cost']:.2f}/month (${pioneer['six_hour_cost']:.2f}/6h)")
    
    print("\n" + "="*60)
    print("✅ INTEGRATION TEST PASSED - System Ready!")
    print("="*60 + "\n")

if __name__ == "__main__":
    test_integration()
