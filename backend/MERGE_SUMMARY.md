# Merge Summary

- Added `gemini_client.GeminiService` to wrap the `google-genai` SDK and keep streaming, thinking budgets, and history pruning centralized.
- Rewired `generate_ai_response`/`stream_ai_response` to prefer Gemini while keeping the structured template fallback when the API key or request fails.
- Updated documentation and requirements to describe the new Gemini dependencies, env vars, and keep the proactive templates untouched.
