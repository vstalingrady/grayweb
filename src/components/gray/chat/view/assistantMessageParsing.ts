export type AssistantSections = {
  user: string | null;
  thinking: string | null;
  ai: string;
  isStructured: boolean;
};

export type ToolStatusInfo = {
  label: string;
  variant: "default" | "search";
};

type TagCandidate = {
  open: string;
  close: string;
  allowAnyPosition?: boolean;
};

// Memoized cache for parseStructuredAssistantMessage to avoid re-parsing same content
const parseCache = new Map<string, AssistantSections>();
const PARSE_CACHE_SIZE = 1000;

const FINAL_TAG_CANDIDATES: TagCandidate[] = [
  { open: "<final>", close: "</final>" },
  { open: "<answer>", close: "</answer>" },
  { open: "<response>", close: "</response>" },
];

const stripFinalWrapper = (value: string): string => {
  let output = value.trim();
  if (!output) {
    return output;
  }

  const lowerOutput = output.toLowerCase();
  for (const candidate of FINAL_TAG_CANDIDATES) {
    const openIndex = lowerOutput.indexOf(candidate.open);
    if (openIndex !== -1 && output.slice(0, openIndex).trim().length === 0) {
      const contentStart = openIndex + candidate.open.length;
      const closeIndex = lowerOutput.indexOf(candidate.close, contentStart);
      output =
        closeIndex !== -1 ? output.slice(contentStart, closeIndex).trim() : output.slice(contentStart).trim();
      break;
    }
  }

  output = output.replace(/^(final|answer|response)\s*:\s*/i, "");
  return output;
};

export const stripToolUseBlocks = (text: string): string => {
  if (!text) {
    return "";
  }
  let result = text;
  // Strip generic <tool_use>...</tool_use> style blocks that some providers emit.
  result = result.replace(/<tool_use[\s\S]*?<\/tool_use>/gi, "");
  // Strip tool call wrappers that some models emit as plain text.
  result = result.replace(/<tool_calls[\s\S]*?<\/tool_calls>/gi, "");
  result = result.replace(/<tool_calls[\s\S]*?<\/tool_call>/gi, "");
  result = result.replace(/<tool_call[\s\S]*?<\/tool_call>/gi, "");
  // Strip function/parameter tag payloads in tool call dumps.
  result = result.replace(/<function\s*=[\s\S]*?<\/function>/gi, "");
  result = result.replace(/<parameter\s*=[\s\S]*?<\/parameter>/gi, "");
  // Strip any residual <tool_result> blocks if present.
  result = result.replace(/<tool_result[\s\S]*?<\/tool_result>/gi, "");
  return result;
};

export const resolveToolStatusInfo = (
  toolName: string,
  t: (message: string, vars?: Record<string, string | number>) => string
): ToolStatusInfo | null => {
  if (!toolName) {
    return null;
  }

  const normalized = toolName.toLowerCase();

  if (normalized.includes("search") || normalized.includes("web")) {
    return { label: t("Searching"), variant: "search" };
  }
  if (normalized.includes("image") || normalized.includes("painting")) {
    return { label: t("Painting pixels..."), variant: "default" };
  }
  if (normalized.includes("plan") || normalized.includes("habit") || normalized.includes("calendar")) {
    return { label: t("Checking schedule..."), variant: "default" };
  }
  if (normalized.includes("memory") || normalized.includes("remember")) {
    return { label: t("Accessing memory..."), variant: "default" };
  }

  // Clean up snake_case or camelCase to Sentence case
  const readable = toolName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim();

  return { label: t("Using {tool}...", { tool: readable.toLowerCase() }), variant: "default" };
};

export const extractCurrentToolStatus = (
  text: string,
  t: (message: string, vars?: Record<string, string | number>) => string
): ToolStatusInfo | null => {
  if (!text) return null;

  // Look for the last tool_use block
  const matches = [...text.matchAll(/<tool_use>([\s\S]*?)<\/tool_use>/gi)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  const content = lastMatch[1];

  let toolName = "";

  try {
    // Try parsing as JSON first
    const json = JSON.parse(content);
    if (json.name) toolName = json.name;
    else if (json.tool) toolName = json.tool;
  } catch {
    // Fallback: simple regex search for "name": "foo"
    const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch) {
      toolName = nameMatch[1];
    }
  }

  if (!toolName) return null;

  return resolveToolStatusInfo(toolName, t);
};

