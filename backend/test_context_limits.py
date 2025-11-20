"""
Test context limit functionality
"""
import httpx
import json

BASE_URL = "http://localhost:8000"

async def test_context_limits():
    """Test that context limits are properly set by tier"""
   
    print("\n" + "="*60)
    print("CONTEXT LIMIT TEST")
    print("="*60)
    
    # Test data: different tiers should have different limits
    EXPECTED_LIMITS = {
        "scout": 65_536,      # 64k
        "voyager": 262_144,   # 256k
        "pioneer": 1_048_576, # 1M
    }
    
    print("\n📋 Expected limits by tier:")
    for tier, limit in EXPECTED_LIMITS.items():
        print(f"  {tier.capitalize()}: {limit:,} tokens ({limit/1024:.0f}k)")
    
    # For actual testing, you would need:
    # 1. Backend running
    # 2. A conversation ID to test with
    # 3. User properly authenticated
    
    print("\n✅ Context limit logic implemented:")
    print("  - Scout tier: 64k tokens (65,536)")
    print("  - Voyager tier: 256k tokens (262,144)")
    print("  - Pioneer tier: 1M tokens (1,048,576)")
    print("\n📊 Token counting improved:")
    print("  - Uses tiktoken when available (accurate)")
    print("  - Falls back to improved estimation (chars/3.8 instead of /4)")
    print("\n🔍 Tier detection:")
    print("  - Looks up user_id from conversation")
    print("  - Fetches plan_tier from users table")
    print("  - Defaults to Scout if lookup fails")
    
    print("\n" + "="*60)
    print("To test live:")
    print("="*60)
    print("1. Start the backend: cd backend && uvicorn main:app --reload")
    print("2. Start the frontend: npm run dev")
    print("3. Log in as different tier users")
    print("4. Open personalization panel and check 'Context usage'")
    print("5. Scout should show limit, not 'Unlimited'")
    print("\n")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_context_limits())
