"use client";

import {
  Children,
  FormEvent,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  LoaderCircle,
  RefreshCw,
  Copy,
  CheckCircle2,
  Trash2,
  SignalHigh,
  CalendarClock,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  X,
  Check,
  Sparkles,
  Brain,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
// Type definition for code component
type CodeComponent = any;
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGrayLatex from "@/lib/remarkGrayLatex";
import styles from "@/app/gray/GrayPageClient.module.css";
import Image from "next/image";
import { GrayChatComposer } from "./ChatComposer";
import {
  useChatStore,
} from "./ChatProvider";
import {
  buildAssistantReply,
  shouldIncludeWorkspaceContext,
  shouldRequestAutoTitleForSession,
  normalizeAssistantContent,
  deriveTitleFromMessage,
  normalizeConversationIdValue,
  buildGeneralConversationId,
  stripGrayTitleMarkers,
  resolveClientTimezone,
} from "./chat/utils";
import {
  type ChatMessage as ChatSessionMessage,
  type ChatRole,
  type GrayReminderCreatedPayload,
  type GrayReminderEntityType,
} from "./chat/types";
import { GENERAL_CHAT_SESSION_ID } from "./chat/constants";
import {
  buildReminderConfirmationText,
  coerceReminderPayload,
  extractGrayRemindersFromText,
} from "./chat/reminderUtils";
import { formatReminderDisplayLabels } from "./reminderTimeUtils";
import AttachmentTray from "./AttachmentTray";

const LEGACY_REMINDER_SNIPPET_REGEX =
  /```[a-z0-9_-]*[\s\S]*?(gray[\s\S]{0,120}?(?:reminder|plan|habit))[\s\S]*?```/gi;

const MARKDOWN_PLUGINS: any = [
  // Rely on explicit math markers and convert them into KaTeX-friendly
  // dollar fences so currency like `$20` stays untouched.
  [remarkMath, { singleDollarTextMath: false }],
  remarkGfm,
  remarkGrayLatex,
];

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

  // Clean up any existing `\[...\]` markers by trimming inner whitespace
  // and rewriting them as double-dollar display blocks.
  updated = updated.replace(DISPLAY_LATEX_REGEX, (_match, content: string) => {
    const wrapped = wrapDisplayMathBlock(content);
    return wrapped;
  });

  // Normalize inline `\(...\)` markers into inline double-dollar fences.
  updated = updated.replace(INLINE_LATEX_REGEX, (_match, content: string) => {
    const inlineWrapped = wrapInlineMath(content);
    return inlineWrapped;
  });
  return updated;
};

const hasCodeBlockDescendant = (node: ReactNode): boolean => {
  if (!isValidElement(node)) {
    return false;
  }
  const props: any = node.props ?? {};
  if (props["data-code-block-root"]) {
    return true;
  }
  const children = props.children;
  if (!children) {
    return false;
  }
  return Children.toArray(children).some((child) => hasCodeBlockDescendant(child as ReactNode));
};

const normalizeLatexForDisplay = (value: string): string => {
  if (
    !value ||
    (value.indexOf("\\(") === -1 && value.indexOf("\\[") === -1 && value.indexOf("$") === -1)
  ) {
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
      segments.push({ type: "text", value: value.slice(nextFenceIndex, nextFenceIndex + fenceLength) });
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

const normalizeAssistantMath = (value: string | null | undefined): string | null => {
  if (typeof value !== "string" || !value) {
    return value ?? null;
  }
  return normalizeLatexForDisplay(value);
};

const GrayStreamingSpinner = ({
  toolLabel
}: {
  reasoningSeconds?: number | null;  // Keep prop for compatibility but don't display
  toolLabel?: string | null;
}) => (
  <div className={styles.chatStreamingInline}>
    <Image
      src="/grayaiwhite.svg"
      alt="Gray logo"
      width={18}
      height={18}
      className={styles.chatStreamingSpinner}
    />
    {toolLabel && (
      <span className={styles.chatToolStatus}>
        {toolLabel}
      </span>
    )}
  </div>
);
import { useUser } from "@/contexts/UserContext";
import { UsageLimitBanner } from "@/components/gray/UsageLimitBanner";
import { apiService, type ConversationUsage, type GroundingMetadata } from "@/lib/api";
import { buildLocalTimeContext } from "@/lib/timeContext";
import type { ContextUsageSummary } from "@/components/gray/types";
type GrayChatViewProps = {
  sessionId: string | null;
  introContent?: ReactNode;
  onContextUsageChange?: (summary: ContextUsageSummary | null) => void;
  hideThinkingIndicator?: boolean;
};

const deriveGroundingSourceHost = (site?: string | null, uri?: string | null) => {
  const normalizedSite = site?.trim();
  if (normalizedSite && !normalizedSite.toLowerCase().includes("vertexalsearch")) {
    return normalizedSite;
  }
  if (!uri) {
    return null;
  }
  try {
    const parsed = new URL(uri);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    const cleaned = uri.replace(/^https?:\/\//i, "").split("/")[0];
    return cleaned || null;
  }
};

const buildGroundingSourceInitials = (text?: string | null) => {
  if (!text) {
    return "↗";
  }
  const letters = text
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
  return letters || "↗";
};

type DerivedGroundingSource = {
  id: string;
  siteLabel?: string;
  title: string;
  href?: string;
  excerpt?: string;
  isReferenced: boolean;
  faviconHost?: string | null;
};

const normalizeFaviconCandidate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  let trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^[a-z]+:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.origin;
    } catch {
      return null;
    }
  }
  trimmed = trimmed.replace(/^[^a-z0-9]+/i, "");
  if (!trimmed) {
    return null;
  }
  trimmed = trimmed.split(/[/?#\s]/)[0];
  if (!trimmed) {
    return null;
  }
  if (!/^[a-z0-9.-]+$/i.test(trimmed)) {
    return null;
  }
  return `https://${trimmed.toLowerCase()}`;
};

const buildGroundingSourceFaviconUrl = (source: DerivedGroundingSource): string | undefined => {
  const candidates = [source.href, source.faviconHost, source.siteLabel];
  for (const candidate of candidates) {
    const normalized = normalizeFaviconCandidate(candidate);
    if (normalized) {
      try {
        const encoded = encodeURIComponent(normalized);
        return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encoded}&size=32`;
      } catch {
        continue;
      }
    }
  }
  return undefined;
};

const buildGroundingSourceCards = (metadata: GroundingMetadata | undefined | null): DerivedGroundingSource[] => {
  if (!metadata) {
    return [];
  }
  const chunks =
    metadata.grounding_chunks ??
    (metadata as { groundingChunks?: GroundingMetadata["grounding_chunks"] })?.groundingChunks ??
    [];
  if (!chunks?.length) {
    return [];
  }
  const referenced = new Set<number>();
  const rawSupports =
    metadata.grounding_supports ??
    (metadata as { groundingSupports?: GroundingMetadata["grounding_supports"] })?.groundingSupports ??
    [];
  for (const support of rawSupports ?? []) {
    for (const index of support.grounding_chunk_indices ?? []) {
      referenced.add(index);
    }
  }

  const sources: DerivedGroundingSource[] = [];
  chunks.forEach((chunk, index) => {
    const id = `chunk-${index}`;
    const isReferenced = referenced.has(index);
    if (chunk.web) {
      const derivedHost = deriveGroundingSourceHost(undefined, chunk.web.uri);
      const rawSite = chunk.web.site ?? chunk.web.domain;
      let siteLabel: string | undefined = (rawSite ?? derivedHost) ?? undefined;

      // Filter out internal Google/Vertex domains if they leak into the label
      if (
        !siteLabel ||
        siteLabel.toLowerCase().includes("vertexaisearch") ||
        siteLabel.toLowerCase() === "google search"
      ) {
        siteLabel = derivedHost ?? undefined;
      }
      // Final safety check: if still internal or empty, make it undefined to hide
      if (!siteLabel || siteLabel.toLowerCase().includes("vertexaisearch")) {
        siteLabel = undefined;
      }

      sources.push({
        id: `${id}-web`,
        siteLabel: siteLabel,
        title: chunk.web.title ?? siteLabel ?? "Referenced web content",
        href: chunk.web.uri ?? undefined,
        isReferenced,
        faviconHost: derivedHost,
      });
      return;
    }
    if (chunk.retrieved_context) {
      const retrieved = chunk.retrieved_context;
      const derivedHost = deriveGroundingSourceHost(undefined, retrieved.uri);
      const host = retrieved.document_name ?? derivedHost;
      let siteLabel: string | undefined = host ?? undefined;

      if (
        !siteLabel ||
        siteLabel.toLowerCase().includes("vertexaisearch") ||
        siteLabel.toLowerCase() === "google search"
      ) {
        siteLabel = derivedHost ?? undefined;
      }
      if (!siteLabel || siteLabel.toLowerCase().includes("vertexaisearch")) {
        siteLabel = undefined;
      }

      sources.push({
        id: `${id}-retrieved`,
        siteLabel: siteLabel,
        title: retrieved.title || retrieved.text?.slice(0, 80) || (siteLabel ?? "Referenced context"),
        href: retrieved.uri ?? undefined,
        excerpt: retrieved.text,
        isReferenced,
        faviconHost: derivedHost,
      });
    }
  });

  return sources.sort((a, b) => Number(b.isReferenced) - Number(a.isReferenced));
};

type CodeTokenType = "Plain" | "Keyword" | "String" | "Comment" | "Number" | "Builtin" | "Literal";

type CodeToken = {
  type: CodeTokenType;
  content: string;
};

type CodeLine = CodeToken[];

type BlockPattern = { start: string; end: string };

type LanguageRule = {
  keywords: Set<string>;
  builtins: Set<string>;
  literals: Set<string>;
  commentSymbols: string[];
  blockComments?: BlockPattern[];
  tripleQuotes?: string[];
  stringDelimiters: string[];
  templateStrings?: boolean;
};

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  bash: "shell",
  sh: "shell",
  shell: "shell",
  json5: "json",
  yml: "yaml",
  md: "markdown",
};

const LANGUAGE_RULES: Record<string, LanguageRule> = {
  javascript: {
    keywords: new Set([
      "import",
      "from",
      "export",
      "const",
      "let",
      "var",
      "return",
      "if",
      "else",
      "for",
      "while",
      "switch",
      "case",
      "break",
      "continue",
      "function",
      "class",
      "extends",
      "new",
      "try",
      "catch",
      "finally",
      "await",
      "async",
      "throw",
      "yield",
      "in",
      "of",
      "instanceof",
      "typeof",
      "void",
    ]),
    builtins: new Set([
      "console",
      "Math",
      "Date",
      "Promise",
      "Array",
      "String",
      "Number",
      "Boolean",
      "Object",
      "Set",
      "Map",
      "JSON",
    ]),
    literals: new Set(["true", "false", "null", "undefined", "NaN"]),
    commentSymbols: ["//"],
    blockComments: [{ start: "/*", end: "*/" }],
    stringDelimiters: ['"', "'", "`"],
    templateStrings: true,
  },
  typescript: {
    keywords: new Set([
      "import",
      "from",
      "export",
      "const",
      "let",
      "var",
      "return",
      "if",
      "else",
      "for",
      "while",
      "switch",
      "case",
      "break",
      "continue",
      "function",
      "class",
      "extends",
      "implements",
      "new",
      "try",
      "catch",
      "finally",
      "await",
      "async",
      "throw",
      "yield",
      "in",
      "of",
      "interface",
      "type",
      "enum",
      "namespace",
      "as",
      "keyof",
      "readonly",
      "public",
      "private",
      "protected",
      "abstract",
    ]),
    builtins: new Set(["string", "number", "boolean", "any", "unknown", "never", "void", "Record", "Partial", "Pick"]),
    literals: new Set(["true", "false", "null", "undefined"]),
    commentSymbols: ["//"],
    blockComments: [{ start: "/*", end: "*/" }],
    stringDelimiters: ['"', "'", "`"],
    templateStrings: true,
  },
  python: {
    keywords: new Set([
      "def",
      "class",
      "return",
      "if",
      "elif",
      "else",
      "for",
      "while",
      "try",
      "except",
      "finally",
      "import",
      "from",
      "as",
      "pass",
      "break",
      "continue",
      "with",
      "lambda",
      "yield",
      "global",
      "nonlocal",
      "assert",
      "async",
      "await",
      "raise",
    ]),
    builtins: new Set([
      "print",
      "len",
      "range",
      "dict",
      "list",
      "set",
      "int",
      "float",
      "str",
      "bool",
      "enumerate",
      "zip",
      "sum",
      "min",
      "max",
      "self",
    ]),
    literals: new Set(["True", "False", "None"]),
    commentSymbols: ["#"],
    stringDelimiters: ['"', "'", '"""', "'''"],
    tripleQuotes: ['"""', "'''"],
  },
  shell: {
    keywords: new Set(["if", "then", "elif", "else", "fi", "for", "while", "in", "do", "done", "case", "esac", "function"]),
    builtins: new Set(["echo", "cd", "export", "local", "readonly", "eval", "printf", "test"]),
    literals: new Set(["true", "false"]),
    commentSymbols: ["#"],
    stringDelimiters: ['"', "'", "`"],
  },
  json: {
    keywords: new Set(),
    builtins: new Set(),
    literals: new Set(["true", "false", "null"]),
    commentSymbols: [],
    stringDelimiters: ['"'],
  },
  yaml: {
    keywords: new Set(["true", "false", "null"]),
    builtins: new Set(),
    literals: new Set(["true", "false", "null"]),
    commentSymbols: ["#"],
    stringDelimiters: ['"', "'"],
  },
  markdown: {
    keywords: new Set(),
    builtins: new Set(),
    literals: new Set(),
    commentSymbols: [],
    stringDelimiters: ['"', "'"],
  },
};

const DEFAULT_LANGUAGE = "javascript";

const getLanguageId = (value?: string | null): string => {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }
  const normalized = value.toLowerCase();
  if (LANGUAGE_RULES[normalized]) {
    return normalized;
  }
  return LANGUAGE_ALIASES[normalized] ?? DEFAULT_LANGUAGE;
};

const getLanguageRule = (language: string): LanguageRule => {
  return LANGUAGE_RULES[language] ?? LANGUAGE_RULES[DEFAULT_LANGUAGE];
};

const isIdentifierStart = (char: string) => /[A-Za-z_]/.test(char);
const isIdentifierPart = (char: string) => /[A-Za-z0-9_]/.test(char);
const isDigit = (char: string) => /[0-9]/.test(char);

const pushToken = (line: CodeLine, type: CodeTokenType, content: string) => {
  if (!content) {
    return;
  }
  const last = line[line.length - 1];
  if (last && last.type === type) {
    last.content += content;
    return;
  }
  line.push({ type, content });
};

const readString = (text: string, startIndex: number, delimiter: string) => {
  const parts: string[] = [];
  let i = startIndex;
  const delimiterLength = delimiter.length;
  const advance = (step = 1) => {
    parts.push(text.slice(i, i + step));
    i += step;
  };

  advance(delimiterLength);

  while (i < text.length) {
    if (text[i] === "\\" && i + 1 < text.length) {
      advance(2);
      continue;
    }
    if (text.startsWith(delimiter, i)) {
      advance(delimiterLength);
      break;
    }
    advance(1);
  }

  return { value: parts.join(""), end: i };
};

const TAB_SIZE = 4;

const expandTabs = (line: string): string => {
  let result = "";
  let column = 0;
  for (const char of line) {
    if (char === "\t") {
      const remainder = column % TAB_SIZE;
      const spacesToAdd = remainder === 0 ? TAB_SIZE : TAB_SIZE - remainder;
      result += " ".repeat(spacesToAdd);
      column += spacesToAdd;
    } else {
      result += char;
      column += 1;
    }
  }
  return result;
};

const stripUniformIndent = (code: string): string => {
  // Normalize newlines
  const normalized = code.replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");

  // Expand tabs so the visual indent is stable
  const lines = rawLines.map(expandTabs);

  // If everything is blank, return empty
  if (lines.every((line) => !line.trim())) {
    return "";
  }

  // Compute minimal leading-space indent across all non-empty lines
  let minIndent = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^ +/);
    const indent = match ? match[0].length : 0;
    if (indent < minIndent) {
      minIndent = indent;
      if (minIndent === 0) break;
    }
  }

  if (!Number.isFinite(minIndent) || minIndent <= 0) {
    // No uniform indent to strip; return original (with normalized newlines/tabs expanded)
    return lines.join("\n");
  }

  // Strip that uniform indent while preserving relative indentation and blank lines
  const result = lines.map((line) => {
    if (!line.trim()) {
      return "";
    }
    // Only slice if the line actually has at least minIndent leading spaces
    if (line.startsWith(" ".repeat(minIndent))) {
      return line.slice(minIndent);
    }
    return line;
  });

  return result.join("\n");
};

