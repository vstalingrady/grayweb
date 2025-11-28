"""
Example usage of the OpenRouter service in Gray backend.

This shows how to use OpenRouter for Pioneer tier users who want
to access models like Claude 4.5, Grok 4.1, GPT 5.1, etc.
"""

import asyncio
import os
from dotenv import load_dotenv

# Add backend to path if running as standalone script
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from openrouter_client import OpenRouterService


async def example_basic_usage():
    """Basic usage example with shorthand model names."""
    service = OpenRouterService()
    
    if not service.available:
        print("⚠️  OpenRouter not configured. Set OPENROUTER_API_KEY in .env")
        return
    
    print("🚀 OpenRouter Service Ready")
    print()
    
    # Example 1: Using shorthand model names
    print("Example 1: Claude 4.5 with shorthand")
    response = await service.generate(
        message="Explain quantum entanglement in one sentence.",
        model="claude-4.5"
    )
    print(f"Response: {response}")
    print()


async def example_streaming():
    """Streaming response example."""
    service = OpenRouterService()
    
    if not service.available:
        print("⚠️  OpenRouter not configured. Set OPENROUTER_API_KEY in .env")
        return
    
    print("Example 2: Streaming with Grok 4.1")
    print("Response: ", end="", flush=True)
    
    async for chunk in service.stream(
        message="Write a haiku about AI",
        model="grok-4.1"
    ):
        print(chunk, end="", flush=True)
    
    print("\n")


async def example_with_history():
    """Example with conversation history."""
    service = OpenRouterService()
    
    if not service.available:
        print("⚠️  OpenRouter not configured. Set OPENROUTER_API_KEY in .env")
        return
    
    print("Example 3: Multi-turn conversation with GPT 5.1")
    
    # Simulate conversation history
    history = [
        {"role": "user", "text": "What is the capital of France?"},
        {"role": "model", "text": "The capital of France is Paris."},
        {"role": "user", "text": "What's the population?"},
    ]
    
    response = await service.generate(
        message="And what about its area?",
        conversation_history=history,
        model="gpt-5.1"
    )
    print(f"Response: {response}")
    print()


async def example_full_model_id():
    """Example using full OpenRouter model ID."""
    service = OpenRouterService()
    
    if not service.available:
        print("⚠️  OpenRouter not configured. Set OPENROUTER_API_KEY in .env")
        return
    
    print("Example 4: Using full model ID")
    response = await service.generate(
        message="What is 2+2?",
        model="anthropic/claude-3.5-sonnet"  # Full model ID
    )
    print(f"Response: {response}")
    print()


async def example_with_system_prompt():
    """Example with custom system prompt."""
    service = OpenRouterService()
    
    if not service.available:
        print("⚠️  OpenRouter not configured. Set OPENROUTER_API_KEY in .env")
        return
    
    print("Example 5: With system prompt (DeepSeek V3.2)")
    response = await service.generate(
        message="Hello!",
        system_prompt="You are a helpful assistant who speaks like a pirate.",
        model="deepseek-v3.2"
    )
    print(f"Response: {response}")
    print()


async def main():
    """Run all examples."""
    load_dotenv()
    
    print("=" * 60)
    print("OpenRouter Integration Examples")
    print("=" * 60)
    print()
    
    # Check if API key is set
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key or api_key == "your-openrouter-api-key":
        print("❌ OPENROUTER_API_KEY not set in .env file")
        print()
        print("To use these examples:")
        print("1. Get an API key from https://openrouter.ai/")
        print("2. Add it to your .env file:")
        print("   OPENROUTER_API_KEY=sk-or-v1-your-key-here")
        print()
        return
    
    try:
        # Run examples
        await example_basic_usage()
        await example_streaming()
        await example_with_history()
        await example_full_model_id()
        await example_with_system_prompt()
        
        print("✅ All examples completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
