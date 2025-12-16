export type AssistantSections = {
  user: string | null;
  thinking: string | null;
  ai: string;
  isStructured: boolean;
};

// Memoized cache for parseStructuredAssistantMessage to avoid re-parsing same content
const parseCache = new Map<string, AssistantSections>();
const PARSE_CACHE_SIZE = 1000;

export const stripToolUseBlocks = (text: string): string => {
  if (!text) {
    return "";
  }
  let result = text;
  // Strip generic <tool_use>...</tool_use> style blocks that some providers emit.
  result = result.replace(/<tool_use[\s\S]*?<\/tool_use>/gi, "");
  // Strip any residual <tool_result> blocks if present.
  result = result.replace(/<tool_result[\s\S]*?<\/tool_result>/gi, "");
  return result;
};

export const extractCurrentToolStatus = (
  text: string,
  t: (message: string, vars?: Record<string, string | number>) => string
): string | null => {
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

  const normalized = toolName.toLowerCase();

  if (normalized.includes("search") || normalized.includes("web")) {
    return t("Reading the internet...");
  }
  if (normalized.includes("image") || normalized.includes("painting")) {
    return t("Painting pixels...");
  }
  if (normalized.includes("plan") || normalized.includes("habit") || normalized.includes("calendar")) {
    return t("Checking schedule...");
  }
  if (normalized.includes("memory") || normalized.includes("remember")) {
    return t("Accessing memory...");
  }

  // Clean up snake_case or camelCase to Sentence case
  const readable = toolName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim();

  return t("Using {tool}...", { tool: readable.toLowerCase() });
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
  const thinkingTagCandidates = [
    { open: "<thinking>", close: "</thinking>" },
    { open: "<chainofthought>", close: "</chainofthought>" },
    { open: "<chain_of_thought>", close: "</chain_of_thought>" },
  ];

  for (const candidate of thinkingTagCandidates) {
    const openIndex = findIndex(candidate.open);
    if (openIndex !== -1) {
      // Tags found in the message (allow any position to support streaming with prefix content)
      const thinkingContentStart = openIndex + candidate.open.length;
      const closeIndex = findIndex(candidate.close, thinkingContentStart);

      if (closeIndex !== -1) {
        base.thinking = normalized.slice(thinkingContentStart, closeIndex).trim() || null;
        const afterTagIndex = closeIndex + candidate.close.length;
        base.ai = normalized.slice(afterTagIndex).trim();
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
    base.ai = normalized.slice(aiLabelIndex + aiLabel.length).trim();
    base.isStructured = true;
  } else if (afterThinkingIndex !== -1 && afterThinkingIndex < normalized.length) {
    base.ai = normalized.slice(afterThinkingIndex).trim();
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

