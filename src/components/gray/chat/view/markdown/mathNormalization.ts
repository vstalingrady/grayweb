const INLINE_LATEX_REGEX = /\\\(([\s\S]+?)\\\)/g;
const DISPLAY_LATEX_REGEX = /\\\[([\s\S]+?)\\\]/g;
const INLINE_DOLLAR_LATEX_REGEX = /\$([^\n$]+?)\$/g;
const DISPLAY_DOLLAR_LATEX_REGEX = /\$\$([\s\S]+?)\$\$/g;
const MIN_TILDE_FENCE_LENGTH = 3;

const looksLikeMathContent = (content: string): boolean => {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  if (/[\\]/.test(trimmed)) {
    return true;
  }
  if (/\d+\s*[%+\-/*=<>]\s*\d+/.test(trimmed)) {
    return true;
  }
  if (/[{}^_=+\-/*<>]/.test(trimmed)) {
    return true;
  }
  return /\\(begin|end|frac|sum|int|lim|sqrt)/i.test(trimmed);
};

const wrapDisplayMathBlock = (content: string): string => {
  const normalized = content.trim();
  if (!normalized) {
    return "";
  }
  return `\n\n$$\n${normalized}\n$$\n\n`;
};

const wrapInlineMath = (content: string): string => {
  const normalized = content.trim();
  if (!normalized) {
    return "";
  }
  return `$$${normalized}$$`;
};

const normalizeLatexSegment = (segment: string): string => {
  if (!segment) {
    return segment;
  }
  let updated = segment;

  // Normalize block math written as `$$ ... $$` into fenced blocks so
  // remark-math / rehype-katex can render it reliably.
  updated = updated.replace(DISPLAY_DOLLAR_LATEX_REGEX, (_match, content: string) => {
    const wrapped = wrapDisplayMathBlock(content);
    return wrapped;
  });

  // Normalize inline math written as `$ ... $` into inline double-dollar
  // fences to avoid confusing currency like `$20`.
  updated = updated.replace(INLINE_DOLLAR_LATEX_REGEX, (match, content: string) => {
    if (!looksLikeMathContent(content)) {
      return match;
    }
    const inlineWrapped = wrapInlineMath(content);
    return inlineWrapped;
  });

  // Clean up any existing `\\[...\\]` markers by trimming inner whitespace
  // and rewriting them as double-dollar display blocks.
  updated = updated.replace(DISPLAY_LATEX_REGEX, (_match, content: string) => {
    const wrapped = wrapDisplayMathBlock(content);
    return wrapped;
  });

  // Normalize inline `\\(...\\)` markers into inline double-dollar fences.
  updated = updated.replace(INLINE_LATEX_REGEX, (_match, content: string) => {
    const inlineWrapped = wrapInlineMath(content);
    return inlineWrapped;
  });

  return updated;
};

export const normalizeLatexForDisplay = (value: string): string => {
  if (!value || (value.indexOf("\\(") === -1 && value.indexOf("\\[") === -1 && value.indexOf("$") === -1)) {
    return value;
  }

  type Segment = { type: "code" | "text"; value: string };
  const segments: Segment[] = [];
  let cursor = 0;

  const findNextFenceIndex = (source: string, start: number) => {
    const nextBacktick = source.indexOf("`", start);
    const nextTilde = source.indexOf("~", start);
    if (nextBacktick === -1) {
      return nextTilde;
    }
    if (nextTilde === -1) {
      return nextBacktick;
    }
    return Math.min(nextBacktick, nextTilde);
  };

  while (cursor < value.length) {
    const nextFenceIndex = findNextFenceIndex(value, cursor);
    if (nextFenceIndex === -1) {
      segments.push({ type: "text", value: value.slice(cursor) });
      break;
    }

    if (nextFenceIndex > cursor) {
      segments.push({ type: "text", value: value.slice(cursor, nextFenceIndex) });
    }

    const fenceChar = value[nextFenceIndex];
    if (fenceChar !== "`" && fenceChar !== "~") {
      segments.push({ type: "text", value: fenceChar });
      cursor = nextFenceIndex + 1;
      continue;
    }

    let fenceLength = 1;
    while (nextFenceIndex + fenceLength < value.length && value[nextFenceIndex + fenceLength] === fenceChar) {
      fenceLength += 1;
    }
    const isBacktickFence = fenceChar === "`";
    const isTildeFence = fenceChar === "~" && fenceLength >= MIN_TILDE_FENCE_LENGTH;
    if (!isBacktickFence && !isTildeFence) {
      segments.push({
        type: "text",
        value: value.slice(nextFenceIndex, nextFenceIndex + fenceLength),
      });
      cursor = nextFenceIndex + fenceLength;
      continue;
    }

    const fenceToken = fenceChar.repeat(fenceLength);
    const closingIndex = value.indexOf(fenceToken, nextFenceIndex + fenceLength);
    if (closingIndex === -1) {
      segments.push({ type: "text", value: value.slice(nextFenceIndex) });
      break;
    }

    segments.push({
      type: "code",
      value: value.slice(nextFenceIndex, closingIndex + fenceLength),
    });
    cursor = closingIndex + fenceLength;
  }

  return segments
    .map((segment) => (segment.type === "code" ? segment.value : normalizeLatexSegment(segment.value)))
    .join("");
};

export const normalizeAssistantMath = (value: string | null | undefined): string | null => {
  if (typeof value !== "string" || !value) {
    return value ?? null;
  }
  return normalizeLatexForDisplay(value);
};

