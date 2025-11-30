#!/usr/bin/env python3
"""Quick test to verify AIMessageGenerator is using Grok"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Capture the initialization message
from ai_message_generator import AIMessageGenerator

print(f"\n{'='*60}")
print("Testing AIMessageGenerator initialization...")
print(f"{'='*60}\n")

gen = AIMessageGenerator()

# Check what service it's using
if hasattr(gen, 'openrouter'):
    print("✓ AIMessageGenerator is using OpenRouter (Grok)!")
    print(f"  - OpenRouter available: {gen.openrouter.available}")
elif hasattr(gen, 'gemini'):
    print("✗ AIMessageGenerator is still using Gemini!")
    print(f"  - Gemini available: {gen.gemini.available}")
else:
    print("? Unknown AI service")

print(f"\n{'='*60}\n")