const tokenizeCode = (code: string, language: string): CodeLine[] => {
  const rule = getLanguageRule(language);
  const lines = code.split(/\r?\n/).map(expandTabs);
  const tokenLines: CodeLine[] = [];
  let activeBlock: BlockPattern | null = null;
  let activeBlockType: CodeTokenType = "Comment";
  let activeMultilineString: string | null = null;

  for (const line of lines) {
    const tokens: CodeLine = [];
    let i = 0;
    while (i < line.length) {
      const rest = line.slice(i);

      if (activeMultilineString) {
        const closingIndex = rest.indexOf(activeMultilineString);
        if (closingIndex === -1) {
          pushToken(tokens, "String", rest);
          i = line.length;
          continue;
        }
        const chunk = rest.slice(0, closingIndex + activeMultilineString.length);
        pushToken(tokens, "String", chunk);
        i += closingIndex + activeMultilineString.length;
        activeMultilineString = null;
        continue;
      }

      if (activeBlock) {
        const closingIndex = rest.indexOf(activeBlock.end);
        if (closingIndex === -1) {
          pushToken(tokens, activeBlockType, rest);
          i = line.length;
          continue;
        }
        const chunk = rest.slice(0, closingIndex + activeBlock.end.length);
        pushToken(tokens, activeBlockType, chunk);
        i += closingIndex + activeBlock.end.length;
        activeBlock = null;
        continue;
      }

      if (rule.tripleQuotes) {
        const triple = rule.tripleQuotes.find((quote) => rest.startsWith(quote));
        if (triple) {
          activeMultilineString = triple;
          pushToken(tokens, "String", triple);
          i += triple.length;
          continue;
        }
      }

      if (rule.blockComments) {
        const block = rule.blockComments.find((pattern) => rest.startsWith(pattern.start));
        if (block) {
          const closingIndex = rest.indexOf(block.end);
          if (closingIndex === -1) {
            pushToken(tokens, "Comment", rest);
            i = line.length;
            activeBlock = block;
            activeBlockType = "Comment";
            continue;
          }
          const chunk = rest.slice(0, closingIndex + block.end.length);
          pushToken(tokens, "Comment", chunk);
          i += closingIndex + block.end.length;
          continue;
        }
      }

      const commentSymbol = rule.commentSymbols.find((symbol) => rest.startsWith(symbol));
      if (commentSymbol) {
        pushToken(tokens, "Comment", rest);
        break;
      }

      const stringDelimiter = rule.stringDelimiters.find((delimiter) => rest.startsWith(delimiter));
      if (stringDelimiter) {
        if (rule.tripleQuotes?.includes(stringDelimiter) && rest.length === stringDelimiter.length) {
          pushToken(tokens, "String", stringDelimiter);
          i += stringDelimiter.length;
          activeMultilineString = stringDelimiter;
          continue;
        }

        const { value, end } = readString(line, i, stringDelimiter);
        pushToken(tokens, "String", value);
        i = end;
        continue;
      }

      if (rule.templateStrings && rest.startsWith("`")) {
        const { value, end } = readString(line, i, "`");
        pushToken(tokens, "String", value);
        i = end;
        continue;
      }

      if (isDigit(rest[0])) {
        let j = 1;
        while (j < rest.length && /[0-9xXa-fA-F._]/.test(rest[j])) {
          j += 1;
        }
        pushToken(tokens, "Number", rest.slice(0, j));
        i += j;
        continue;
      }

      if (isIdentifierStart(rest[0])) {
        let j = 1;
        while (j < rest.length && isIdentifierPart(rest[j])) {
          j += 1;
        }
        const word = rest.slice(0, j);
        if (rule.keywords.has(word)) {
          pushToken(tokens, "Keyword", word);
        } else if (rule.builtins.has(word)) {
          pushToken(tokens, "Builtin", word);
        } else if (rule.literals.has(word)) {
          pushToken(tokens, "Literal", word);
        } else {
          pushToken(tokens, "Plain", word);
        }
        i += j;
        continue;
      }

      pushToken(tokens, "Plain", rest[0]);
      i += 1;
    }

    tokenLines.push(tokens.length > 0 ? tokens : [{ type: "Plain", content: "" }]);
  }

  return tokenLines;
};

const SINGLE_TOKEN_CODE_PATTERN = /^[\w.$-]+$/;
const CODE_LIKE_PATTERN =
  /[{}()[\];<>]|=>|:=|const\s+|let\s+|var\s+|function\s+|class\s+|return\s+|if\s+|else\s+|for\s+|while\s+|async\s+|await\s+|def\s+|import\s+|from\s+|try\s+|catch\s+|#include|<\?php/;
const LATEX_MATH_BLOCK_PATTERN = /^\s*(\$\$[\s\S]*\$\$|\\\[[\s\S]*\\\])\s*$/;

