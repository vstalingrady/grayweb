# Gemini Multimodal Guide

Gray currently uses Gemini Flash and Flash Lite for text-based conversations, but the models are multimodal by design. This guide summarizes the key workflows for sending images and documents, plus tips for object detection/segmentation, limits, and best practices so you can safely add richer inputs in the future.

## Why multimodal matters

Gemini 2.0+ models can caption, classify, answer questions about, and understand entire documents (PDFs) without requiring a separate computer vision stack. They also include extra training for use cases such as object detection (2.0 models) and segmentation (2.5 models), so anything that benefits from bounding boxes or masks can often be handled directly inside the model.

## Passing images

### Inline image data

- Suitable for small files (total request ≤ 20 MB, counting prompt, instructions, and bytes).
- Inline data can be Base64 bytes or `Part.from_bytes`/`Part.from_text` combinations.
- Place the image part before any prompt text that should refer to it (for clarity, captions usually follow the image part).

Examples:

- **Python:** open the file, read bytes, build `types.Part.from_bytes(..., mime_type="image/jpeg")`, and include it in `client.models.generate_content` alongside the text prompt.
- **JavaScript:** read the file as Base64 (`fs.readFileSync`), or fetch a remote URL and use `Buffer.from(arrayBuffer).toString("base64")`, then send it inside `inlineData`.
- **Go:** create `genai.Part` objects (image part plus text part) and wrap them in `genai.Content`.
- **REST:** Base64 encode bytes, then send them in the `contents[*].parts[].inline_data` payload.

### File API uploads

- Use the Files Upload endpoints when the image is large, reused across requests, or when you need caching.
- Upload once (`client.files.upload` / `ai.files.upload`), then reference the file via URI when calling `generate_content`.
- Works for images, PDFs, or any multimodal assets that exceed inline limits.

### Multiple images

Mix inline data and File API references in the same request (e.g., upload one image, inline another, then ask “What differs between these two?”). Each image is just another `Part` inside the `contents` list.

## Document (PDF) inputs

- PDFs can be uploaded inline (Base64 or direct file bytes) when the total request is under 20 MB.
- For long or large documents, always use the Files API: upload with `files.upload`, wait for processing, then add the returned file to the `contents` array.
- Gemini understands both text and visual layout, so prompts can ask for summaries, comparisons, or structured extractions (JSON responses are supported by setting `response_mime_type="application/json"`).
- You can include multiple PDFs in a single request by uploading each and adding both file references before the prompt text.

## Object detection & segmentation

- Set `thinking_budget=0` in `GenerateContentConfig` when requesting structured outputs such as bounding boxes or segmentation masks; it improves precision for these vision workloads.
- The model returns coordinates (normalized 0–1000) in `[y0, x0, y1, x1]` format—scale them back to your image dimensions for real pixel boxes.
- Segmentation responses include base64-encoded PNG masks within each item’s `mask` field. Resize each mask to its bounding box, threshold the mask (e.g., >127) and composite it over the original image to visualize overlays.

## Limits & tokens

- All Gemini 2.0/2.5 Flash/Pro variants cap at 3,600 image files per request.
- Images ≤ 384px per side cost 258 tokens; larger images are tiled into 768×768 crops (each tile = 258 tokens). Estimate tiles by dividing each dimension by `floor(min(width, height)/1.5)` and multiplying.
- Document pages are also counted as 258 tokens each, with a ~1,000 page maximum per request.
- Combined request size (images + text + instructions) must stay within the context window and the inline 20 MB quota unless you use the Files API.

## Tips & best practices

- Rotate media to the correct orientation before uploading.
- Provide sharp, well-lit images for clarity.
- When mixing images with text, place the textual instructions after all the media parts so the model sees the visuals first.
- Disable thinking (set `thinking_budget` to 0) for structured outputs like bounding boxes and segmentation masks—this often yields cleaner JSON.

## Next steps

1. Add inline `Part.from_bytes` or File API references inside the conversation payload whenever you need the assistant to describe or reason about visual content.
2. Use `response_mime_type="application/json"` for structured extraction tasks (object detection/segmentation) and parse the returned JSON in the backend before streaming or storing results.
3. Explore the Gemini Cookbook (linked in the official docs) for notebooks covering spatial understanding, segmentation, and document prompting strategies as you expand Gray’s multimodal capabilities.


## Function calling and structured outputs for RAG

If Gray needs to integrate RAG data, function calling gives the model a way to “call out” to your retrieval layer or business logic instead of hallucinating answers. Define a declaration that matches your search/retrieval endpoint or any action you need (e.g., `get_recent_notes`, `fetch_table_row`, `schedule_meeting`). When the model decides a function call is appropriate, parse the schema passed in `function_call`, execute the requested tool, and return the tool’s result on the next turn so the model can produce a final, user-friendly answer that includes the retrieved data.

Structured outputs are another great fit for RAG because they keep responses predictable and machine-readable. You can provide a JSON schema (via `response_json_schema` + `response_mime_type="application/json"`) or pull schemas from Pydantic/Zod, and Gemini will emit perfectly typed JSON that matches your expected fields (e.g., `source`, `confidence`, `summary`). This makes it easy to validate retrieval results on the backend and to detect refusals when a part of the schema is missing.

Together, tooling and structured outputs let Gray:

- Route Gemini’s reasoning toward precise data (`function_call` → call your search/knowledge service → send the result back to the model).
- Receive predictable, schema-driven responses that accommodate downstream workflows like logging, UI rendering, or triggering automatic actions.

Keep your schemas focused (few fields, clear descriptions) so the model stays within context and respects your token budget. You can layer this on top of the upload/attachment flow above by including schema declarations alongside any media-enhanced prompt.

## Google Maps grounding

Grounding with Google Maps is a tool-driven way to surface accurate, up-to-date, location-aware answers. When you enable `tools: [{ googleMaps: {} }]` in your `generateContent` request (and optionally pass `toolConfig.retrievalConfig.latLng` plus `enableWidget`), Gemini calls Maps, harvests grounded chunks, and returns `groundingMetadata` with citations plus a `googleMapsWidgetContextToken`. Use that metadata to display inline sources, provide the required attribution, and optionally render the maps widget with the returned token. This works especially well in combination with the other tooling knobs (function calls, schema enforcement, attachments) because the chats already route through the same `GeminiService` pipeline we built earlier.

## Long context notes

Gemini’s 1M+-token windows mean Gray can keep entire projects, dozens of documents, or long chat histories in a single prompt without slicing or summarizing upstream. For your RAG-style workflows you can still cache uploads (media, PDFs, etc.), but you no longer have to drop information just because it’s “too long.” The model can handle many-shots, long transcripts, or multi-document comparison prompts in one request; just keep injecting new info near the end of the prompt so the latest question is freshest. Use context caching on repeat queries to reduce costs while still leveraging the massive window for in-context learning.
