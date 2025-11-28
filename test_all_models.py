#!/usr/bin/env python3
"""Comprehensive test of all OpenRouter models."""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from openrouter_client import OpenRouterService


async def test_model(service, model_name, display_name):
    """Test a single model."""
    print(f"\n{'='*60}")
    print(f"Testing: {display_name}")
    print(f"Model ID: {service._resolve_model(model_name)}")
    print('='*60)
    
    try:
        print(f"{display_name} says: ", end="", flush=True)
        
        has_response = False
        async for chunk in service.stream(
            message="Say hello in exactly 3 words.",
            model=model_name
        ):
            print(chunk, end="", flush=True)
            has_response = True
        
        if has_response:
            print("\n✅ SUCCESS!\n")
            return True
        else:
            print("\n❌ No response received\n")
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        return False


async def main():
    load_dotenv()
    
    service = OpenRouterService()
    
    print("=" * 60)
    print("OpenRouter Models - Comprehensive Test")
    print("=" * 60)
    print()
    
    # Test Scout tier (free)
    print("🆓 SCOUT TIER (FREE)")
    lite_success = await test_model(service, "lite", "Grok 4.1 Fast (Lite)")
    
    # Test Pioneer tier models
    print("\n" + "="*60)
    print("👑 PIONEER TIER MODELS")
    print("="*60)
    
    pioneer_models = [
        ("claude-4.5", "Claude Sonnet 4.5"),
        ("gpt-5.1", "GPT 5.1"),
        ("deepseek-v3.2", "DeepSeek V3.2 Exp"),
        ("kimi-k2", "Kimi K2 Thinking"),
    ]
    
    results = {"lite": lite_success}
    
    for model_id, display_name in pioneer_models:
        success = await test_model(service, model_id, display_name)
        results[model_id] = success
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    total = len(results)
    passed = sum(results.values())
    
    print(f"\n✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}\n")
    
    print("Detailed Results:")
    status_map = {True: "✅", False: "❌"}
    print(f"  {status_map[results.get('lite', False)]} Scout Tier: Grok 4.1 Fast")
    print(f"  {status_map[results.get('claude-4.5', False)]} Pioneer: Claude Sonnet 4.5")
    print(f"  {status_map[results.get('gpt-5.1', False)]} Pioneer: GPT 5.1")
    print(f"  {status_map[results.get('deepseek-v3.2', False)]} Pioneer: DeepSeek V3.2")
    print(f"  {status_map[results.get('kimi-k2', False)]} Pioneer: Kimi K2 Thinking")
    print(f"  ℹ️  Gemini 3: Uses direct Gemini API (not OpenRouter)")
    print()
    
    if passed == total:
        print("🎉 All OpenRouter models are working perfectly!")
    else:
        print("⚠️  Some models had issues. Check errors above.")


if __name__ == "__main__":
    asyncio.run(main())