const MarkdownCodeBlock: CodeComponent = ({ inline, className, children, ...props }: any) => {
  const isInline = Boolean(inline);
  const [copied, setCopied] = useState(false);
  const raw = typeof children === "string" ? children : String(children ?? "");
  const language = getLanguageId(className?.replace("language-", "") ?? undefined);
  const { normalizedRaw, trimmedRaw, codeLines } = useMemo(() => {
    const normalized = stripUniformIndent(raw);

    return {
      normalizedRaw: normalized.trim(),
      trimmedRaw: normalized.trim(),
      codeLines: tokenizeCode(normalized.trim(), language),
    };
  }, [raw, language]);

  if (!isInline && !trimmedRaw) {
    return null;
  }

  const isLikelyLatexMathBlock = !isInline && LATEX_MATH_BLOCK_PATTERN.test(trimmedRaw);

  if (isLikelyLatexMathBlock) {
    const normalizedMath = normalizeAssistantMath(trimmedRaw) ?? trimmedRaw;
    // Render LaTeX math blocks as regular markdown so remark-math / rehype-katex
    // can display them instead of treating them as plain code.
    return (
      <div className={styles.chatMarkdown}>
        <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
          {normalizedMath}
        </ReactMarkdown>
      </div>
    );
  }

  if (isInline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  const isSingleTokenBlock =
    trimmedRaw.length > 0 &&
    !trimmedRaw.includes("\n") &&
    !/\s/.test(trimmedRaw) &&
    SINGLE_TOKEN_CODE_PATTERN.test(trimmedRaw);

  if (isSingleTokenBlock) {
    return (
      <code className={`${styles.inlineCodeToken} ${className ?? ""}`} {...props}>
        {trimmedRaw}
      </code>
    );
  }

  const totalLength = trimmedRaw.length;
  const isCompactBlock = codeLines.length === 1 && totalLength <= 18;
  const isMiniBlock = totalLength <= 20;

  // Heuristic: if this "code block" doesn't actually look like code and is short,
  // render it as plain text instead of a framed code block. This avoids noisy
  // code styling for things like `[COMMITMENT]` or simple labels.
  const looksLikeRealCode = CODE_LIKE_PATTERN.test(trimmedRaw);
  if (!looksLikeRealCode) {
    const lines = trimmedRaw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
    if (lines.length > 0 && lines.length <= 3 && maxLineLength <= 80) {
      return (
        <span className={styles.chatPlainCodeFallback} {...props}>
          {trimmedRaw}
        </span>
      );
    }
  }

  const handleCopy = () => {
    if (!trimmedRaw) {
      return;
    }
    if (typeof navigator === "undefined" || typeof navigator.clipboard === "undefined") {
      return;
    }
    navigator.clipboard
      .writeText(normalizedRaw)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        setCopied(false);
      });
  };

  return (
    <div
      data-code-block-root="true"
      className={`${styles.codeBlock} ${isCompactBlock ? styles.codeBlockCompact : ""}`}
      data-language={language}
    >
      <div className={`${styles.codeHeader} ${isCompactBlock ? styles.codeHeaderCompact : ""}`}>
        <span className={styles.codeLanguage}>{language}</span>
        <button
          className={styles.codeCopyButton}
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          data-copied={copied ? "true" : undefined}
        >
          {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <div
        className={`${styles.codeSurface} ${isMiniBlock ? styles.codeSurfaceMini : isCompactBlock ? styles.codeSurfaceCompact : ""
          }`}
      >
        {codeLines.map((line, lineIndex) => (
          <div
            className={`${styles.codeLine} ${isMiniBlock ? styles.codeLineMini : isCompactBlock ? styles.codeLineCompact : ""
              }`}
            key={`code-line-${lineIndex}`}
          >
            {!isCompactBlock && <span className={styles.codeLineNumber}>{lineIndex + 1}</span>}
            <span
              className={`${styles.codeLineContent} ${isMiniBlock ? styles.codeLineContentMini : ""
                }`}
            >
              {line.map((token, tokenIndex) => {
                const classKey = `codeToken${token.type}` as keyof typeof styles;
                return (
                  <span
                    key={`code-token-${lineIndex}-${tokenIndex}`}
                    className={`${styles.codeToken} ${styles[classKey] ?? ""}`}
                  >
                    {token.content}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const REMINDER_STATUS_LABELS: Record<string, string> = {
  pending: "Scheduled",
  delivered: "Sent",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
  created: "Scheduled",
};

const resolveReminderMode = (
  deliveryMode?: string | null,
  entity?: GrayReminderEntityType
): "plan" | "habit" | "reminder" => {
  const normalized = (deliveryMode ?? entity ?? "").toString().trim().toLowerCase();
  if (normalized.startsWith("plan")) {
    return "plan";
  }
  if (normalized.startsWith("habit")) {
    return "habit";
  }
  return "reminder";
};

const resolveReminderStatusLabel = (status?: string | null) => {
  if (!status) {
    return REMINDER_STATUS_LABELS.pending;
  }
  const normalized = status.trim().toLowerCase();
  return REMINDER_STATUS_LABELS[normalized as keyof typeof REMINDER_STATUS_LABELS] ?? status;
};

const ReminderCard = ({ reminder }: { reminder: GrayReminderCreatedPayload }) => {
  const data = reminder.data;
  const reminderRecord = (data.reminder as Record<string, unknown> | null | undefined) ?? null;
  const rawRecord = (data.raw as Record<string, unknown> | null | undefined) ?? null;
  const reminderTime =
    reminderRecord && typeof reminderRecord["remind_at"] === "string"
      ? (reminderRecord["remind_at"] as string)
      : null;
  const scheduleIso = reminderTime ?? data.time_iso ?? null;
  const summaryCandidate =
    data.summary ??
    (rawRecord && typeof rawRecord["description"] === "string"
      ? (rawRecord["description"] as string)
      : undefined);
  const statusLabel = resolveReminderStatusLabel(data.reminder_status);
  const mode = resolveReminderMode(data.delivery_mode, reminder.entity);
  const typeLabels: Record<"plan" | "habit" | "reminder", string> = {
    plan: "Plan",
    habit: "Habit",
    reminder: "Reminder",
  };
  const { primary: scheduleLabel } = formatReminderDisplayLabels(scheduleIso);

  return (
    <article className={styles.reminderCard} data-mode={mode}>
      <header className={styles.reminderCardHeader}>
        <div>
          <h4>{data.label || "Untitled reminder"}</h4>
          <h2 className={styles.reminderCardType}>{typeLabels[mode]}</h2>
          {summaryCandidate ? <p className={styles.reminderCardSummary}>{summaryCandidate}</p> : null}
        </div>
        <span className={styles.reminderCardStatus} data-status={data.reminder_status ?? "pending"}>
          {statusLabel}
        </span>
      </header>
      {scheduleLabel && (
        <div className={styles.reminderCardTimeRow}>
          <div className={styles.reminderCardTimeIcon}>
            <CalendarClock size={16} />
          </div>
          <div>
            <strong>{scheduleLabel}</strong>
          </div>
        </div>
      )}
    </article>
  );
};

type ChatMessagesListProps = {
  messages: ChatSessionMessage[];
  activeStreamingMessageId: string | null;
  latestAssistantMessageId: string | null;
  regeneratingMessageId: string | null;
  copiedMessageId: string | null;
  markdownComponents: Components;
  getResponseDurationLabel: (messageIndex: number) => string | null;
  handleCopyMessage: (messageId: string, text: string) => void;
  handleRegenerate: (messageId: string) => void;
  handleRetryUserMessage: (messageId: string) => void;
  handleDeleteMessage: (messageId: string) => void;
  handleCycleAssistantVariant: (messageId: string, direction: "prev" | "next") => void;
  handleEditMessage: (messageId: string, newContent: string) => void;
  shouldShowPendingStreamIndicator: boolean;
  showFirstMessageSpinner: boolean;
  scrollAnchorRef: RefObject<HTMLDivElement | null>;
  reasoningSeconds?: number | null;
  isResponding?: boolean;
  isActivelyThinking?: boolean;
  thinkingStartTime?: number | null;
};

const ThinkingBlock = ({
  content,
  markdownComponents,
  reasoningSeconds,
  isActivelyThinking,
  thinkingStartTime,
}: {
  content: string;
  markdownComponents: Components;
  reasoningSeconds?: number | null;
  isActivelyThinking?: boolean;
  thinkingStartTime?: number | null;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Live timer effect - updates every 100ms while actively thinking
  useEffect(() => {
    if (!isActivelyThinking || !thinkingStartTime) {
      return;
    }

    // Update immediately
    setLiveSeconds((Date.now() - thinkingStartTime) / 1000);

    const interval = setInterval(() => {
      setLiveSeconds((Date.now() - thinkingStartTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [isActivelyThinking, thinkingStartTime]);

  // Format time display: "3.2 seconds" or "1:23.4" for longer durations
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)} second${seconds >= 2 || seconds < 1 ? "s" : ""}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  };

  const timeLabel = useMemo(() => {
    // If actively thinking, show live timer
    if (isActivelyThinking && thinkingStartTime) {
      return `Thinking for ${formatTime(liveSeconds)}`;
    }
    // If we have a final duration, show it
    if (typeof reasoningSeconds === "number" && reasoningSeconds > 0) {
      return `Thought for ${formatTime(reasoningSeconds)}`;
    }
    return null;
  }, [isActivelyThinking, thinkingStartTime, liveSeconds, reasoningSeconds]);

  return (
    <div className={styles.chatThinkingBlock} data-expanded={isExpanded ? "true" : "false"}>
      <button
        type="button"
        className={styles.chatThinkingHeader}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse reasoning" : "Expand reasoning"}
      >
        <Brain size={14} className={styles.chatThinkingIcon} />
        <span className={styles.chatThinkingLabel}>
          {timeLabel || "Thinking"}
        </span>
        <ChevronDown
          size={14}
          className={`${styles.chatThinkingChevron} ${isExpanded ? styles.chatThinkingChevronExpanded : ""}`}
        />
      </button>
      <div
        className={`${styles.chatThinkingBody} ${isExpanded ? styles.chatThinkingBodyExpanded : ""}`}
        aria-hidden={!isExpanded}
      >
        <div className={styles.chatThinkingContent}>
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={MARKDOWN_PLUGINS}
            rehypePlugins={[[rehypeKatex, { strict: false }]]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

const ChatMessagesList = memo(
  ({
    messages,
    activeStreamingMessageId,
    latestAssistantMessageId,
    regeneratingMessageId,
    copiedMessageId,
    markdownComponents,
    getResponseDurationLabel,
    handleCopyMessage,
    handleRegenerate,
    handleRetryUserMessage,
    handleDeleteMessage,
    handleCycleAssistantVariant,
    handleEditMessage,
    shouldShowPendingStreamIndicator,
    showFirstMessageSpinner,
    scrollAnchorRef,
    reasoningSeconds,
    isResponding,
    isActivelyThinking,
    thinkingStartTime,
  }: ChatMessagesListProps) => {
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    // Track which message has its action bar expanded (tap to reveal)
    const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

    const startEditing = useCallback((messageId: string, currentContent: string) => {
      setEditingMessageId(messageId);
      setEditContent(currentContent);
    }, []);

    const cancelEditing = useCallback(() => {
      setEditingMessageId(null);
      setEditContent("");
    }, []);

    const saveEditing = useCallback((messageId: string) => {
      if (editContent.trim()) {
        handleEditMessage(messageId, editContent);
      }
      setEditingMessageId(null);
      setEditContent("");
    }, [editContent, handleEditMessage]);

    // Toggle message action bar visibility on tap/click
    const toggleMessageActions = useCallback((messageId: string) => {
      setExpandedMessageId((prev) => prev === messageId ? null : messageId);
    }, []);

    return (
      <div
        className={styles.chatMessages}
        data-streaming={shouldShowPendingStreamIndicator ? "true" : undefined}
      >
        <div ref={scrollAnchorRef} style={{ order: -1 }} />

        {shouldShowPendingStreamIndicator && (
          <div className={styles.chatMessage} data-role="assistant" style={{ order: -1 }}>
            <div className={styles.chatAssistantBlock}>
              <GrayStreamingSpinner
                reasoningSeconds={reasoningSeconds}
                toolLabel={
                  // Check the very last message in the list if it's an assistant message
                  messages.length > 0 && messages[messages.length - 1].role === "assistant"
                    ? extractCurrentToolStatus(messages[messages.length - 1].content)
                    : null
                }
              />
            </div>
          </div>
        )}

        {[...messages].reverse().map((message, reverseIndex) => {
          const messageIndex = messages.length - 1 - reverseIndex;
          const isUser = message.role === "user";
          const isAssistant = !isUser;
          const quickReplies: string[] = [];
          const rawContent = message.content ?? "";
          const assistantSections = isAssistant ? parseStructuredAssistantMessage(rawContent) : null;
          const thinkingText = isAssistant ? assistantSections?.thinking ?? null : null;
          const aiText = isAssistant ? assistantSections?.ai ?? rawContent : rawContent;
          const assistantTextCandidate = isAssistant ? aiText : rawContent;
          const sanitizedAssistantTextCandidate = stripGrayTitleMarkers(assistantTextCandidate);
          const assistantTextAfterRemovals = isAssistant
            ? sanitizedAssistantTextCandidate.replace(LEGACY_REMINDER_SNIPPET_REGEX, "").trim()
            : sanitizedAssistantTextCandidate;
          const visibleAssistantText = isAssistant
            ? normalizeAssistantMath(assistantTextAfterRemovals) ?? ""
            : assistantTextAfterRemovals;
          const normalizedThinkingText = isAssistant ? normalizeAssistantMath(thinkingText) : thinkingText;
          const fullText = isAssistant ? visibleAssistantText : rawContent;
          const hasThinkingContent =
            typeof normalizedThinkingText === "string" && normalizedThinkingText.trim().length > 0;
          const isStreamingMessage = isAssistant && message.id === activeStreamingMessageId;
          const hasTextContent = Boolean(visibleAssistantText.trim());
          const assistantReminders = isAssistant && Array.isArray(message.reminders) ? message.reminders : [];
          const sourceCards = isAssistant && message.groundingMetadata
            ? buildGroundingSourceCards(message.groundingMetadata)
            : [];
          const showAssistantMarkdown = isAssistant && hasTextContent;
          const hasVisibleContent =
            hasThinkingContent || showAssistantMarkdown || assistantReminders.length > 0;
          const isStreamingAssistantMessage = isAssistant && isStreamingMessage;
          const isAwaitingStreamContent = isStreamingAssistantMessage && !hasVisibleContent;
          const showStreamingIndicator = isStreamingAssistantMessage;
          const shouldHideEmptyAssistantMessage = isAssistant && !hasVisibleContent && !isAwaitingStreamContent;
          const messageTimestampIso =
            typeof message.createdAt === "number" && Number.isFinite(message.createdAt)
              ? new Date(message.createdAt).toISOString()
              : undefined;
          const timestampLabel = formatMessageTimestamp(message.createdAt);

          if (shouldHideEmptyAssistantMessage) {
            return null;
          }

          if (isUser && !rawContent.trim()) {
            return null;
          }

          const responseDurationLabel = isAssistant ? getResponseDurationLabel(messageIndex) : null;
          const tokenCount = isAssistant ? estimateTokenCount(rawContent) : null;
          const hasTokenEstimate = typeof tokenCount === "number" && Number.isFinite(tokenCount) && tokenCount > 0;
          const metadataTokenLabel = hasTokenEstimate ? `${tokenCount.toLocaleString()} tokens` : "—";
          const metadataRows: { label: string; value: string }[] = [];
          metadataRows.push({ label: "Tokens", value: metadataTokenLabel });
          if (responseDurationLabel) {
            metadataRows.push({ label: "Duration", value: responseDurationLabel });
          }
          const backendTimingLabel = formatBackendTimingLabel(message.backendTimings);
          if (backendTimingLabel) {
            metadataRows.push({ label: "Backend", value: backendTimingLabel });
          }
          const isMetadataAvailable = isAssistant && metadataRows.length > 0;
          const isLatestAssistantMessage = isAssistant && message.id === latestAssistantMessageId;
          const isRegenerating = regeneratingMessageId === message.id;
          const messageBodyClassName = isUser
            ? `${styles.chatBubble} ${styles.chatBubbleUser}`
            : styles.chatAssistantBlock;

          return (
            <div
              key={message.id}
              className={styles.chatMessage}
              data-role={isUser ? "user" : "assistant"}
              data-streaming={isStreamingMessage ? "true" : undefined}
              data-actions-expanded={expandedMessageId === message.id ? "true" : undefined}
              onClick={() => {
                // Only toggle if not editing
                if (!editingMessageId) {
                  toggleMessageActions(message.id);
                }
              }}
            >
              <div className={messageBodyClassName}>
                {editingMessageId === message.id ? (
                  <div className={styles.chatEditContainer}>
                    <textarea
                      className={styles.chatEditInput}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                    />
                    <div className={styles.chatEditActions}>
                      <button
                        onClick={() => saveEditing(message.id)}
                        className={styles.chatEditSaveButton}
                      >
                        <Check size={14} /> Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        className={styles.chatEditCancelButton}
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className={styles.chatMessageAttachments}>
                        {message.attachments.map((attachment, index) => (
                          <div key={attachment.id || index} className={styles.chatMessageAttachment}>
                            {attachment.mime_type?.startsWith("image/") ? (
                              <img
                                src={attachment.previewUrl || attachment.public_url}
                                alt="Attachment"
                              />
                            ) : (
                              <div className={styles.chatMessageAttachmentFile}>
                                <span>{attachment.filename}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {assistantReminders.length > 0 ? (
                      <div className={styles.reminderCardList}>
                        {assistantReminders.map((reminder, reminderIndex) => (
                          <ReminderCard
                            key={`${message.id}-reminder-${reminderIndex}-${reminder.data.reminder_id ?? reminder.data.id}`}
                            reminder={reminder}
                          />
                        ))}
                      </div>
                    ) : null}
                    {isAssistant && hasThinkingContent && (
                      <ThinkingBlock
                        content={normalizedThinkingText ?? ""}
                        markdownComponents={markdownComponents}
                        reasoningSeconds={message.reasoningSeconds}
                        isActivelyThinking={isStreamingMessage && isActivelyThinking}
                        thinkingStartTime={isStreamingMessage ? thinkingStartTime : null}
                      />
                    )}
                    {hasTextContent && (
                      <div className={styles.chatMarkdown}>
                        <ReactMarkdown
                          components={markdownComponents}
                          remarkPlugins={MARKDOWN_PLUGINS}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {visibleAssistantText}
                        </ReactMarkdown>
                      </div>
                    )}
                    {isAssistant && message.groundingMetadata ? (
                      (() => {
                        const metadata = message.groundingMetadata;
                        const searchQueries =
                          metadata?.web_search_queries ??
                          (metadata as { webSearchQueries?: string[] })?.webSearchQueries ??
                          [];
                        const searchEntryPoint =
                          metadata?.search_entry_point ??
                          (metadata as { searchEntryPoint?: { rendered_content?: string; renderedContent?: string } })
                            ?.searchEntryPoint ??
                          null;
                        const renderedSearchEntry =
                          typeof searchEntryPoint?.rendered_content === "string"
                            ? searchEntryPoint?.rendered_content
                            : typeof (searchEntryPoint as any)?.renderedContent === "string"
                              ? (searchEntryPoint as any).renderedContent
                              : null;
                        const chunks =
                          metadata?.grounding_chunks ??
                          (metadata as { groundingChunks?: GroundingMetadata["grounding_chunks"] })?.groundingChunks ??
                          [];
                        const mapSources = chunks
                          .map((chunk) => chunk?.maps)
                          .filter((maps): maps is NonNullable<(typeof chunks)[number]["maps"]> => Boolean(maps));
                        const hasWidget = Boolean(
                          metadata?.google_maps_widget_context_token ??
                          (metadata as { googleMapsWidgetContextToken?: string })?.googleMapsWidgetContextToken
                        );
                        const previousUserMessage = (() => {
                          for (let index = messageIndex - 1; index >= 0; index -= 1) {
                            const prior = messages[index];
                            if (prior && prior.role === "user" && typeof prior.content === "string") {
                              return prior.content.trim().toLowerCase();
                            }
                          }
                          return null;
                        })();
                        const filteredQueries =
                          searchQueries.filter((query) => {
                            const trimmed = query.trim();
                            if (!trimmed) {
                              return false;
                            }
                            if (previousUserMessage && trimmed.toLowerCase() === previousUserMessage) {
                              return false;
                            }
                            return true;
                          }) ?? [];
                        if (
                          sourceCards.length === 0 &&
                          mapSources.length === 0 &&
                          filteredQueries.length === 0 &&
                          !hasWidget &&
                          !renderedSearchEntry
                        ) {
                          return null;
                        }
                        return (
                          <div className={styles.chatGroundingPanel}>
                            {filteredQueries.length > 0 ? (
                              <div className={styles.chatGroundingQueries}>
                                {filteredQueries.map((query) => (
                                  <span key={query} className={styles.chatGroundingQueryChip}>
                                    {query}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {sourceCards.length > 0 ? (
                              <div className={styles.chatGroundingSourceDeck}>
                                <div className={styles.chatGroundingSourceCards}>
                                  {sourceCards.map((source) => {
                                    const initials = buildGroundingSourceInitials(source.siteLabel ?? source.title);
                                    const faviconUrl = buildGroundingSourceFaviconUrl(source);

                                    const cardContent = (
                                      <>
                                        <div className={styles.chatGroundingSourceCardAvatar}>
                                          {faviconUrl ? (
                                            <div style={{ position: "relative", width: "16px", height: "16px" }}>
                                              {/* Show initials by default as fallback */}
                                              <span
                                                style={{
                                                  position: "absolute",
                                                  top: 0,
                                                  left: 0,
                                                  width: "16px",
                                                  height: "16px",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  fontSize: "10px",
                                                }}
                                              >
                                                {initials}
                                              </span>
                                              {/* Favicon overlays on top when it loads */}
                                              <img
                                                src={faviconUrl}
                                                alt=""
                                                referrerPolicy="no-referrer"
                                                style={{
                                                  position: "absolute",
                                                  top: 0,
                                                  left: 0,
                                                  width: "16px",
                                                  height: "16px",
                                                  objectFit: "contain",
                                                  backgroundColor: "white",
                                                  borderRadius: "2px",
                                                }}
                                                onError={(e) => {
                                                  // Hide the image if it fails to load,
                                                  // letting the initials show through
                                                  e.currentTarget.style.display = "none";
                                                }}
                                              />
                                            </div>
                                          ) : (
                                            initials
                                          )}
                                        </div>
                                        <div className={styles.chatGroundingSourceCardContent}>
                                          <div className={styles.chatGroundingSourceCardTitle}>
                                            {source.title ?? "Referenced source"}
                                          </div>
                                          {source.siteLabel ? (
                                            <div className={styles.chatGroundingSourceCardSite}>
                                              {source.siteLabel}
                                            </div>
                                          ) : null}
                                        </div>
                                      </>
                                    );
                                    if (source.href) {
                                      return (
                                        <a
                                          key={source.id}
                                          href={source.href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={styles.chatGroundingSourceCard}
                                        >
                                          {cardContent}
                                        </a>
                                      );
                                    }
                                    return (
                                      <div
                                        key={source.id}
                                        className={styles.chatGroundingSourceCard}
                                        data-clickable="false"
                                      >
                                        {cardContent}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {mapSources.length > 0 ? (
                              <div className={styles.chatGroundingSources}>
                                {mapSources.map((maps, index) => {
                                  const label = maps.title ?? maps.placeId ?? "Maps source";
                                  const href = maps.uri ?? maps.googleMapsUri ?? undefined;
                                  return (
                                    <div key={`${message.id}-maps-source-${index}`} className={styles.chatGroundingSource}>
                                      {href ? (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={styles.chatGroundingLink}
                                        >
                                          <span translate="no">Google Maps</span> · {label}
                                        </a>
                                      ) : (
                                        <span className={styles.chatGroundingPlain}>
                                          <span translate="no">Google Maps</span> · {label}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            {metadata?.google_maps_widget_context_token ? (
                              <div className={styles.chatGroundingWidget}>
                                <span>Widget token:</span>
                                <code>{metadata?.google_maps_widget_context_token}</code>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()
                    ) : null}
                  </>
                )}
              </div>
              {!showStreamingIndicator && editingMessageId !== message.id && (
                <div className={styles.chatMessageFooter}>
                  <div className={styles.chatMessageFooterInner} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.chatMessageFooterLeft}>
                      <time className={styles.chatMessageTimestamp} dateTime={messageTimestampIso}>
                        {timestampLabel}
                      </time>
                      {isAssistant && Array.isArray(message.variants) && message.variants.length > 1 ? (
                        <div className={styles.chatMessageVariantControls}>
                          <button
                            type="button"
                            aria-label="Previous response"
                            onClick={() => handleCycleAssistantVariant(message.id, "prev")}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className={styles.chatMessageVariantLabel}>
                            {(message.activeVariantIndex ?? message.variants.length - 1) + 1} /{" "}
                            {message.variants.length}
                          </span>
                          <button
                            type="button"
                            aria-label="Next response"
                            onClick={() => handleCycleAssistantVariant(message.id, "next")}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.chatMessageFooterRight}>
                      <div className={styles.chatActionIconRow}>
                        {isMetadataAvailable ? (
                          <div className={styles.chatMetadataControl}>
                            <button type="button" aria-label="Response details" tabIndex={0}>
                              <SignalHigh size={15} />
                            </button>
                            <div className={styles.chatMetadataPopover} role="tooltip" aria-hidden="true">
                              {metadataRows.map((row) => (
                                <div key={row.label}>
                                  <span>{row.label}</span>
                                  <strong>{row.value}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Copy message"
                          onClick={() => handleCopyMessage(message.id, isAssistant ? fullText : rawContent)}
                          disabled={!(isAssistant ? fullText.trim() : rawContent.trim())}
                        >
                          {copiedMessageId === message.id ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                        </button>
                        {isAssistant && (
                          <button
                            type="button"
                            aria-label="Regenerate response"
                            onClick={() => handleRegenerate(message.id)}
                            disabled={isRegenerating || isResponding}
                          >
                            <RefreshCw size={15} className={isRegenerating ? styles.spin : undefined} />
                          </button>
                        )}
                        {!isAssistant && (
                          <button
                            type="button"
                            aria-label="Edit message"
                            onClick={() => startEditing(message.id, rawContent)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {!isAssistant && (
                          <button
                            type="button"
                            aria-label="Retry message"
                            onClick={() => handleRetryUserMessage(message.id)}
                            disabled={!rawContent.trim()}
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Delete message"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {isAssistant && quickReplies.length > 0 && (
                      <div className={styles.chatQuickReplies}>
                        {quickReplies.map((reply) => (
                          <button key={reply} type="button">
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

ChatMessagesList.displayName = "ChatMessagesList";

const formatDurationLabel = (durationMs?: number): string | null => {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }
  const seconds = durationMs / 1000;
  if (seconds < 0.1) {
    const ms = Math.max(1, Math.round(durationMs));
    return `${ms}ms`;
  }
  if (seconds >= 10) {
    return `${Math.round(seconds)}s`;
  }
  return `${seconds.toFixed(1)}s`;
};

const formatBackendTimingLabel = (
  timing?: ChatSessionMessage["backendTimings"]
): string | null => {
  if (!timing) {
    return null;
  }
  const totalLabel = formatDurationLabel(timing.totalMs);
  if (!totalLabel) {
    return null;
  }
  return totalLabel;
};

const formatMessageTimestamp = (timestamp: number | undefined): string => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const timeLabel = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date >= startOfToday) {
    return timeLabel;
  }
  if (date >= startOfYesterday) {
    return `Yesterday · ${timeLabel}`;
  }
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `${dateLabel}, ${timeLabel}`;
};

type AssistantSections = {
  user: string | null;
  thinking: string | null;
  ai: string;
  isStructured: boolean;
};

// Memoized cache for parseStructuredAssistantMessage to avoid re-parsing same content
const parseCache = new Map<string, AssistantSections>();
const PARSE_CACHE_SIZE = 1000;

const stripToolUseBlocks = (text: string): string => {
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

const extractCurrentToolStatus = (text: string): string | null => {
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
    return "Reading the internet...";
  }
  if (normalized.includes("image") || normalized.includes("painting")) {
    return "Painting pixels...";
  }
  if (normalized.includes("plan") || normalized.includes("habit") || normalized.includes("calendar")) {
    return "Checking schedule...";
  }
  if (normalized.includes("memory") || normalized.includes("remember")) {
    return "Accessing memory...";
  }

  // Clean up snake_case or camelCase to Sentence case
  const readable = toolName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim();

  return `Using ${readable.toLowerCase()}...`;
};

const parseStructuredAssistantMessage = (content?: string | null): AssistantSections => {
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
  const findIndex = (needle: string, fromIndex = 0) =>
    lower.indexOf(needle.toLowerCase(), fromIndex);

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
  const effectiveThinkingIndex =
    thinkingLabelIndex !== -1 ? thinkingLabelIndex : chainLabelIndex;
  const effectiveThinkingLabel =
    thinkingLabelIndex !== -1 && thinkingLabelIndex === effectiveThinkingIndex
      ? thinkingLabel
      : chainOfThoughtLabel;
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
        base.thinking = normalized
          .slice(thinkingContentStart, thinkingTagEnd)
          .trim() || null;
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

const AVERAGE_CHARS_PER_TOKEN = 4;

const estimateTokenCount = (content: string | null | undefined): number => {
  if (!content) {
    return 0;
  }
  const normalized = content.trim();
  if (!normalized) {
    return 0;
  }
  const lengthBased = Math.ceil(normalized.length / AVERAGE_CHARS_PER_TOKEN);
  const wordBased = normalized.split(/\s+/g).filter(Boolean).length;
  return Math.max(lengthBased, wordBased);
};

import { ModelSelector } from "./ModelSelector";

export function GrayChatView({
  sessionId,
  introContent,
  onContextUsageChange,
  hideThinkingIndicator = false,
}: GrayChatViewProps) {
  const {
    sessions,
    getSession,
    ensureSession,
    appendMessage,
    updateMessage,
    deleteMessage,
    updateSession,
    workspaceContext,
    applyAutoTitle,
    hasAutoStreamTriggered,
    markAutoStreamTriggered,
    resetAutoStreamState,
    personalizedSystemPrompt,
    attachments,
    isAttachmentUploading,
    attachmentError,
    uploadAttachments,
    removeAttachment,
    clearAttachments,
    mapsEnabled,
    mapsWidgetEnabled,
    mapsLatitude,
    mapsLongitude,
    setMapsEnabled,
    setMapsWidgetEnabled,
    setMapsLatitude,
    setMapsLongitude,
    mapPayload,
    pendingLocationRequestMessage,
    isRequestingLocation,
    requestLocationShare,
    skipLocationShare,
    contextCaches,
    contextCacheLabel,
    contextCacheContent,
    selectedContextCacheId,
    contextCacheMessage,
    isContextCacheSaving,
    createContextCache,
    selectContextCacheId,
    setContextCacheLabel,
    setContextCacheContent,
    fileSearchStores,
    fileSearchDisplayName,
    setFileSearchDisplayName,
    fileSearchStatus,
    isCreatingFileSearchStore,
    handleCreateFileSearchStore,
    selectedFileSearchStore,
    setSelectedFileSearchStore,
    fileSearchUploadFile,
    setFileSearchUploadFile,
    fileSearchUploadStatus,
    handleFileSearchUpload,
    fileSearchChunking,
    setFileSearchChunking,
    fileSearchImportName,
    setFileSearchImportName,
    fileSearchImportStatus,
    handleFileSearchImport,
    fileSearchUploadInputRef,
    webSearchEnabled,
    loadConversationMessages,
    sendGeneralMessage,
    modelTier,
    selectedModelId,
    reasoningMode,
  } = useChatStore();
  // Use sessions state directly for reactivity - getSession uses a ref which doesn't trigger re-renders
  const session = useMemo(() => {
    if (!sessionId) return undefined;
    return sessions.find((s) => s.id === sessionId);
  }, [sessionId, sessions]);
  const sessionExists = Boolean(session);

  // Load messages if they are missing (e.g. for historical threads)
  useEffect(() => {
    if (sessionId && session?.conversationId && session.messages.length === 0) {
      void loadConversationMessages(sessionId);
    }
  }, [sessionId, session?.conversationId, session?.messages.length, loadConversationMessages]);

  const { user, waitForUser } = useUser();
  const [draft, setDraft] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [thinkingDots, setThinkingDots] = useState("");
  const replyTimeout = useRef<number | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const isLoadingHistoryRef = useRef<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [activeStreamingMessageId, setActiveStreamingMessageId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [conversationUsage, setConversationUsage] = useState<ConversationUsage | null>(null);
  const isSubmittingRef = useRef(false);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  // Track when thinking content (inside <thinking> tags) actually starts
  const [isActivelyThinking, setIsActivelyThinking] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [reasoningSeconds, setReasoningSeconds] = useState<number | null>(null);

  const composerDockRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const handleAttachmentInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }
      uploadAttachments(files);
      event.target.value = "";
    },
    [uploadAttachments]
  );
  const openAttachmentPicker = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);
  const handleAttachmentPaste = useCallback(
    (files: File[]) => {
      if (!files || files.length === 0) {
        return;
      }
      uploadAttachments(files);
    },
    [uploadAttachments]
  );
  const activeSessionId = session?.id ?? null;
  const activeConversationId =
    session?.conversationId && session.conversationId !== GENERAL_CHAT_SESSION_ID
      ? session.conversationId
      : session?.scope === "general"
        ? buildGeneralConversationId(user?.id) ?? null
        : null;
  const buildAttachmentPayloads = useCallback(
    () => attachments.map((attachment) => ({ id: attachment.id })),
    [attachments]
  );
  const resolveChatUser = useCallback(async () => {
    if (user) {
      return user;
    }
    return waitForUser();
  }, [user, waitForUser]);

  const messages = useMemo(() => session?.messages ?? [], [session?.messages]);
  const sessionAutoStreamId = session?.id ?? null;
  const sessionConversationId = session?.conversationId ?? null;
  const sessionPendingAutoStream = Boolean(session?.pendingAutoStream);
  const isResponding = Boolean(session?.isResponding);
  const latestSearchSources = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") {
        continue;
      }
      if (!message.groundingMetadata) {
        return [];
      }
      const allSources = buildGroundingSourceCards(message.groundingMetadata);
      const searchSources = allSources.filter((source) => Boolean(source.href));
      return searchSources;
    }
    return [];
  }, [messages]);
  const locationRequestSummary = pendingLocationRequestMessage
    ? pendingLocationRequestMessage.length > 120
      ? `${pendingLocationRequestMessage.slice(0, 120)}…`
      : pendingLocationRequestMessage
    : "";
  const showIntro = Boolean(introContent) && (!session || messages.length === 0);
  const showAttachmentTray = session?.scope === "general";
  const topAttachmentTray = showAttachmentTray ? (
    <AttachmentTray
      attachments={attachments}
      isUploading={isAttachmentUploading}
      error={attachmentError}
      onAddAttachment={openAttachmentPicker}
      onRemoveAttachment={removeAttachment}
    />
  ) : null;
  const attachmentTrayNode = showAttachmentTray ? (
    <AttachmentTray
      attachments={attachments}
      isUploading={isAttachmentUploading}
      error={attachmentError}
      onAddAttachment={openAttachmentPicker}
      onRemoveAttachment={removeAttachment}
    />
  ) : null;
  const isAssistantThinking = isResponding || sessionPendingAutoStream;
  const streamingStatusLabel = sessionPendingAutoStream ? "searching" : "thinking";
  useEffect(() => {
    if (!isAssistantThinking || hideThinkingIndicator) {
      setThinkingDots("");
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const frames = ["", ".", "..", "..."];
    let index = 0;
    const handle = window.setInterval(() => {
      index = (index + 1) % frames.length;
      setThinkingDots(frames[index]);
    }, 400);
    return () => {
      window.clearInterval(handle);
    };
  }, [hideThinkingIndicator, isAssistantThinking]);
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasHydrated || !session?.id || !scrollAnchorRef.current) {
      return;
    }
    // Scroll to bottom on initial load (after messages are loaded)
    scrollAnchorRef.current.scrollIntoView({ behavior: "auto" });
  }, [hasHydrated, session?.id, messages.length]);

  const streamingContentSignature = useMemo(() => {
    if (!activeStreamingMessageId) {
      return null;
    }
    const target = messages.find((message) => message.id === activeStreamingMessageId);
    if (!target) {
      return null;
    }
    const contentLength = target.content?.length ?? 0;
    return `${activeStreamingMessageId}:${contentLength}`;
  }, [activeStreamingMessageId, messages]);

  const scrollToBottomIfNear = useCallback((instant = false) => {
    const viewport = chatViewportRef.current;
    if (!viewport || !scrollAnchorRef.current) return;

    // Use a generous threshold to ensure smooth auto-scroll on mobile devices
    const threshold = 300;
    const isNearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;

    if (isNearBottom) {
      scrollAnchorRef.current.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
    }
  }, []);

  // Force scroll to bottom unconditionally (used when user sends a message)
  const scrollToBottom = useCallback((instant = false) => {
    if (!scrollAnchorRef.current) return;
    scrollAnchorRef.current.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  }, []);

  // Auto-scroll on new messages - always scroll to show the new message
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Auto-scroll during active streaming if near bottom (use instant to prevent jitter)
  useEffect(() => {
    if (streamingContentSignature) {
      scrollToBottomIfNear(true);
    }
  }, [streamingContentSignature, scrollToBottomIfNear]);

  useLayoutEffect(() => {
    const node = composerDockRef.current;
    if (!node || typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return;
    }
    const updateHeight = () => {
      setComposerHeight(node.offsetHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);





  const chatViewStyle: CSSProperties | undefined =
    composerHeight > 0 ? ({ "--chat-composer-height": `${composerHeight}px` } as CSSProperties) : undefined;

  useEffect(() => {
    setActiveStreamingMessageId(null);
    // Reset submit state to prevent blocking after navigation
    isSubmittingRef.current = false;
  }, [session?.id]);

  useEffect(() => {
    if (isHistoryLoading) {
      setActiveStreamingMessageId(null);
    }
  }, [isHistoryLoading]);

  useEffect(() => {
    if (!activeConversationId) {
      setConversationUsage(null);
      return;
    }

    let cancelled = false;
    setConversationUsage((previous) =>
      previous && previous.conversationId === activeConversationId ? previous : null
    );
    const loadUsage = async () => {
      try {
        const usage = await apiService.getConversationUsage(activeConversationId);
        if (!cancelled) {
          setConversationUsage(usage);
        }
      } catch (error) {
        if (!cancelled) {
          console.info("Conversation usage unavailable:", error);
          setConversationUsage(null);
        }
      }
    };

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);
  useEffect(
    () => () => {
      if (replyTimeout.current !== null) {
        window.clearTimeout(replyTimeout.current);
        replyTimeout.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
      replyTimeout.current = null;
    }
  }, [session?.id]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // console.log('[ChatView] History loading effect running', {
    //   activeSessionId,
    //   activeConversationId,
    //   sessionMessagesLength: session?.messages?.length,
    //   isLoadingHistoryRef: isLoadingHistoryRef.current
    // });

    if (!activeSessionId || !activeConversationId) {
      // console.log('[ChatView] Skipping: no session ID or conversation ID');
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = null;
      return;
    }

    if (isLoadingHistoryRef.current === `${activeSessionId}:${activeConversationId}`) {
      // console.log('[ChatView] Skipping: already loading this conversation');
      return;
    }

    // Skip loading if we already have messages AND they include assistant messages
    // (user messages will appear before backend sends the response)
    const hasAssistantMessages = session?.messages?.some((msg) => msg.role === "assistant");
    const isGeneralConversation =
      typeof activeConversationId === "string" && activeConversationId.startsWith("general:");
    if (hasAssistantMessages && !isGeneralConversation) {
      // console.log('[ChatView] Skipping: already has assistant messages');
      return;
    }

    // console.log('[ChatView] Loading conversation history for:', activeConversationId);
    let cancelled = false;
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = `${activeSessionId}:${activeConversationId}`;

    (async () => {
      try {
        const history = await apiService.getConversation(activeConversationId);
        // console.log('[ChatView] Loaded history:', history?.length, 'messages');
        if (cancelled) {
          return;
        }

        if (!Array.isArray(history) || history.length === 0) {
          updateSession(activeSessionId, {
            conversationId: activeConversationId ?? undefined,
            messages: [],
            updatedAt: Date.now(),
            isResponding: false,
          });
          return;
        }

        // Deduplicate consecutive identical backend messages so that if the same
        // user entry is stored twice, it only renders once in the UI.
        const dedupedHistory = history.filter((message, index, arr) => {
          if (index === 0) {
            return true;
          }
          const prev = arr[index - 1];
          // Check for exact duplicate content/role
          if (prev.role === message.role && (prev.text ?? "") === (message.text ?? "")) {
            return false;
          }
          // Also filter out "User" messages that are identical to the *optimistic* message
          // we might currently be holding, IF we are merging? 
          // Actually, this logic just filters the backend array itself.
          return true;
        });

        const mappedHistory: ChatSessionMessage[] = dedupedHistory.map((message, index) => {
          const role: ChatRole = message.role === "model" ? "assistant" : "user";
          const rawText = message.text ?? "";
          const normalizedText = role === "assistant" ? stripGrayTitleMarkers(rawText) : rawText;
          const reminderExtraction =
            role === "assistant"
              ? extractGrayRemindersFromText(normalizedText)
              : { cleanText: normalizedText, reminders: [] };
          const normalizedMetadata =
            (message as { grounding_metadata?: GroundingMetadata | null }).grounding_metadata ??
            (message as { groundingMetadata?: GroundingMetadata | null }).groundingMetadata ??
            null;
          return {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${activeConversationId}-${index}-${Date.now()}`,
            role,
            content: reminderExtraction.cleanText,
            createdAt: Date.now(),
            reminders:
              role === "assistant" && reminderExtraction.reminders.length
                ? reminderExtraction.reminders
                : undefined,
            groundingMetadata: normalizedMetadata ?? undefined,
          };
        });

        updateSession(activeSessionId, {
          conversationId: activeConversationId ?? undefined,
          messages: mappedHistory,
          updatedAt: Date.now(),
          isResponding: false,
        });
      } catch (error) {
        console.error("Failed to load conversation history:", error);
        updateSession(activeSessionId, {
          conversationId: activeConversationId ?? undefined,
          messages: session?.messages ?? [],
          updatedAt: Date.now(),
          isResponding: false,
        });
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, activeSessionId, session, updateSession]);

  const streamAssistantReply = useCallback(
    async (
      targetSessionId: string,
      prompt: string,
      conversationId: string | null,
      existingAssistantId?: string | null
    ) => {
      updateSession(targetSessionId, { isResponding: true, pendingAutoStream: false });
      // Reset thinking tracking state
      setIsActivelyThinking(false);
      setThinkingStartTime(null);
      setReasoningSeconds(null);
      const resolvedUser = await resolveChatUser();
      if (!resolvedUser) {
        const fallback = buildAssistantReply(prompt);
        appendMessage(targetSessionId, "assistant", fallback);
        updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false });
        return fallback;
      }

      const useWorkspaceContext = shouldIncludeWorkspaceContext(prompt, workspaceContext);
      const contextPayload = useWorkspaceContext ? workspaceContext ?? undefined : undefined;
      let assistantMessageId: string | null = existingAssistantId ?? null;
      let streamingMessageId: string | null = assistantMessageId ?? null;
      let previousVariants: string[] = [];
      let isRegeneration = false;
      if (existingAssistantId && session && session.id === targetSessionId) {
        const existingAssistant = session.messages.find(
          (message) => message.id === existingAssistantId && message.role === "assistant"
        );
        if (existingAssistant) {
          const hasContent = Boolean(existingAssistant.content && existingAssistant.content.trim());
          if (hasContent) {
            isRegeneration = true;
          }
          if (Array.isArray(existingAssistant.variants) && existingAssistant.variants.length > 0) {
            previousVariants = [...existingAssistant.variants];
          } else if (hasContent) {
            previousVariants = [existingAssistant.content as string];
          }
        }
      }
      let accumulated = "";
      let capturedReminders: unknown[] = [];
      const isGeneralSession = session?.scope === "general";
      let streamedConversationId: string | null = isGeneralSession
        ? null
        : normalizeConversationIdValue(conversationId) ?? null;
      if (!isGeneralSession && !streamedConversationId) {
        const normalizedFromSessionId = normalizeConversationIdValue(targetSessionId);
        if (normalizedFromSessionId) {
          streamedConversationId = normalizedFromSessionId;
        }
      }
      let didReceiveToken = false;
      const streamingUserId = resolvedUser.id;
      const requestTitleHint = shouldRequestAutoTitleForSession(session);
      const abortController = new AbortController();
      streamAbortControllerRef.current = abortController;
      const shouldUseWebSearch = webSearchEnabled;
      const shouldAttachToConversation = !isRegeneration;
      // If we are regenerating an existing assistant message (not just filling a
      // blank placeholder), clear its content immediately so the previous text
      // disappears while the new reply streams.
      if (isRegeneration && existingAssistantId) {
        updateMessage(targetSessionId, existingAssistantId, {
          content: "",
          groundingMetadata: undefined,
        });
      }
      if (!assistantMessageId) {
        const placeholderAssistant = appendMessage(targetSessionId, "assistant", "");
        assistantMessageId = (placeholderAssistant as ChatSessionMessage | null)?.id ?? null;
        streamingMessageId = assistantMessageId;
      }
      if (streamingMessageId) {
        setActiveStreamingMessageId(streamingMessageId);
      }
      // Show skeleton loader in sidebar while title is being generated
      if (requestTitleHint) {
        updateSession(targetSessionId, { isGeneratingTitle: true });
      }
      try {
        const timeContext = buildLocalTimeContext();
        for await (const event of apiService.sendMessageStream(
          {
            message: prompt,
            conversation_id: shouldAttachToConversation
              ? isGeneralSession
                ? buildGeneralConversationId(streamingUserId)
                : streamedConversationId ?? undefined
              : undefined,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            time_context: timeContext,
            attachments: buildAttachmentPayloads(),
            should_generate_title: requestTitleHint,
            web_search_enabled: shouldUseWebSearch,
            model: selectedModelId ?? modelTier, // Pass the selected model ID or tier
            reasoning_mode: reasoningMode,
            ...(modelTier === "lite" ? { maps_enabled: false, maps_widget: false } : mapPayload),
          },
          { signal: abortController.signal }
        )) {
          if (event.type === "token") {
            didReceiveToken = true;
            const delta = event.delta;
            const prevAccumulated = accumulated;
            accumulated = accumulated + delta;

            // Detect when thinking content starts (first <thinking> tag appears)
            const hasThinkingTag = accumulated.toLowerCase().includes("<thinking>");
            const hadThinkingTag = prevAccumulated.toLowerCase().includes("<thinking>");
            if (hasThinkingTag && !hadThinkingTag) {
              // Thinking just started
              setIsActivelyThinking(true);
              setThinkingStartTime(Date.now());
            }

            // Detect when thinking ends (</thinking> tag appears)
            const hasClosingTag = accumulated.toLowerCase().includes("</thinking>");
            const hadClosingTag = prevAccumulated.toLowerCase().includes("</thinking>");
            if (hasClosingTag && !hadClosingTag && thinkingStartTime) {
              // Thinking just ended - calculate final duration
              const elapsed = (Date.now() - thinkingStartTime) / 1000;
              setReasoningSeconds(elapsed);
              setIsActivelyThinking(false);
            }

            if (!assistantMessageId) {
              const assistantMessage = appendMessage(targetSessionId, "assistant", accumulated);
              assistantMessageId = (assistantMessage as { id: string } | null)?.id ?? null;
              streamingMessageId = assistantMessageId;
              if (streamingMessageId) {
                setActiveStreamingMessageId(streamingMessageId);
              }
            } else if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, { content: accumulated });
            }
            if (assistantMessageId) {
              updateSession(targetSessionId, { isResponding: true, pendingAutoStream: false });
            }
            continue;
          }

          if (event.type === "reminders") {
            if (Array.isArray(event.reminders) && event.reminders.length > 0) {
              capturedReminders = event.reminders;
            }
            continue;
          }

          if (event.type === "end") {
            // For general sessions we keep using the synthetic general conversation
            // identifier instead of adopting any backend UUID so that /g remains
            // a single stable thread.
            if (!isGeneralSession) {
              streamedConversationId =
                normalizeConversationIdValue(event.conversationId) ?? streamedConversationId;
            }
            const normalizedResponse = normalizeAssistantContent(event.response ?? accumulated, prompt);
            accumulated = normalizedResponse;
            if (event.title) {
              applyAutoTitle(targetSessionId, event.title);
            }
            const metadata = event.groundingMetadata ?? undefined;
            const baseVariants = previousVariants.length > 0 ? previousVariants : [];
            // Process reminders: prefer structured SSE payloads, fallback to text extraction.
            let finalReminders: GrayReminderCreatedPayload[] | undefined;
            if (capturedReminders.length > 0) {
              finalReminders = capturedReminders
                .map((candidate) => coerceReminderPayload(candidate))
                .filter((r): r is GrayReminderCreatedPayload => Boolean(r));
            } else {
              const extracted = extractGrayRemindersFromText(normalizedResponse);
              if (extracted.reminders.length > 0) {
                finalReminders = extracted.reminders;
              }
            }

            let finalContent = normalizedResponse;
            if (finalReminders && finalReminders.length > 0 && !finalContent.trim()) {
              const confirmation = buildReminderConfirmationText(finalReminders);
              if (confirmation) {
                finalContent = confirmation;
              }
            }

            const nextVariants = finalContent ? [...baseVariants, finalContent] : baseVariants;
            const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;
            if (!assistantMessageId) {
              const assistantMessage = appendMessage(
                targetSessionId,
                "assistant",
                finalContent,
                undefined,
                metadata
              );
              assistantMessageId = (assistantMessage as ChatSessionMessage | null)?.id ?? null;
              streamingMessageId = assistantMessageId;
              if (assistantMessageId) {
                updateMessage(targetSessionId, assistantMessageId, {
                  reminders: finalReminders,
                  variants: nextVariants,
                  activeVariantIndex: nextActiveIndex,
                });
              }
              if (streamingMessageId) {
                setActiveStreamingMessageId(streamingMessageId);
              }
            } else if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                content: finalContent,
                groundingMetadata: metadata,
                reminders: finalReminders,
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
              });
            }
            updateSession(targetSessionId, {
              conversationId: shouldAttachToConversation
                ? streamedConversationId ?? undefined
                : session?.conversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
              isGeneratingTitle: false,
            });
            clearAttachments();
            return finalContent;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }

        if (!assistantMessageId) {
          const normalized = normalizeAssistantContent(accumulated, prompt);
          const assistantMessage = appendMessage(targetSessionId, "assistant", normalized);
          assistantMessageId = (assistantMessage as { id: string } | null)?.id ?? null;
          accumulated = normalized;
          const baseVariants = previousVariants.length > 0 ? previousVariants : [];
          const nextVariants = normalized ? [...baseVariants, normalized] : baseVariants;
          const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, {
              variants: nextVariants,
              activeVariantIndex: nextActiveIndex,
            });
          }
          if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
            streamingMessageId = assistantMessageId;
            setActiveStreamingMessageId(assistantMessageId);
          }
        }
        updateSession(targetSessionId, {
          conversationId: shouldAttachToConversation
            ? streamedConversationId ?? undefined
            : session?.conversationId ?? undefined,
          isResponding: false,
          pendingAutoStream: false,
          isGeneratingTitle: false,
        });
        clearAttachments();
        return accumulated;
      } catch (error) {
        console.warn("Failed to stream assistant reply:", error);
        try {
          const fallbackResponse = await apiService.sendMessage({
            message: prompt,
            conversation_id: shouldAttachToConversation
              ? isGeneralSession
                ? buildGeneralConversationId(streamingUserId)
                : streamedConversationId ?? undefined
              : undefined,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            time_context: buildLocalTimeContext(),
            timezone: resolveClientTimezone(),
            attachments: buildAttachmentPayloads(),
            context_cache_id: selectedContextCacheId ?? undefined,
            web_search_enabled: shouldUseWebSearch,
            should_generate_title: requestTitleHint,
            model: selectedModelId ?? modelTier, // Pass the selected model ID or tier
            reasoning_mode: reasoningMode,
            ...(modelTier === "lite" ? { maps_enabled: false, maps_widget: false } : mapPayload),
          });
          streamedConversationId =
            normalizeConversationIdValue(fallbackResponse.conversation_id) ?? streamedConversationId;
          const finalResponse = normalizeAssistantContent(fallbackResponse.response, prompt);
          const fallbackMetadata = fallbackResponse.groundingMetadata ?? undefined;
          if (fallbackResponse.title) {
            applyAutoTitle(targetSessionId, fallbackResponse.title);
          }
          const baseVariants = previousVariants.length > 0 ? previousVariants : [];
          const nextVariants = finalResponse ? [...baseVariants, finalResponse] : baseVariants;
          const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, {
              content: finalResponse,
              groundingMetadata: fallbackMetadata,
              variants: nextVariants,
              activeVariantIndex: nextActiveIndex,
              id: fallbackResponse.message_id ? String(fallbackResponse.message_id) : undefined,
            });
          } else {
            const assistantMessage = appendMessage(
              targetSessionId,
              "assistant",
              finalResponse
            );
            assistantMessageId = assistantMessage?.id ?? null;
            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
              });
            }
            if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
              streamingMessageId = assistantMessageId;
              setActiveStreamingMessageId(assistantMessageId);
            }
          }
          updateSession(targetSessionId, {
            conversationId: shouldAttachToConversation
              ? streamedConversationId ?? undefined
              : session?.conversationId ?? undefined,
            isResponding: false,
            pendingAutoStream: false,
          });
          clearAttachments();
          return finalResponse;
        } catch (fallbackError) {
          console.warn("Fallback chat request failed:", fallbackError);
          const fallback = buildAssistantReply(prompt);
          const baseVariants = previousVariants.length > 0 ? previousVariants : [];
          const nextVariants = fallback ? [...baseVariants, fallback] : baseVariants;
          const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, {
              content: fallback,
              variants: nextVariants,
              activeVariantIndex: nextActiveIndex,
            });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", fallback);
            assistantMessageId = assistantMessage?.id ?? null;
            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
              });
            }
            if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
              streamingMessageId = assistantMessageId;
              setActiveStreamingMessageId(assistantMessageId);
            }
          }
          updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false });
          clearAttachments();
          return fallback;
        }
      } finally {
        if (streamAbortControllerRef.current === abortController) {
          streamAbortControllerRef.current = null;
        }
        if (streamingMessageId) {
          setActiveStreamingMessageId((previous) =>
            previous === streamingMessageId ? null : previous
          );
        }
      }
    },
    [
      appendMessage,
      resolveChatUser,
      updateMessage,
      updateSession,
      workspaceContext,
      personalizedSystemPrompt,
      applyAutoTitle,
      session,
    ]
  );

  useEffect(() => {
    if (!session) {
      if (sessionId) {
        resetAutoStreamState(sessionId);
      }
      return;
    }

    // If we are currently submitting a message (optimistic update), ignore auto-stream
    // to prevent race conditions where the effect sees the new message before
    // the submit handler has marked the session as responding.
    if (isSubmittingRef.current) {
      return;
    }

    if (!sessionAutoStreamId) {
      return;
    }

    // If this session was created as a shell for a /c/{conversationId} URL and has
    // no local messages yet, skip auto-streaming. History hydration (below) will
    // populate messages if the backend knows this conversation.
    if (sessionConversationId && messages.length === 0) {
      return;
    }

    // If this session is already streaming a reply, do not trigger another.
    if (session?.isResponding) {
      return;
    }

    // Wait for user to be available to avoid race conditions with resolveChatUser
    if (!user) {
      return;
    }

    // Only ever auto-respond to genuine user messages, never to assistant output.
    const hasPendingAutoStream = sessionPendingAutoStream;
    const lastUserMessage =
      [...messages].reverse().find((message) => message.role === "user") ?? null;
    const lastAssistantMessage =
      [...messages].reverse().find((message) => message.role === "assistant") ?? null;

    // Some flows (e.g., createThreadSession) seed an empty assistant message before
    // the actual stream starts. If navigation interrupts that stream we end up with
    // a blank assistant entry, so treat it as "awaiting" unless it has real content.
    const assistantHasContent = Boolean(lastAssistantMessage?.content?.trim());

    const isAwaitingAssistant =
      Boolean(lastUserMessage) &&
      (!lastAssistantMessage ||
        lastAssistantMessage.createdAt < (lastUserMessage?.createdAt ?? 0) ||
        !assistantHasContent);

    // If we have an assistant message that is just empty/loading, do not trigger a new one.
    // This prevents double-triggering while the first one is being created or streamed.
    if (lastAssistantMessage && !assistantHasContent) {
      return;
    }

    const hasAlreadyTriggeredForLastUser =
      lastUserMessage != null && hasAutoStreamTriggered(sessionAutoStreamId, lastUserMessage.id);

    // Only auto-respond when the session explicitly flagged a pending auto-stream.
    // This prevents re-sending old prompts on reload just because the last message
    // happens to be from the user.
    const shouldRespond = !hasAlreadyTriggeredForLastUser && hasPendingAutoStream;

    if (!shouldRespond) {
      return;
    }

    // At this point shouldRespond guarantees we had a last user message,
    // but narrow explicitly for TypeScript.
    const safeLastUserMessage = lastUserMessage;
    if (!safeLastUserMessage) {
      return;
    }

    // Mark that we've handled this specific user message so we don't re-trigger.
    // Mark that we've handled this specific user message so we don't re-trigger.
    markAutoStreamTriggered(sessionAutoStreamId, safeLastUserMessage.id);

    // Set isResponding: true immediately to prevent spinner disappearing during race condition
    // between clearing pendingAutoStream and streamAssistantReply setting isResponding.
    updateSession(sessionAutoStreamId, { pendingAutoStream: false, isResponding: true });

    const placeholderAssistantId =
      !assistantHasContent && lastAssistantMessage ? lastAssistantMessage.id : null;

    void streamAssistantReply(
      sessionAutoStreamId,
      lastUserMessage.content,
      sessionConversationId ?? null,
      placeholderAssistantId
    );
  }, [
    hasAutoStreamTriggered,
    markAutoStreamTriggered,
    messages,
    sessionId,
    session,
    resetAutoStreamState,
    sessionAutoStreamId,
    sessionConversationId,
    sessionPendingAutoStream,
    streamAssistantReply,
    updateSession,
    user,
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // If a stream is in progress, treat submit as "cancel".
    if (session?.isResponding || activeStreamingMessageId) {
      const controller = streamAbortControllerRef.current;
      if (controller) {
        controller.abort();
        streamAbortControllerRef.current = null;
      }
      if (session) {
        updateSession(session.id, { isResponding: false, pendingAutoStream: false });
      }
      setActiveStreamingMessageId((previous) => (previous ? null : previous));
      isSubmittingRef.current = false;
      return;
    }
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    let targetSession = session;
    if (!targetSession && sessionId) {
      const nowTs = Date.now();
      const normalizedSessionConversationId = normalizeConversationIdValue(sessionId);
      targetSession = ensureSession(sessionId, () => ({
        id: sessionId,
        title: "New Chat",
        titleMode: "auto",
        createdAt: nowTs,
        updatedAt: nowTs,
        messages: [],
        isResponding: false,
        scope: "thread",
        conversationId: normalizedSessionConversationId ?? undefined,
        pendingAutoStream: false,
      }));
    }
    if (!targetSession) {
      isSubmittingRef.current = false;
      return;
    }
    const content = draft.trim();
    if (!content) {
      isSubmittingRef.current = false;
      return;
    }

    // General chat handles its own optimistic append to avoid duplicate user messages
    if (targetSession.scope === "general") {
      setDraft("");
      if (replyTimeout.current !== null) {
        window.clearTimeout(replyTimeout.current);
        replyTimeout.current = null;
      }
      void sendGeneralMessage(content).finally(() => {
        isSubmittingRef.current = false;
      });
      return;
    }

    // Generate a temp ID and mark it as already triggered BEFORE appending
    // This prevents the auto-stream effect from racing with our own streaming
    const tempUserMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    markAutoStreamTriggered(targetSession.id, tempUserMessageId);

    const userMessage = appendMessage(targetSession.id, "user", content, tempUserMessageId);
    setDraft("");
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
    }

    if (userMessage) {
      void streamAssistantReply(
        targetSession.id,
        content,
        targetSession.conversationId ?? null
      ).finally(() => {
        isSubmittingRef.current = false;
      });
      return;
    }

    appendMessage(targetSession.id, "assistant", buildAssistantReply(content));
    replyTimeout.current = null;
    isSubmittingRef.current = false;
  };

  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  const getResponseDurationLabel = useCallback(
    (messageIndex: number) => {
      const message = messages[messageIndex];
      if (!message || message.role !== "assistant") {
        return null;
      }
      for (let index = messageIndex - 1; index >= 0; index -= 1) {
        const candidate = messages[index];
        if (candidate.role === "assistant") {
          continue;
        }
        if (candidate.role === "user") {
          const diffMs = Math.max(0, message.createdAt - candidate.createdAt);
          if (!Number.isFinite(diffMs)) {
            return null;
          }
          return formatDurationLabel(diffMs);
        }
      }
      return null;
    },
    [messages]
  );

  const handleCopyMessage = useCallback(
    async (messageId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        console.warn("Clipboard API is not available in this environment.");
        return;
      }
      try {
        await navigator.clipboard.writeText(trimmed);
        setCopiedMessageId(messageId);
        if (copyResetTimeoutRef.current !== null) {
          window.clearTimeout(copyResetTimeoutRef.current);
        }
        copyResetTimeoutRef.current = window.setTimeout(() => {
          setCopiedMessageId(null);
          copyResetTimeoutRef.current = null;
        }, 2000);
      } catch (error) {
        console.error("Failed to copy response:", error);
      }
    },
    []
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }
      const targetIndex = messages.findIndex((message) => message.id === messageId);
      const targetMessage = targetIndex >= 0 ? messages[targetIndex] : null;
      if (activeStreamingMessageId === messageId) {
        setActiveStreamingMessageId(null);
      }
      if (copiedMessageId === messageId) {
        setCopiedMessageId(null);
      }
      deleteMessage(session.id, messageId);
      if (!targetMessage) {
        return;
      }
      if (targetMessage.role === "assistant") {
        const precedingUser = [...messages]
          .slice(0, targetIndex)
          .reverse()
          .find((message) => message.role === "user");
        if (precedingUser) {
          markAutoStreamTriggered(session.id, precedingUser.id);
        }
        updateSession(session.id, { pendingAutoStream: false, isResponding: false });
        return;
      }
      if (targetMessage.role === "user") {
        markAutoStreamTriggered(session.id, targetMessage.id);
        updateSession(session.id, { pendingAutoStream: false, isResponding: false });
        return;
      }
    },
    [
      activeStreamingMessageId,
      copiedMessageId,
      deleteMessage,
      markAutoStreamTriggered,
      messages,
      session,
      updateSession,
    ]
  );

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!session) {
        return;
      }
      updateMessage(session.id, messageId, { content: newContent });
    },
    [session, updateMessage]
  );

  const handleRetryUserMessage = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }
      const messageIndex = messages.findIndex((message) => message.id === messageId);
      if (messageIndex === -1) {
        return;
      }
      const target = messages[messageIndex];
      if (target.role !== "user") {
        return;
      }
      const content = target.content ?? "";
      if (!content.trim()) {
        return;
      }

      // If there is an assistant response immediately following this message,
      // regenerate it. Otherwise, generate a new response.
      const nextMessage = messages[messageIndex + 1];
      const existingAssistantId =
        nextMessage?.role === "assistant" ? nextMessage.id : undefined;

      void streamAssistantReply(
        session.id,
        content,
        session.conversationId ?? null,
        existingAssistantId
      );
    },
    [messages, session, streamAssistantReply]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }

      // Prevent regeneration while already streaming a response
      if (session.isResponding || activeStreamingMessageId) {
        return;
      }

      const assistantIndex = messages.findIndex((message) => message.id === messageId);
      if (assistantIndex === -1) {
        return;
      }

      const assistantMessage = messages[assistantIndex];
      if (assistantMessage.role !== "assistant") {
        return;
      }

      // Allow regenerating any assistant message, not just the latest
      let userIndex = assistantIndex - 1;
      while (userIndex >= 0 && messages[userIndex].role !== "user") {
        userIndex -= 1;
      }
      if (userIndex < 0) {
        console.warn("Unable to locate the originating user message for regeneration.");
        return;
      }

      const userMessage = messages[userIndex];

      setRegeneratingMessageId(assistantMessage.id);
      void (async () => {
        try {
          await streamAssistantReply(
            session.id,
            userMessage.content,
            session.conversationId ?? null,
            assistantMessage.id
          );
        } finally {
          setRegeneratingMessageId(null);
        }
      })();
    },
    [
      activeStreamingMessageId,
      messages,
      session,
      streamAssistantReply,
    ]
  );

  const handleCycleAssistantVariant = useCallback(
    (messageId: string, direction: "prev" | "next") => {
      if (!session) {
        return;
      }
      const target = session.messages.find(
        (message) => message.id === messageId && message.role === "assistant"
      );
      if (!target || !Array.isArray(target.variants) || target.variants.length <= 1) {
        return;
      }
      const total = target.variants.length;
      const currentIndex =
        typeof target.activeVariantIndex === "number" && target.activeVariantIndex >= 0
          ? target.activeVariantIndex
          : total - 1;
      const delta = direction === "prev" ? -1 : 1;
      let nextIndex = currentIndex + delta;
      if (nextIndex < 0) {
        nextIndex = total - 1;
      } else if (nextIndex >= total) {
        nextIndex = 0;
      }
      const nextContent = target.variants[nextIndex] ?? target.content;
      updateMessage(session.id, messageId, {
        content: nextContent,
        activeVariantIndex: nextIndex,
      });
    },
    [session, updateMessage]
  );

  // Respect the backend as the single source of truth for context limits.
  // If limit > 0, use it. If limit is 0/undefined, treat as "unlimited" and let
  // downstream consumers decide how to present that (e.g. "Unlimited context").
  const contextLimit =
    typeof conversationUsage?.limit === "number" && conversationUsage.limit > 0
      ? conversationUsage.limit
      : 0;
  const fallbackConversationTokens = useMemo(() => {
    if (!session) {
      return 0;
    }
    return session.messages.reduce((total, message) => {
      const contentTokens = estimateTokenCount(message.content);
      return total + contentTokens;
    }, 0);
  }, [session]);

  const conversationContextStats = useMemo(() => {
    const limit = contextLimit;

    // Count messages participating in the current session context.
    // Always use the actual session message count as the source of truth
    const messageCount = session?.messages.length ?? 0;

    // Prefer backend-accurate token usage; otherwise estimate from all session messages.
    const conversationTokens =
      typeof conversationUsage?.conversationTokens === "number" && conversationUsage.conversationTokens >= 0
        ? conversationUsage.conversationTokens
        : fallbackConversationTokens;

    // Workspace context: include the FULL workspace summary so the user sees its impact.
    const workspaceTokens = estimateTokenCount(workspaceContext);

    // If we have authoritative backend usage, use that as the total (it likely includes system prompt + context).
    // Otherwise, sum our estimates.
    const totalTokens =
      typeof conversationUsage?.conversationTokens === "number" && conversationUsage.conversationTokens >= 0
        ? conversationUsage.conversationTokens
        : conversationTokens + workspaceTokens;
    const percentUsed =
      limit > 0 ? Math.max(0, Math.min(100, (totalTokens / limit) * 100)) : 0;
    const tokensRemaining = limit > 0 ? Math.max(0, limit - totalTokens) : 0;

    return {
      provider: conversationUsage?.provider ?? "local",
      modelName: conversationUsage?.modelName ?? null,
      modelLabel: conversationUsage?.modelLabel ?? null,
      limit,
      messageCount,
      conversationTokens,
      workspaceTokens,
      totalTokens,
      percentUsed,
      tokensRemaining,
    };
  }, [contextLimit, conversationUsage, fallbackConversationTokens, session?.messages.length, workspaceContext]);

  const markdownComponents = useMemo<Components>(
    () => ({
      code: MarkdownCodeBlock,
      // Render <pre> as a fragment so our custom code renderer controls layout.
      // Use full props to avoid narrowing issues with react-markdown's types.
      pre: (props: any) => <>{props.children}</>,
      // Avoid invalid HTML like <p><div>…</div></p> when a code block
      // appears where a paragraph would normally be rendered.
      p: ({ children, ...rest }: any) => {
        const hasBlockCodeChild = Children.toArray(children).some((child) =>
          hasCodeBlockDescendant(child as ReactNode)
        );
        if (hasBlockCodeChild) {
          return <div {...rest}>{children}</div>;
        }
        return <p {...rest}>{children}</p>;
      },
      table: ({ children, node: _node, ...rest }: any) => (
        <div className={styles.chatTableWrapper}>
          <table {...rest}>{children}</table>
        </div>
      ),
    }),
    []
  );

  const lastUsageSummaryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onContextUsageChange) {
      return;
    }
    if (!sessionExists) {
      if (lastUsageSummaryRef.current !== null) {
        lastUsageSummaryRef.current = null;
        onContextUsageChange(null);
      }
      return;
    }
    const summary: ContextUsageSummary = {
      conversationId: sessionConversationId,
      messageCount: conversationContextStats.messageCount,
      conversationTokens: conversationContextStats.conversationTokens,
      workspaceTokens: conversationContextStats.workspaceTokens,
      totalTokens: conversationContextStats.totalTokens,
      tokensRemaining: conversationContextStats.tokensRemaining,
      limit: conversationContextStats.limit,
      provider: conversationContextStats.provider,
      modelName: conversationContextStats.modelName,
      modelLabel: conversationContextStats.modelLabel,
    };
    const serialized = JSON.stringify(summary);
    if (serialized === lastUsageSummaryRef.current) {
      return;
    }
    lastUsageSummaryRef.current = serialized;
    onContextUsageChange(summary);
    return () => {
      if (lastUsageSummaryRef.current === serialized) {
        lastUsageSummaryRef.current = null;
        onContextUsageChange(null);
      }
    };
  }, [
    conversationContextStats.conversationTokens,
    conversationContextStats.limit,
    conversationContextStats.messageCount,
    conversationContextStats.modelLabel,
    conversationContextStats.modelName,
    conversationContextStats.provider,
    conversationContextStats.totalTokens,
    conversationContextStats.tokensRemaining,
    conversationContextStats.workspaceTokens,
    onContextUsageChange,
    sessionConversationId,
    sessionExists,
  ]);

  if (!hasHydrated) {
    return (
      <div className={styles.chatView} aria-live="polite" style={chatViewStyle}>
        <div className={styles.chatViewport}>
          <div className={styles.chatFade} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!session && !sessionId) {
    return (
      <div className={styles.chatViewEmpty}>
        <div>
          <h2>We could not find that chat.</h2>
          <p>Select another conversation from the sidebar or start a new one.</p>
        </div>
      </div>
    );
  }


  const trimmedDraft = draft.trim();
  const composerHasContent = Boolean(trimmedDraft);
  // Allow sending again while streaming so the second press can cancel the stream.
  const isStreaming = isResponding || Boolean(activeStreamingMessageId);
  const isSendDisabled = !composerHasContent && !isStreaming;

  const shouldShowPendingStreamIndicator =
    !hideThinkingIndicator && (isResponding || sessionPendingAutoStream);

  const showFirstMessageSpinner =
    (isResponding || sessionPendingAutoStream) &&
    !messages.some((m) => m.role === "assistant");



  return (
    <div className={styles.chatView} aria-live="polite" style={chatViewStyle}>
      <div className={styles.chatHeaderControls}>
      </div>
      <div className={styles.chatViewport} ref={chatViewportRef}>

        <div className={styles.chatFade} aria-hidden="true" />
        {topAttachmentTray}
        {showIntro ? (
          <div className={styles.chatIntro}>
            {introContent}
            <div ref={scrollAnchorRef} aria-hidden="true" />
          </div>
        ) : (
          <ChatMessagesList
            messages={messages}
            activeStreamingMessageId={activeStreamingMessageId}
            latestAssistantMessageId={latestAssistantMessageId}
            regeneratingMessageId={regeneratingMessageId}
            copiedMessageId={copiedMessageId}
            markdownComponents={markdownComponents}
            getResponseDurationLabel={getResponseDurationLabel}
            handleCopyMessage={handleCopyMessage}
            handleRegenerate={handleRegenerate}
            handleRetryUserMessage={handleRetryUserMessage}
            handleDeleteMessage={handleDeleteMessage}
            handleCycleAssistantVariant={handleCycleAssistantVariant}
            handleEditMessage={handleEditMessage}
            shouldShowPendingStreamIndicator={shouldShowPendingStreamIndicator}
            showFirstMessageSpinner={showFirstMessageSpinner}
            scrollAnchorRef={scrollAnchorRef}
            reasoningSeconds={reasoningSeconds}
            isResponding={session?.isResponding}
            isActivelyThinking={isActivelyThinking}
            thinkingStartTime={thinkingStartTime}
          />
        )}
      </div>
      <div className={styles.chatComposerDock} ref={composerDockRef}>
        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className={styles.chatAttachmentInput}
          onChange={handleAttachmentInputChange}
        />
        {pendingLocationRequestMessage ? (
          <div className={styles.chatLocationRequestBanner}>
            <p>
              <strong>Gray needs your location</strong> to answer “{locationRequestSummary}”.
            </p>
            <div className={styles.chatLocationRequestButtons}>
              <button
                type="button"
                className={styles.chatLocationRequestButton}
                onClick={requestLocationShare}
                disabled={isRequestingLocation}
              >
                {isRequestingLocation ? "Sharing location…" : "Share location"}
              </button>
              <button
                type="button"
                className={styles.chatLocationRequestButton}
                data-secondary="true"
                onClick={skipLocationShare}
                disabled={isRequestingLocation}
              >
                Continue without location
              </button>
            </div>
          </div>
        ) : null}
        <GrayChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          isSubmitDisabled={isSendDisabled}
          isSubmitting={isResponding}
          onAddAttachment={openAttachmentPicker}
          attachmentTray={attachmentTrayNode}
          onPasteFiles={handleAttachmentPaste}
        />
      </div>
    </div>
  );
}
