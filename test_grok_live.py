#!/usr/bin/env python3
"""Direct test of Grok 4.1 Fast - will attempt real API call."""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from openrouter_client import OpenRouterService


async def main():
    load_dotenv()
    
    service = OpenRouterService()
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    
    print("=" * 60)
    print("Grok 4.1 Fast Live Test")
    print("=" * 60)
    print(f"API Key: {api_key[:20]}...")
    print(f"Model: {service.lite_model}")
    print()
    
    if not api_key.startswith("sk-or-v1-"):
        print("❌ Invalid API key format")
        print("OpenRouter keys should start with 'sk-or-v1-'")
        return
    
    if "your-key-here" in api_key.lower():
        print("❌ API key is still the placeholder")
        print("Please update OPENROUTER_API_KEY in .env with your real key")
        return
    
    print("🚀 Attempting real API call...")
    print()
    
    try:
        print("Grok says: ", end="", flush=True)
        
        async for chunk in service.stream(
            message="Say 'Hello from Grok!' in exactly 5 words.",
            model="lite",
            include_usage=True
        ):
            if isinstance(chunk, dict) and "usage" in chunk:
                print("\n\n📊 Usage Stats:")
                print(f"   Prompt Tokens: {chunk['usage'].get('prompt_tokens', 'N/A')}")
                print(f"   Completion Tokens: {chunk['usage'].get('completion_tokens', 'N/A')}")
                print(f"   Total Tokens: {chunk['usage'].get('total_tokens', 'N/A')}")
                if "cache_discount" in chunk["usage"]:
                    print(f"   💰 Cache Discount: {chunk['usage']['cache_discount']}")
            else:
                print(chunk, end="", flush=True)
        
        print("\n")
        print("✅ SUCCESS! Grok 4.1 Fast is working!")
        
    except Exception as e:
        print("\n")
        print(f"❌ Error: {e}")
        
        error_str = str(e)
        if "401" in error_str:
            print("   → API key is invalid or has been revoked")
        elif "402" in error_str:
            print("   → Insufficient credits in OpenRouter account")
        elif "404" in error_str:
            print("   → Model not found (check model ID)")
        elif "timeout" in error_str.lower():
            print("   → Request timed out, try again")
        else:
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
