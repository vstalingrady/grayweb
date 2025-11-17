# Gemini Long Context Guide

Many Gemini models provide context windows of **1 million tokens or more**, opening new paradigms around how you prompt and what the model can process in one request.

## What is a context window?

The context window is like the model's short-term memory—the total amount of tokens you can pass at once in a prompt. Gemini’s long context models let you keep far more data in memory without needing complex retrieval or summarization tricks.

## Getting started with long context

Earlier LLMs were capped at 8K or 32K tokens, forcing developers to drop old turns or rely exclusively on RAG. Gemini can accept 1M tokens, which means you can pass entire code repositories, months of chat history, multiple documents, transcripts, and more together.

Example equivalencies:

- ~50,000 lines of code at 80 characters per line
- 8 average English novels
- 5 years of chat transcripts
- 200 podcast transcripts

Gemini still works with the same SDKs you already use—just send the larger inputs, and the model handles them natively. This unlocks powerful in-context learning, such as many-shot prompts with hundreds or thousands of examples.

## Use cases enabled by long context

- **Long-form text:** summarizing a corpus in one shot, answering questions over a complete report, agents with persistent state.
- **Video/audio:** include transcripts, metadata, and prompt text in one prompt so Gemini can reason about the whole media without stitching batches.
- **Multimodal workflows:** send multiple documents, PDFs, images, and prompt text together and avoid repeated RAG queries.
- **Many-shot learning:** drop hundreds of annotated examples into the prompt for bespoke tasks (e.g., grammar/extraction rules) instead of fine-tuning.

## Optimization strategies

- **Context caching** keeps large datasets around so you don’t re-send the same megabytes of tokens every time. Cache once and reuse the same blob, reducing per-request cost dramatically.
- **Context caching API**: Gray exposes endpoints to store prebuilt contexts (label, content, optional conversation id) and reuse them by passing the cache ID with every chat request. This makes it easy to keep standardized bundles (documents, plan summaries, code) in memory without recomputing them each time.
- **Place your question at the end** of the prompt so the model knows what to do after ingesting the long context.
- **Trim tokens you don’t need**—long context is powerful, but costs still scale with token count.

## Limitations

- Accuracy can vary if you need multiple precise “needles” in the haystack; Gemini might still miss one, so you may send multiple specialized prompts or split the context.
- Each request still incurs input/output costs, so reuse cached contexts for repeated queries or break tasks into smaller pieces when you need extreme precision.

## FAQs

- **Where’s the best place for my query?** Toward the end—after passing all the supporting context—so the question is freshest in the window.
- **Does adding more tokens hurt performance?** Not if you need them; Gemini can reason over them with high accuracy, but unnecessary tokens still consume the context budget.
- **How can I lower costs?** Cache recurring contexts, reuse them, and only add new material when needed (context caching is your best friend here).

## Related links

- [Function calling & structured outputs](./gemini-multimodal.md#function-calling-and-structured-outputs-for-rag)
- [Context caching guide](https://ai.google.dev/gemini-api/docs/caching)
