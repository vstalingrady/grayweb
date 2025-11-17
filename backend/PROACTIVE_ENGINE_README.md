# Proactive Engine (Template Mode)

The proactive engine still ships with deterministic templates for daily briefings, weekly reviews, and habit nudges. This module deliberately avoids any Gemini calls so the nudges stay predictable while the chat endpoints can still leverage the model when a key is provided.

## Environment

Only the standard database credentials are strictly required for the proactive engine. The broader backend, however, honors `GEMINI_API_KEY` (and optional overrides like `GEMINI_LIGHT_MODEL`) whenever the chat routes are invoked.

## Behaviour

`ai_message_generator.AIMessageGenerator` reads dashboard pulses, plans, and habits, then emits friendly plain text messages built from the current context. When tone or proactivity hints are provided, small phrasing changes are applied in code rather than via an AI API.

## Extending

To change the voice or copy, edit the helper methods inside `ai_message_generator.py` or add new template functions. Because everything runs locally, adjustments are fast and do not require model retraining or quota management.
