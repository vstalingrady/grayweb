# OpenRouter API Reference

> Fetched on 2025-12-06 from https://openrouter.ai/docs/

---

## Overview (Responses API Beta)

- **Base URL**: `https://openrouter.ai/api/v1/responses`
- **Stateless**: Each request is independent. You must include the full conversation history in each request.
- **Authentication**: `Authorization: Bearer YOUR_OPENROUTER_API_KEY`

---

## Tool Calling

### Basic Tool Definition
```json
{
  "type": "function",
  "name": "get_weather",
  "description": "Get the current weather in a location",
  "strict": null,
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "The city and state, e.g. San Francisco, CA"
      }
    },
    "required": ["location"]
  }
}
```

### Tool Choice Options
| Tool Choice | Description |
|-------------|-------------|
| `auto` | Model decides whether to call tools |
| `none` | Model will not call any tools |
| `{type: 'function', name: 'tool_name'}` | Force specific tool call |

### Tool Call Response Format
```json
{
  "output": [
    {
      "type": "function_call",
      "id": "fc_abc123",
      "call_id": "call_xyz789",
      "name": "get_weather",
      "arguments": "{\"location\":\"San Francisco, CA\"}"
    }
  ]
}
```

### Streaming Tool Calls
- Use `stream: true`
- Events: `response.output_item.added` (type: function_call), `response.function_call_arguments.done`

---

## Reasoning

### Configuration
```json
{
  "reasoning": {
    "effort": "high"  // minimal, low, medium, high
  }
}
```

### Streaming Reasoning
- Event: `response.reasoning.delta`

### Response with Reasoning
```json
{
  "output": [
    {
      "type": "reasoning",
      "id": "rs_abc123",
      "encrypted_content": "...",
      "summary": ["Step 1", "Step 2"]
    },
    {
      "type": "message",
      "content": [{"type": "output_text", "text": "..."}]
    }
  ]
}
```

---

## Web Search

### Enable via Plugin
```json
{
  "plugins": [{ "id": "web", "max_results": 3 }]
}
```

### Or use `:online` model variants
```
model: "openai/o4-mini:online"
```

### Response Annotations
```json
{
  "annotations": [
    {
      "type": "url_citation",
      "url": "https://example.com",
      "start_index": 0,
      "end_index": 50
    }
  ]
}
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | float | 1.0 | 0.0-2.0. Lower = predictable |
| `max_tokens` | int | - | Max output tokens |
| `top_p` | float | 1.0 | Nucleus sampling |
| `top_k` | int | 0 | Top-k sampling (0 = disabled) |
| `frequency_penalty` | float | 0.0 | -2.0 to 2.0 |
| `presence_penalty` | float | 0.0 | -2.0 to 2.0 |
| `repetition_penalty` | float | 1.0 | 0.0-2.0 |
| `stop` | array | - | Stop sequences |
| `tool_choice` | string/object | - | auto, none, required, or specific |
| `parallel_tool_calls` | bool | true | Allow multiple simultaneous calls |
| `response_format` | object | - | `{"type": "json_object"}` for JSON mode |

---

## Authentication

- **Header**: `Authorization: Bearer <OPENROUTER_API_KEY>`
- **Optional Headers**:
  - `HTTP-Referer`: Site URL for rankings
  - `X-Title`: Site title for rankings

---

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "invalid_prompt",
    "message": "Detailed error description"
  },
  "metadata": null
}
```

### Error Codes
| Code | Description | HTTP Status |
|------|-------------|-------------|
| `invalid_prompt` | Request validation failed | 400 |
| `rate_limit_exceeded` | Too many requests | 429 |
| `server_error` | Internal server error | 500+ |

---

## Chat Completions API (Standard)

**Base URL**: `https://openrouter.ai/api/v1/chat/completions`

### Request Format
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true,
  "max_tokens": 4096,
  "temperature": 0.7,
  "tools": [...],
  "tool_choice": "auto"
}
```

### Streaming Response (SSE)
```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"tool_calls":[...]}}]}
data: [DONE]
```

---

## OpenRouter-Specific Features

### Provider Routing
```json
{
  "provider": {
    "sort": "price",  // Prioritize cheapest provider
    "allow_fallbacks": true
  }
}
```

### Context Compression
```json
{
  "transforms": ["middle-out"]  // Compress long contexts
}
```
