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

### Model-agnostic grounding
You can incorporate relevant web search results for any model on OpenRouter by activating and customizing the web plugin, or by appending `:online` to the model slug:

```json
{
  "model": "openai/gpt-5.2:online"
}
```

You can also append `:online` to `:free` model variants like so:

```json
{
  "model": "openai/gpt-oss-20b:free:online"
}
```

Using web search will incur extra costs, even with free models.

`:online` is a shortcut for using the web plugin, and is exactly equivalent to:

```json
{
  "model": "openrouter/auto",
  "plugins": [{ "id": "web" }]
}
```

The web search plugin is powered by native search for Anthropic, OpenAI, Perplexity, and xAI models.
For xAI models, the web search plugin enables both Web Search and X Search.
For other models, the web search plugin is powered by Exa. It uses their "auto" method (a combination of keyword search and embeddings-based web search) to find the most relevant results and augment/ground your prompt.

### Parsing web search results
Web search results for all models (including native-only models like Perplexity and OpenAI Online) are available in the API and standardized by OpenRouter to follow the same annotation schema in the OpenAI Chat Completion Message type:

```json
{
  "message": {
    "role": "assistant",
    "content": "Here's the latest news I found: ...",
    "annotations": [
      {
        "type": "url_citation",
        "url_citation": {
          "url": "https://www.example.com/web-search-result",
          "title": "Title of the web search result",
          "content": "Content of the web search result",
          "start_index": 100,
          "end_index": 200
        }
      }
    ]
  }
}
```

### Customizing the Web Plugin
The maximum results allowed by the web plugin and the prompt used to attach them to your message stream can be customized:

```json
{
  "model": "openai/gpt-5.2:online",
  "plugins": [
    {
      "id": "web",
      "engine": "exa",
      "max_results": 1,
      "search_prompt": "Some relevant web results:"
    }
  ]
}
```

By default, the web plugin uses the following search prompt, using the current date:

A web search was conducted on `date`. Incorporate the following web search results into your response.
IMPORTANT: Cite them using markdown links named using the domain of the source.
Example: [nytimes.com](https://nytimes.com/some-page).

### Engine Selection
The web search plugin supports the following options for the `engine` parameter:

- `native`: Always uses the model provider's built-in web search capabilities.
- `exa`: Uses Exa's search API for web results.
- `undefined` (not specified): Uses native search if available for the provider, otherwise falls back to Exa.

### Default Behavior
When the `engine` parameter is not specified:

- Native search is used by default for OpenAI, Anthropic, Perplexity, and xAI models that support it.
- Exa search is used for all other models or when native search is not supported.

### Forcing Engine Selection
You can explicitly specify which engine to use:

```json
{
  "model": "openai/gpt-5.2",
  "plugins": [
    {
      "id": "web",
      "engine": "native"
    }
  ]
}
```

Or force Exa search even for models that support native search:

```json
{
  "model": "openai/gpt-5.2",
  "plugins": [
    {
      "id": "web",
      "engine": "exa",
      "max_results": 3
    }
  ]
}
```

### Engine-Specific Pricing
- Native search: Pricing is passed through directly from the provider (see provider-specific pricing info below).
- Exa search: Uses OpenRouter credits at $4 per 1000 results (default 5 results = $0.02 per request).

### Pricing
#### Exa Search Pricing
When using Exa search (either explicitly via `"engine": "exa"` or as fallback), the web plugin uses your OpenRouter credits and charges $4 per 1000 results. By default, `max_results` is set to 5, which is a maximum of $0.02 per request, in addition to the LLM usage for the search result prompt tokens.

#### Native Search Pricing (Provider Passthrough)
Some models have built-in web search. These models charge a fee based on the search context size, which determines how much search data is retrieved and processed for a query.

##### Search Context Size Thresholds
Search context can be "low", "medium", or "high" and determines how much search context is retrieved for a query:

- Low: Minimal search context, suitable for basic queries
- Medium: Moderate search context, good for general queries
- High: Extensive search context, ideal for detailed research

##### Specifying Search Context Size
You can specify the search context size in your API request using the `web_search_options` parameter:

```json
{
  "model": "openai/gpt-4.1",
  "messages": [
    {
      "role": "user",
      "content": "What are the latest developments in quantum computing?"
    }
  ],
  "web_search_options": {
    "search_context_size": "high"
  }
}
```

Native web search pricing only applies when using `"engine": "native"` or when native search is used by default for supported models. When using `"engine": "exa"`, the Exa search pricing applies instead.

##### Native Web Search Pricing
Refer to each provider's documentation for their native web search pricing info:

- OpenAI Pricing
- Anthropic Pricing
- Perplexity Pricing
- xAI Pricing

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