export const parseStructuredAssistantMessage = (content?: string | null): AssistantSections => {
  const cacheKey = content ?? "";
  const cached = parseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const normalized = stripToolUseBlocks((content ?? "")).replace(/\r\n/g, "\n");
  const trimmed = normalized.trim();
  const base: AssistantSections = {
    user: null,
    thinking: null,
    ai: trimmed,
    isStructured: false,
  };

  if (!trimmed) {
    base.ai = "";
    return base;
  }

  const lower = normalized.toLowerCase();
  const findIndex = (needle: string, fromIndex = 0) => lower.indexOf(needle.toLowerCase(), fromIndex);

  // NEW: First check for <thinking> tags at the start (modern backend format)
  // This handles the case where backend sends: <thinking>content</thinking>\nActual response
  const thinkingTagCandidates: TagCandidate[] = [
    { open: "<thinking>", close: "</thinking>", allowAnyPosition: true },
    { open: "<analysis>", close: "</analysis>" },
    { open: "<reasoning>", close: "</reasoning>" },
    { open: "<chainofthought>", close: "</chainofthought>", allowAnyPosition: true },
    { open: "<chain_of_thought>", close: "</chain_of_thought>", allowAnyPosition: true },
  ];

  for (const candidate of thinkingTagCandidates) {
    const openIndex = findIndex(candidate.open);
    if (openIndex !== -1) {
      if (!candidate.allowAnyPosition) {
        const prefix = normalized.slice(0, openIndex);
        if (prefix.trim().length > 0) {
          continue;
        }
      }
      // Tags found in the message (some allow any position to support streaming with prefix content)
      const thinkingContentStart = openIndex + candidate.open.length;
      const closeIndex = findIndex(candidate.close, thinkingContentStart);

      if (closeIndex !== -1) {
        base.thinking = normalized.slice(thinkingContentStart, closeIndex).trim() || null;
        const afterTagIndex = closeIndex + candidate.close.length;
        base.ai = stripFinalWrapper(normalized.slice(afterTagIndex).trim());
      } else {
        // Tag opened but not closed (streaming)
        base.thinking = normalized.slice(thinkingContentStart).trim() || null;
        base.ai = "";
      }

      base.isStructured = true;
      // Cache and return early
      parseCache.set(cacheKey, base);
      if (parseCache.size > PARSE_CACHE_SIZE) {
        const firstKey = parseCache.keys().next().value;
        if (firstKey !== undefined) {
          parseCache.delete(firstKey);
        }
      }
      return base;
    }
  }

  // LEGACY: Fall back to labeled format ("thinking (not visible):", "chain of thought:")
  const userLabel = "user:";
  const thinkingLabel = "thinking (not visible):";
  const chainOfThoughtLabel = "chain of thought:";
  const aiLabel = "ai:";

  const userIndex = findIndex(userLabel);
  const thinkingLabelIndex = findIndex(thinkingLabel);
  const chainLabelIndex = findIndex(chainOfThoughtLabel);
  const effectiveThinkingIndex = thinkingLabelIndex !== -1 ? thinkingLabelIndex : chainLabelIndex;
  const effectiveThinkingLabel =
    thinkingLabelIndex !== -1 && thinkingLabelIndex === effectiveThinkingIndex ? thinkingLabel : chainOfThoughtLabel;
  const aiLabelIndex = findIndex(aiLabel);

  if (userIndex !== -1 && effectiveThinkingIndex !== -1 && userIndex < effectiveThinkingIndex) {
    const userStart = userIndex + userLabel.length;
    base.user = normalized.slice(userStart, effectiveThinkingIndex).trim() || null;
    base.isStructured = true;
  }

  let afterThinkingIndex = -1;
  if (effectiveThinkingIndex !== -1) {
    let tagBounds: { start: number; open: string; close: string } | null = null;
    for (const candidate of thinkingTagCandidates) {
      const candidateStart = findIndex(candidate.open, effectiveThinkingIndex);
      if (candidateStart !== -1) {
        tagBounds = { start: candidateStart, open: candidate.open, close: candidate.close };
        break;
      }
    }

    if (tagBounds) {
      const thinkingContentStart = tagBounds.start + tagBounds.open.length;
      const thinkingTagEnd = findIndex(tagBounds.close, thinkingContentStart);
      if (thinkingTagEnd !== -1) {
        base.thinking = normalized.slice(thinkingContentStart, thinkingTagEnd).trim() || null;
        afterThinkingIndex = thinkingTagEnd + tagBounds.close.length;
      } else {
        base.thinking = normalized.slice(thinkingContentStart).trim() || null;
        afterThinkingIndex = normalized.length;
      }
    } else {
      const fallbackStart = effectiveThinkingIndex + effectiveThinkingLabel.length;
      const fallbackEnd = aiLabelIndex !== -1 ? aiLabelIndex : normalized.length;
      base.thinking = normalized.slice(fallbackStart, fallbackEnd).trim() || null;
      afterThinkingIndex = fallbackEnd;
    }
    base.isStructured = true;
  }

  if (aiLabelIndex !== -1) {
    base.ai = stripFinalWrapper(normalized.slice(aiLabelIndex + aiLabel.length).trim());
    base.isStructured = true;
  } else if (afterThinkingIndex !== -1 && afterThinkingIndex < normalized.length) {
    base.ai = stripFinalWrapper(normalized.slice(afterThinkingIndex).trim());
  }

  // Cache the result with LRU eviction
  parseCache.set(cacheKey, base);
  if (parseCache.size > PARSE_CACHE_SIZE) {
    // Remove oldest entry (first key)
    const firstKey = parseCache.keys().next().value;
    if (firstKey !== undefined) {
      parseCache.delete(firstKey);
    }
  }

  return base;
};
