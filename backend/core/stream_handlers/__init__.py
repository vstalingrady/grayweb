"""
Stream Handlers Package

Contains streaming handlers for different AI providers:
- gemini_stream.py: Gemini streaming with multi-turn tool execution
- openrouter.py: OpenRouter streaming handler
- hybrid.py: Hybrid tool execution flow using Gemini Flash
- context.py: Context and workspace builders
"""

from .gemini_stream import stream_gemini_response

__all__ = ["stream_gemini_response"]
