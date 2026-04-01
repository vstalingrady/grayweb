const REASONING_TAG_GROUP = "(?:thinking|analysis|reasoning|chainofthought|chain_of_thought)";
const REASONING_OPEN_TAG_PATTERN = new RegExp(`<${REASONING_TAG_GROUP}>`, "i");
const REASONING_CLOSE_TAG_PATTERN = new RegExp(`</${REASONING_TAG_GROUP}>`, "i");

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, " ");

export type ReasoningTransition = {
  opened: boolean;
  closed: boolean;
  thinkingStartedAtMs: number | null;
  reasoningSeconds: number | null;
};

type StreamReasoningTracker = {
  onAccumulatedText: (nextText: string, nowMs: number) => ReasoningTransition;
  selectFinalResponseSource: (streamedText: string, endResponseText: string) => string;
  finalizeReasoningFromResponse: (responseSource: string, nowMs: number) => number | null;
};

export const createStreamReasoningTracker = (streamStartedAtMs: number): StreamReasoningTracker => {
  let previousText = "";
  let thinkingStartedAtMs: number | null = null;
  let reasoningSeconds: number | null = null;

  const hasReasoningTags = (value: string): boolean => REASONING_OPEN_TAG_PATTERN.test(value);

  const onAccumulatedText = (nextText: string, nowMs: number): ReasoningTransition => {
    const hadOpen = hasReasoningTags(previousText);
    const hasOpen = hasReasoningTags(nextText);
    const hadClose = REASONING_CLOSE_TAG_PATTERN.test(previousText);
    const hasClose = REASONING_CLOSE_TAG_PATTERN.test(nextText);

    const opened = hasOpen && !hadOpen;
    const closed = hasClose && !hadClose;

    if (opened && thinkingStartedAtMs === null) {
      thinkingStartedAtMs = nowMs;
    }
    if (closed && reasoningSeconds === null && thinkingStartedAtMs !== null) {
      reasoningSeconds = Math.max((nowMs - thinkingStartedAtMs) / 1000, 0);
    }

    previousText = nextText;

    return {
      opened,
      closed,
      thinkingStartedAtMs,
      reasoningSeconds,
    };
  };

  const selectFinalResponseSource = (streamedText: string, endResponseText: string): string => {
    const streamedTrimmed = streamedText.trim();
    const endTrimmed = endResponseText.trim();
    if (!streamedTrimmed) {
      return endResponseText || streamedText;
    }
    if (!endTrimmed) {
      return streamedText;
    }

    const streamedHasReasoning = hasReasoningTags(streamedText);
    const endPayloadHasReasoning = hasReasoningTags(endResponseText);
    const streamedHasUnclosedReasoning =
      streamedHasReasoning && !REASONING_CLOSE_TAG_PATTERN.test(streamedText);

    if (streamedHasUnclosedReasoning) {
      return endResponseText;
    }
    if (endPayloadHasReasoning && !streamedHasReasoning) {
      return endResponseText;
    }
    if (normalizeWhitespace(endResponseText) === normalizeWhitespace(streamedText)) {
      return endResponseText;
    }
    return streamedText;
  };

  const finalizeReasoningFromResponse = (responseSource: string, nowMs: number): number | null => {
    if (!hasReasoningTags(responseSource)) {
      return reasoningSeconds;
    }
    if (reasoningSeconds !== null) {
      return reasoningSeconds;
    }
    const baselineMs = thinkingStartedAtMs ?? streamStartedAtMs;
    reasoningSeconds = Math.max((nowMs - baselineMs) / 1000, 0);
    return reasoningSeconds;
  };

  return {
    onAccumulatedText,
    selectFinalResponseSource,
    finalizeReasoningFromResponse,
  };
};
