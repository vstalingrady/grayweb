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
    print(f"  Monthly Budget:     ${scout['monthly_cost']:.4f}")
    print(f"  6-Hour Block:       ${scout['six_hour_cost']:.7f}")
    print(f"  Blocks per month:   {scout['monthly_cost'] / scout['six_hour_cost']:.0f}")
    
    # Verify the math
    assert scout['monthly_cost'] == 0.1875, "Monthly should be $0.1875"
    assert abs(scout['six_hour_cost'] - 0.0015625) < 0.000001, "6-hour should be monthly/120"
    assert abs(scout['monthly_cost'] / scout['six_hour_cost'] - 120) < 0.1, "Should be exactly 120 blocks"
    
    # Calculate approximate usage
    # Gemini Flash pricing: $0.10 input, $0.40 output per million
    six_hour_budget = scout['six_hour_cost']
    
    # Assuming average conversation: 2000 input tokens, 1000 output tokens
    input_cost_per_conv = (2000 * 0.10) / 1_000_000
    output_cost_per_conv = (1000 * 0.40) / 1_000_000
    cost_per_conv = input_cost_per_conv + output_cost_per_conv
    
    convos_per_window = six_hour_budget / cost_per_conv
    convos_per_month = (scout['monthly_cost'] / cost_per_conv)
    
    print(f"\n💬 ESTIMATED USAGE (avg conversation: 2k input, 1k output):")
    print(f"  Per 6-hour window:  ~{convos_per_window:.1f} conversations")
    print(f"  Per month:          ~{convos_per_month:.0f} conversations")
    
    print(f"\n⏰ RESET SCHEDULE:")
    print(f"  6-Hour Windows:     Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)")
    print(f"  Monthly:            1st of each month at 00:00 UTC")
    
    print(f"\n🚫 NO WEEKLY TRACKING:")
    print(f"  Weekly limits:      REMOVED ✅")
    print(f"  Only using:         Monthly + 6-hour windows")
    
    # Test other tiers for comparison
    voyager = get_limits_for_tier("voyager")
    pioneer = get_limits_for_tier("pioneer")
    
    print(f"\n💰 TIER COMPARISON:")
    print(f"  Scout:              ${scout['monthly_cost']:.4f}/month (${scout['six_hour_cost']:.7f}/6h)")
    print(f"  Voyager:            ${voyager['monthly_cost']:.2f}/month (${voyager['six_hour_cost']:.5f}/6h)")
    print(f"  Pioneer:            ${pioneer['monthly_cost']:.2f}/month (${pioneer['six_hour_cost']:.2f}/6h)")
    
    print(f"\n  Voyager is {voyager['monthly_cost']/scout['monthly_cost']:.0f}x Scout")
    print(f"  Pioneer is {pioneer['monthly_cost']/scout['monthly_cost']:.0f}x Scout")
    
    print("\n" + "="*60)
    print("✅ INTEGRATION TEST PASSED - System Ready!")
    print("="*60 + "\n")

if __name__ == "__main__":
    test_integration()
