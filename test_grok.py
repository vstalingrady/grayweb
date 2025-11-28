#!/usr/bin/env python3
"""Quick test script for Grok 4.1 Fast integration."""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from openrouter_client import OpenRouterService


async def test_grok_lite():
    """Test the Grok 4.1 Fast lite model."""
    load_dotenv()
    
    print("=" * 60)
    print("Testing Grok 4.1 Fast (Gray Lite Model)")
    print("=" * 60)
    print()
    
    # Initialize service
    service = OpenRouterService()
    
    # Check configuration
    print("Configuration:")
    print(f"  Lite Model: {service.lite_model}")
    print(f"  API Key Set: {'Yes' if service.available else 'No (placeholder)'}")
    print()
    
    # Check if we have a real API key
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not service.available or "your-key-here" in api_key.lower():
        print("⚠️  API Key not configured")
        print()
        print("To test with a real API key:")
        print("1. Get a key from https://openrouter.ai/")
        print("2. Update .env file:")
        print("   OPENROUTER_API_KEY=sk-or-v1-your-actual-key")
        print()
        print("📋 Configuration looks correct otherwise!")
        print(f"   Model will use: {service.lite_model}")
        return
    
    # Try a real request
    print("🚀 Sending test request to Grok 4.1 Fast...")
    print()
    
    try:
        print("Response: ", end="", flush=True)
        
        async for chunk in service.stream(
            message="Say 'Hello from Grok!' in exactly 5 words.",
            model="lite"  # This will resolve to Grok 4.1 Fast
        ):
            print(chunk, end="", flush=True)
        
        print("\n")
        print("✅ Test successful! Grok 4.1 Fast is working!")
        
    except Exception as e:
        print()
        print(f"❌ Error: {e}")
        print()
        if "401" in str(e):
            print("API key is invalid. Please check your OPENROUTER_API_KEY")
        elif "402" in str(e):
            print("Insufficient credits in OpenRouter account")
        else:
            print("Check the error message above for details")


async def test_model_resolution():
    """Test that model resolution works correctly."""
    service = OpenRouterService()
    
    print("=" * 60)
    print("Model Resolution Tests")
    print("=" * 60)
    print()
    
    test_cases = [
        ("lite", service.lite_model),
        ("gray-lite", service.lite_model),
        ("claude-4.5", "anthropic/claude-sonnet-4.5"),
        ("gpt-5.1", "openai/gpt-5.1"),
        ("deepseek-v3.2", "deepseek/deepseek-v3.2-exp"),
        ("kimi-k2", "moonshotai/kimi-k2-thinking"),
    ]
    
    print("Testing model shorthand resolution:")
    for shorthand, expected in test_cases:
        resolved = service._resolve_model(shorthand)
        status = "✅" if resolved == expected else "❌"
        print(f"  {status} '{shorthand}' → '{resolved}'")
        if resolved != expected:
            print(f"      Expected: '{expected}'")
    
    print()


async def main():
    """Run all tests."""
    await test_model_resolution()
    print()
    await test_grok_lite()


if __name__ == "__main__":
    asyncio.run(main())
