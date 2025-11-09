"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Loader2,
  RefreshCw,
  Copy,
  Image as ImageIcon,
  FileText,
  X,
  CheckCircle2,
  Trash2,
  SignalHigh,
} from "lucide-react";
import Image from "next/image";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayChatBar } from "./ChatBar";
import {
  SYSTEM_PROMPT,
  useChatStore,
  buildAssistantReply,
  shouldIncludeWorkspaceContext,
  normalizeAssistantContent,
  deriveTitleFromMessage,
  type ChatMessage as ChatSessionMessage,
  type ChatRole,
} from "./ChatProvider";
import { useUser } from "@/contexts/UserContext";
import {
  apiService,
  type ChatAttachment,
  type ConversationUsage,
  type GeminiFileMetadata,
} from "@/lib/api";
import type { ContextUsageSummary } from "@/components/gray/types";

type GrayChatViewProps = {
  sessionId: string | null;
  introContent?: ReactNode;
  onContextUsageChange?: (summary: ContextUsageSummary | null) => void;
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const FALLBACK_ASSISTANT_DELAY_MS = 0;

type ComposerAttachmentStatus = "uploading" | "uploaded" | "error";

type ComposerAttachment = {
  id: string;
  file: File;
  status: ComposerAttachmentStatus;
  previewUrl?: string;
  uploaded?: ChatAttachment;
  error?: string;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes)) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const mapGeminiFileToAttachment = (file: GeminiFileMetadata): ChatAttachment => {
  return {
    name: file.name,
    uri: file.uri ?? file.download_uri ?? "",
    mime_type: file.mime_type ?? "application/octet-stream",
    display_name: file.display_name ?? file.name,
    size_bytes: file.size_bytes,
  };
};

const formatDisplayName = (value?: string | null): string => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutPrefix = trimmed
    .replace(/^models\//i, "")
    .replace(/^openrouter\//i, "");

  const normalized = withoutPrefix
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
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

const MarkdownCodeBlock: NonNullable<Components["code"]> = ({
  className,
  children,
  ...props
}) => {
  const [copied, setCopied] = useState(false);
  const inline = (props as any).inline;
  const raw = typeof children === "string" ? children : String(children ?? "");
  const language = getLanguageId(className?.replace("language-", "") ?? undefined);
  const { normalizedRaw, trimmedRaw, codeLines } = useMemo(() => {
    const normalized = stripUniformIndent(raw);

    return {
      normalizedRaw: normalized,
      trimmedRaw: normalized.trim(),
      codeLines: tokenizeCode(normalized, language),
    };
  }, [raw, language]);

  if (inline) {
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
      className={`${styles.codeBlock} ${isCompactBlock ? styles.codeBlockCompact : ""}`}
      data-language={language}
    >
      {isCompactBlock ? null : (
        <div className={styles.codeHeader}>
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
      )}
      <div
        className={`${styles.codeSurface} ${
          isMiniBlock ? styles.codeSurfaceMini : isCompactBlock ? styles.codeSurfaceCompact : ""
        }`}
      >
        {codeLines.map((line, lineIndex) => (
          <div
            className={`${styles.codeLine} ${
              isMiniBlock ? styles.codeLineMini : isCompactBlock ? styles.codeLineCompact : ""
            }`}
            key={`code-line-${lineIndex}`}
          >
            {!isCompactBlock && <span className={styles.codeLineNumber}>{lineIndex + 1}</span>}
            <span
              className={`${styles.codeLineContent} ${
                isMiniBlock ? styles.codeLineContentMini : ""
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
      {isCompactBlock && (
        <div className={styles.codeCompactActions}>
          <button
            className={`${styles.codeCopyButton} ${styles.codeCopyButtonInline}`}
            type="button"
            onClick={handleCopy}
            aria-label="Copy code"
            data-copied={copied ? "true" : undefined}
          >
            {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          </button>
          <span className={styles.codeLanguageInline}>{language}</span>
        </div>
      )}
    </div>
  );
};

const GrayStreamingBadge = () => (
  <div className={styles.chatStreamingInline}>
    <Image
      src="/grayaiwhite.svg"
      alt="Gray logo"
      width={18}
      height={18}
      className={styles.chatStreamingSpinner}
    />
    <span>Gray is thinking…</span>
  </div>
);

type AssistantSections = {
  user: string | null;
  thinking: string | null;
  ai: string;
  isStructured: boolean;
};

const parseStructuredAssistantMessage = (content?: string | null): AssistantSections => {
  const normalized = (content ?? "").replace(/\r\n/g, "\n");
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
    const thinkingTagCandidates = [
      { open: "<thinking>", close: "</thinking>" },
      { open: "<chainofthought>", close: "</chainofthought>" },
      { open: "<chain_of_thought>", close: "</chain_of_thought>" },
    ];
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

export function GrayChatView({ sessionId, introContent, onContextUsageChange }: GrayChatViewProps) {
  const {
    getSession,
    appendMessage,
    updateMessage,
    deleteMessage,
    updateSession,
    workspaceContext,
    renameSession,
  } = useChatStore();
  const session = sessionId ? getSession(sessionId) : undefined;
  const { user, waitForUser } = useUser();
  const [draft, setDraft] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const replyTimeout = useRef<number | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const isLoadingHistoryRef = useRef<string | null>(null);
  const attachmentsRef = useRef<ComposerAttachment[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [activeStreamingMessageId, setActiveStreamingMessageId] = useState<string | null>(null);
  const autoStreamTriggeredRef = useRef<Set<string>>(new Set());
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [conversationUsage, setConversationUsage] = useState<ConversationUsage | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const revokePreviewUrl = useCallback((url?: string) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);
  const activeSessionId = session?.id ?? null;
  const activeConversationId = session?.conversationId ?? null;
  const resolveChatUser = useCallback(async () => {
    if (user) {
      return user;
    }
    return waitForUser();
  }, [user, waitForUser]);

  const messages = useMemo(
    () => session?.messages ?? [],
    [session?.messages]
  );
  const showIntro = Boolean(introContent) && (!session || messages.length === 0);
  const clearComposerAttachments = useCallback(() => {
    setComposerAttachments((prev) => {
      if (!prev.length) {
        return prev;
      }
      prev.forEach((attachment) => revokePreviewUrl(attachment.previewUrl));
      return [];
    });
  }, [revokePreviewUrl]);
  const uploadComposerAttachment = useCallback((attachmentId: string, file: File) => {
    setComposerAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, status: "uploading", error: undefined }
          : attachment
      )
    );

    apiService
      .uploadGeminiFile(file, file.name)
      .then((uploadedFile: GeminiFileMetadata) => {
        const normalized = mapGeminiFileToAttachment(uploadedFile);
        if (!normalized.uri) {
          throw new Error("Gemini did not return a reusable file URI.");
        }
        setComposerAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === attachmentId
              ? { ...attachment, status: "uploaded", uploaded: normalized, error: undefined }
              : attachment
          )
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to upload attachment:", error);
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "File upload failed.";
        setComposerAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === attachmentId
              ? { ...attachment, status: "error", error: message }
              : attachment
          )
        );
      });
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (!files.length) {
        return;
      }

      const availableSlots = MAX_ATTACHMENTS - composerAttachments.length;
      if (availableSlots <= 0) {
        return;
      }

      const selection = files.slice(0, availableSlots);
      const limitLabel = `${Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))} MB`;

      selection.forEach((file) => {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${file.name}`;

        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          setComposerAttachments((prev) => [
            ...prev,
            {
              id,
              file,
              status: "error",
              error: `File exceeds ${limitLabel}.`,
            },
          ]);
          return;
        }

        const previewUrl = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
        setComposerAttachments((prev) => [
          ...prev,
          {
            id,
            file,
            status: "uploading",
            previewUrl,
          },
        ]);
        uploadComposerAttachment(id, file);
      });
    },
    [composerAttachments.length, uploadComposerAttachment]
  );

  const handleRemoveAttachment = useCallback(
    (attachmentId: string) => {
      setComposerAttachments((prev) => {
        const target = prev.find((attachment) => attachment.id === attachmentId);
        if (target) {
          revokePreviewUrl(target.previewUrl);
        }
        return prev.filter((attachment) => attachment.id !== attachmentId);
      });
    },
    [revokePreviewUrl]
  );

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const handleRetryAttachment = useCallback(
    (attachmentId: string) => {
      const target = composerAttachments.find((attachment) => attachment.id === attachmentId);
      if (!target) {
        return;
      }
      uploadComposerAttachment(attachmentId, target.file);
    },
    [composerAttachments, uploadComposerAttachment]
  );

  useEffect(() => {
    if (!scrollAnchorRef.current) {
      return;
    }
    scrollAnchorRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, session?.isResponding]);

  useEffect(() => {
    attachmentsRef.current = composerAttachments;
  }, [composerAttachments]);

  useEffect(() => {
    setActiveStreamingMessageId(null);
  }, [session?.id]);

  useEffect(() => {
    if (isHistoryLoading) {
      setActiveStreamingMessageId(null);
    }
  }, [isHistoryLoading]);

  useEffect(() => {
    if (!activeConversationId) {
      setConversationUsage(null);
      setIsUsageLoading(false);
      return;
    }

    let cancelled = false;
    setConversationUsage((previous) =>
      previous && previous.conversationId === activeConversationId ? previous : null
    );
    const loadUsage = async () => {
      try {
        setIsUsageLoading(true);
        const usage = await apiService.getConversationUsage(activeConversationId);
        if (!cancelled) {
          setConversationUsage(usage);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch conversation usage:", error);
          setConversationUsage(null);
        }
      } finally {
        if (!cancelled) {
          setIsUsageLoading(false);
        }
      }
    };

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, session?.messages.length, session?.isResponding]);

  
  useEffect(
    () => () => {
      attachmentsRef.current.forEach((attachment) => revokePreviewUrl(attachment.previewUrl));
    },
    [revokePreviewUrl]
  );

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
    clearComposerAttachments();
  }, [clearComposerAttachments, session?.id]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId || !activeConversationId) {
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = null;
      return;
    }

    // Avoid refetch if we already loaded this conversation for this session
    if (isLoadingHistoryRef.current === `${activeSessionId}:${activeConversationId}`) {
      return;
    }

    // If the session already has messages, assume it's hydrated.
    // This prevents overwriting existing local messages unnecessarily.
    if (session && session.messages && session.messages.length > 0) {
      return;
    }

    let cancelled = false;
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = `${activeSessionId}:${activeConversationId}`;

    (async () => {
      try {
        const history = await apiService.getConversation(activeConversationId);
        if (cancelled) {
          return;
        }

        if (!Array.isArray(history) || history.length === 0) {
          // No backend history; keep session empty but valid so user can start chatting.
          updateSession(activeSessionId, {
            messages: [],
            updatedAt: Date.now(),
            isResponding: false,
          });
          return;
        }

        const mappedHistory: ChatSessionMessage[] = history.map((message, index) => {
          const role: ChatRole = message.role === "model" ? "assistant" : "user";
          return {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${activeConversationId}-${index}-${Date.now()}`,
            role,
            content: message.text,
            createdAt: Date.now(),
            attachments: Array.isArray(message.attachments) ? message.attachments : undefined,
          };
        });

        updateSession(activeSessionId, {
          messages: mappedHistory,
          updatedAt: Date.now(),
          isResponding: false,
        });

        const firstUserMessage = mappedHistory.find(
          (entry) => entry.role === "user" && entry.content.trim().length > 0
        );
        const currentTitle = (session?.title ?? "").trim();
        const shouldAutoRename =
          session?.scope === "thread" && (!currentTitle || currentTitle.toLowerCase() === "new chat");

        if (shouldAutoRename && firstUserMessage) {
          const derivedTitle = deriveTitleFromMessage(firstUserMessage.content);
          if (derivedTitle && derivedTitle !== currentTitle) {
            renameSession(activeSessionId, derivedTitle);
          }
        }
      } catch (error) {
        console.error("Failed to load conversation history:", error);
        // On error, still ensure the session exists so UI isn't blank.
        updateSession(activeSessionId, {
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
  }, [
    activeConversationId,
    activeSessionId,
    renameSession,
    session?.messages,
    session?.scope,
    session?.title,
    updateSession,
  ]);

  const streamAssistantReply = useCallback(
    async (
      targetSessionId: string,
      prompt: string,
      conversationId: string | null,
      attachments?: ChatAttachment[],
      existingAssistantId?: string | null
    ) => {
      updateSession(targetSessionId, { isResponding: true, pendingAutoStream: false });
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
      let accumulated = "";
      let streamedConversationId: string | null = conversationId;
      let didReceiveToken = false;
      const streamingUserId = resolvedUser.id;
      if (streamingMessageId) {
        setActiveStreamingMessageId(streamingMessageId);
      }
      try {
        for await (const event of apiService.sendMessageStream({
          message: prompt,
          conversation_id: conversationId ?? undefined,
          system_prompt: SYSTEM_PROMPT,
          user_id: streamingUserId,
          context: contextPayload,
          attachments: attachments && attachments.length ? attachments : undefined,
        })) {
          if (event.type === "token") {
            didReceiveToken = true;
            accumulated += event.delta;
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

          if (event.type === "end") {
            streamedConversationId = event.conversationId ?? streamedConversationId;
            const finalResponse = normalizeAssistantContent(event.response ?? accumulated, prompt);
            accumulated = finalResponse;
            if (!assistantMessageId) {
              const assistantMessage = appendMessage(targetSessionId, "assistant", finalResponse);
              assistantMessageId = (assistantMessage as { id: string } | null)?.id ?? null;
              streamingMessageId = assistantMessageId;
              if (streamingMessageId) {
                setActiveStreamingMessageId(streamingMessageId);
              }
            } else if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, { content: finalResponse });
            }
            updateSession(targetSessionId, {
              conversationId: streamedConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
            });
            return finalResponse;
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
          if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
            streamingMessageId = assistantMessageId;
            setActiveStreamingMessageId(assistantMessageId);
          }
        }
        updateSession(targetSessionId, {
          conversationId: streamedConversationId ?? undefined,
          isResponding: false,
          pendingAutoStream: false,
        });
        return accumulated;
      } catch (error) {
        console.error("Failed to stream assistant reply:", error);
        try {
          const fallbackResponse = await apiService.sendMessage({
            message: prompt,
            conversation_id: conversationId ?? undefined,
            system_prompt: SYSTEM_PROMPT,
            user_id: streamingUserId,
            context: contextPayload,
            attachments: attachments && attachments.length ? attachments : undefined,
          });
          streamedConversationId = fallbackResponse.conversation_id ?? streamedConversationId;
          const finalResponse = normalizeAssistantContent(fallbackResponse.response, prompt);
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, { content: finalResponse });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", finalResponse);
            assistantMessageId = assistantMessage?.id ?? null;
            if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
              streamingMessageId = assistantMessageId;
              setActiveStreamingMessageId(assistantMessageId);
            }
          }
          updateSession(targetSessionId, {
            conversationId: streamedConversationId ?? undefined,
            isResponding: false,
            pendingAutoStream: false,
          });
          return finalResponse;
        } catch (fallbackError) {
          console.error("Fallback chat request failed:", fallbackError);
          const fallback = buildAssistantReply(prompt);
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, { content: fallback });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", fallback);
            assistantMessageId = assistantMessage?.id ?? null;
            if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
              streamingMessageId = assistantMessageId;
              setActiveStreamingMessageId(assistantMessageId);
            }
          }
          updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false });
          return fallback;
        }
      } finally {
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
      shouldIncludeWorkspaceContext,
      updateMessage,
      updateSession,
      workspaceContext,
    ]
  );

  useEffect(() => {
    if (!session) {
      autoStreamTriggeredRef.current.clear();
      return;
    }

    // If this session was created as a shell for a /c/{conversationId} URL and has
    // no local messages yet, skip auto-streaming. History hydration (below) will
    // populate messages if the backend knows this conversation.
    if (session.conversationId && session.messages.length === 0) {
      return;
    }

    // Only ever auto-respond to genuine user messages, never to assistant output.
    const hasPendingAutoStream = Boolean(session.pendingAutoStream);
    const lastUserMessage =
      [...messages].reverse().find((message) => message.role === "user") ?? null;
    const lastAssistantMessage =
      [...messages].reverse().find((message) => message.role === "assistant") ?? null;

    // Some flows (e.g., createThreadSession) seed an empty assistant message before
    // the actual stream starts. If navigation interrupts that stream we end up with
    // a blank assistant entry, so treat it as “awaiting” unless it has real content.
    const assistantHasContent =
      Boolean(lastAssistantMessage?.content?.trim()) ||
      Boolean(lastAssistantMessage?.attachments && lastAssistantMessage.attachments.length > 0);

    const isAwaitingAssistant =
      Boolean(lastUserMessage) &&
      (!lastAssistantMessage ||
        lastAssistantMessage.createdAt < (lastUserMessage?.createdAt ?? 0) ||
        !assistantHasContent);

    const hasAlreadyTriggeredForLastUser =
      lastUserMessage != null &&
      autoStreamTriggeredRef.current.has(`${session.id}:${lastUserMessage.id}`);

    // Do not rely on session.isResponding here—some surfaces (like createThreadSession)
    // mark sessions as responding while their own stream is active, and we do not want
    // to launch a duplicate assistant request in those cases.
    const shouldRespond =
      !hasAlreadyTriggeredForLastUser &&
      (hasPendingAutoStream || isAwaitingAssistant);

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
    autoStreamTriggeredRef.current.add(`${session.id}:${safeLastUserMessage.id}`);

    const attachments = lastUserMessage.attachments ?? [];

    if (hasPendingAutoStream) {
      updateSession(session.id, { pendingAutoStream: false });
    }

    const placeholderAssistantId =
      !assistantHasContent && lastAssistantMessage ? lastAssistantMessage.id : null;

    void streamAssistantReply(
      session.id,
      lastUserMessage.content,
      session.conversationId ?? null,
      attachments.length ? attachments : undefined,
      placeholderAssistantId
    );
  }, [appendMessage, messages, session, streamAssistantReply, updateSession]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) {
      return;
    }
    const content = draft.trim();
    const readyAttachments = composerAttachments.filter(
      (attachment) => attachment.status === "uploaded" && attachment.uploaded
    );
    const attachmentPayload = readyAttachments.map((attachment) => attachment.uploaded!) as ChatAttachment[];
    const hasMessageBody = Boolean(content) || attachmentPayload.length > 0;
    const hasPendingAttachments = composerAttachments.some(
      (attachment) => attachment.status !== "uploaded"
    );

    if (!hasMessageBody || hasPendingAttachments) {
      return;
    }

    const userMessage = appendMessage(
      session.id,
      "user",
      content,
      attachmentPayload.length ? attachmentPayload : undefined
    );
    setDraft("");
    clearComposerAttachments();
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
    }

    if (userMessage) {
      autoStreamTriggeredRef.current.add(`${session.id}:${userMessage.id}`);
      void streamAssistantReply(
        session.id,
        content,
        session.conversationId ?? null,
        attachmentPayload.length ? attachmentPayload : undefined
      );
      return;
    }

    appendMessage(session.id, "assistant", buildAssistantReply(content));
    replyTimeout.current = null;
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
          const diffSeconds = diffMs / 1000;
          if (diffSeconds < 0.1) {
            return "<0.1s";
          }
          if (diffSeconds >= 10) {
            return `${Math.round(diffSeconds)}s`;
          }
          return `${diffSeconds.toFixed(1)}s`;
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
      if (activeStreamingMessageId === messageId) {
        setActiveStreamingMessageId(null);
      }
      if (copiedMessageId === messageId) {
        setCopiedMessageId(null);
      }
      deleteMessage(session.id, messageId);
    },
    [activeStreamingMessageId, copiedMessageId, deleteMessage, session]
  );

  const handleRetryUserMessage = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }
      const target = messages.find((message) => message.id === messageId);
      if (!target || target.role !== "user") {
        return;
      }
      const content = target.content;
      const attachments = target.attachments ?? [];

      const retriedUser = appendMessage(
        session.id,
        "user",
        content,
        attachments.length ? attachments : undefined
      );

      if (replyTimeout.current !== null) {
        window.clearTimeout(replyTimeout.current);
        replyTimeout.current = null;
      }

      if (retriedUser) {
        autoStreamTriggeredRef.current.add(`${session.id}:${retriedUser.id}`);
        void streamAssistantReply(
          session.id,
          content,
          session.conversationId ?? null,
          attachments.length ? attachments : undefined
        );
        return;
      }

      appendMessage(session.id, "assistant", buildAssistantReply(content));
    },
    [appendMessage, messages, session, streamAssistantReply]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!session) {
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

      if (assistantMessage.id !== latestAssistantMessageId) {
        console.warn("Regeneration is only supported for the latest assistant response.");
        return;
      }

      let userIndex = assistantIndex - 1;
      while (userIndex >= 0 && messages[userIndex].role !== "user") {
        userIndex -= 1;
      }
      if (userIndex < 0) {
        console.warn("Unable to locate the originating user message for regeneration.");
        return;
      }

      const userMessage = messages[userIndex];
      const attachments = userMessage.attachments ?? [];
      const preservedMessages = messages.slice(0, userIndex);

      setRegeneratingMessageId(assistantMessage.id);
      if (activeStreamingMessageId === assistantMessage.id) {
        setActiveStreamingMessageId(null);
      }
      updateSession(session.id, {
        messages: preservedMessages,
        isResponding: true,
        pendingAutoStream: false,
      });

      const retriedUser = appendMessage(
        session.id,
        "user",
        userMessage.content,
        attachments.length ? attachments : undefined
      );

      if (!retriedUser) {
        appendMessage(session.id, "assistant", buildAssistantReply(userMessage.content));
        setRegeneratingMessageId(null);
        return;
      }

      autoStreamTriggeredRef.current.add(`${session.id}:${retriedUser.id}`);

      void (async () => {
        try {
          await streamAssistantReply(
            session.id,
            userMessage.content,
            session.conversationId ?? null,
            attachments.length ? attachments : undefined
          );
        } finally {
          setRegeneratingMessageId(null);
        }
      })();
    },
    [
      appendMessage,
      activeStreamingMessageId,
      latestAssistantMessageId,
      messages,
      session,
      updateSession,
      streamAssistantReply,
      buildAssistantReply,
    ]
  );

  const contextLimit = conversationUsage?.limit ?? 0;
  const fallbackConversationTokens = useMemo(() => {
    if (!session) {
      return 0;
    }
    return session.messages.reduce((total, message) => {
      const contentTokens = estimateTokenCount(message.content);
      const attachmentTokens =
        Array.isArray(message.attachments) && message.attachments.length > 0
          ? message.attachments.length * 120
          : 0;
      return total + contentTokens + attachmentTokens;
    }, 0);
  }, [session]);

  const conversationContextStats = useMemo(() => {
    const limit = contextLimit;
    const messageCount =
      conversationUsage?.messageCount ?? session?.messages.length ?? 0;
    const conversationTokens =
      conversationUsage?.conversationTokens ?? fallbackConversationTokens;
    const workspaceTokens = workspaceContext ? estimateTokenCount(workspaceContext) : 0;
    const totalTokens = conversationTokens + workspaceTokens;
    const percentUsed =
      limit > 0 ? Math.max(0, Math.min(100, (totalTokens / limit) * 100)) : 0;
    const tokensRemaining = limit > 0 ? Math.max(0, limit - totalTokens) : 0;

    return {
      provider: conversationUsage?.provider ?? "gemini",
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
  }, [
    contextLimit,
    conversationUsage?.conversationTokens,
    conversationUsage?.limit,
    conversationUsage?.messageCount,
    conversationUsage?.modelLabel,
    conversationUsage?.modelName,
    conversationUsage?.provider,
    fallbackConversationTokens,
    session?.messages.length,
    workspaceContext,
  ]);

  const markdownComponents = useMemo<Components>(
    () => ({
      code: MarkdownCodeBlock,
      // Render <pre> as a fragment so our custom code renderer controls layout.
      // Use full props to avoid narrowing issues with react-markdown's types.
      pre: (props) => <>{props.children}</>,
    }),
    []
  );

  useEffect(() => {
    if (!onContextUsageChange) {
      return;
    }
    if (!session) {
      onContextUsageChange(null);
      return;
    }
    const summary: ContextUsageSummary = {
      conversationId: session.conversationId ?? null,
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
    onContextUsageChange(summary);
    return () => {
      onContextUsageChange(null);
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
    session,
  ]);

  if (!hasHydrated) {
    return (
      <div className={styles.chatView} aria-live="polite">
        <div className={styles.chatViewport}>
          <div className={styles.chatFade} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.chatViewEmpty}>
        <div>
          <h2>We could not find that chat.</h2>
          <p>Select another conversation from the sidebar or start a new one.</p>
        </div>
      </div>
    );
  }

  const isResponding = session.isResponding;
  const trimmedDraft = draft.trim();
  const hasUploadedAttachments = composerAttachments.some((attachment) => attachment.status === "uploaded");
  const hasPendingAttachments = composerAttachments.some((attachment) => attachment.status !== "uploaded");
  const composerHasContent = Boolean(trimmedDraft) || hasUploadedAttachments;
  const isSendDisabled = isResponding || !composerHasContent || hasPendingAttachments;
  const hasActiveStream = Boolean(activeStreamingMessageId);
  const shouldShowPendingStreamIndicator = isResponding && !hasActiveStream;

  return (
    <div className={styles.chatView} aria-live="polite">
      <div className={styles.chatViewport}>
        <div className={styles.chatFade} aria-hidden="true" />
        {showIntro ? (
          <div className={styles.chatIntro}>
            {introContent}
            <div ref={scrollAnchorRef} aria-hidden="true" />
          </div>
        ) : (
          <div className={styles.chatMessages}>
            {messages.map((message, messageIndex) => {
            const isUser = message.role === "user";
            const isAssistant = !isUser;
            const quickReplies: string[] = [];
            const rawContent = message.content ?? "";
            const assistantSections = isAssistant ? parseStructuredAssistantMessage(rawContent) : null;
            const thinkingText = isAssistant ? assistantSections?.thinking ?? null : null;
            const aiText = isAssistant ? assistantSections?.ai ?? rawContent : rawContent;
            const fullText = isAssistant ? aiText : rawContent;
            const animatedText = isAssistant ? aiText : rawContent;
            const hasThinkingContent = Boolean(thinkingText && thinkingText.trim().length > 0);
            const isStreamingMessage = isAssistant && message.id === activeStreamingMessageId;
            const hasTextContent = Boolean(animatedText.trim());
            const messageAttachments = message.attachments ?? [];
            const hasMessageAttachments = messageAttachments.length > 0;
            const hasVisibleContent = hasThinkingContent || hasTextContent || hasMessageAttachments;
            const isAwaitingStreamContent = isAssistant && isStreamingMessage && !hasVisibleContent;
            const showStreamingIndicator = isAwaitingStreamContent;
            const shouldHideEmptyAssistantMessage =
              isAssistant && !hasVisibleContent && !isAwaitingStreamContent;

            if (shouldHideEmptyAssistantMessage) {
              return null;
            }

            const responseDurationLabel = isAssistant
              ? getResponseDurationLabel(messageIndex)
              : null;
            const tokenCount = isAssistant ? estimateTokenCount(rawContent) : null;
            const hasTokenEstimate =
              typeof tokenCount === "number" && Number.isFinite(tokenCount) && tokenCount > 0;
            const hasDuration = Boolean(responseDurationLabel);
            const isMetadataAvailable = isAssistant && (hasTokenEstimate || hasDuration);
            const metadataTokenLabel = hasTokenEstimate ? `${tokenCount.toLocaleString()} tokens` : "—";
            const metadataDurationLabel = responseDurationLabel ?? "—";
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
              >
                <div className={messageBodyClassName}>
                  {showStreamingIndicator ? <GrayStreamingBadge /> : null}
                  {isAssistant && hasThinkingContent && (
                    <div className={styles.chatThinkingBlock}>
                      <div className={styles.chatThinkingLabel}>Chain of Thought</div>
                      <div className={styles.chatThinkingBody}>
                        <ReactMarkdown
                          components={markdownComponents}
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {thinkingText ?? ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {hasTextContent && (
                    <div className={styles.chatMarkdown}>
                      <ReactMarkdown
                        components={markdownComponents}
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[[rehypeKatex, { strict: false }]]}
                      >
                        {animatedText}
                      </ReactMarkdown>
                    </div>
                  )}
                  {hasMessageAttachments && (
                    <div className={styles.chatMessageAttachments}>
                      {messageAttachments.map((attachment) => {
                        const isImage = attachment.mime_type?.startsWith("image/");
                        const sizeLabel = formatFileSize(attachment.size_bytes);
                        return (
                          <div
                            key={`${message.id}-${attachment.name}`}
                            className={styles.chatMessageAttachment}
                          >
                            <div className={styles.chatMessageAttachmentIcon}>
                              {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                            </div>
                            <div className={styles.chatMessageAttachmentMeta}>
                              <span>{attachment.display_name ?? attachment.name}</span>
                              <div>
                                {sizeLabel && <span>{sizeLabel}</span>}
                                <span className={styles.chatMessageAttachmentHint}>
                                  Stored in Gemini
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {!showStreamingIndicator && (
                  <div className={styles.chatMessageFooter}>
                    <div className={styles.chatActionIconRow}>
                      {isMetadataAvailable ? (
                        <div className={styles.chatMetadataControl}>
                          <button
                            type="button"
                            aria-label="Response details"
                            tabIndex={0}
                          >
                            <SignalHigh size={15} />
                          </button>
                          <div
                            className={styles.chatMetadataPopover}
                            role="tooltip"
                            aria-hidden="true"
                          >
                            <div>
                              <span>Tokens</span>
                              <strong>{metadataTokenLabel}</strong>
                            </div>
                            <div>
                              <span>Duration</span>
                              <strong>{metadataDurationLabel}</strong>
                            </div>
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
                      <button
                        type="button"
                        aria-label="Retry message"
                        onClick={() =>
                          isAssistant ? handleRegenerate(message.id) : handleRetryUserMessage(message.id)
                        }
                        disabled={
                          isAssistant
                            ? !isLatestAssistantMessage || isRegenerating
                            : !rawContent.trim() && !(message.attachments?.length)
                        }
                      >
                        {isAssistant && isRegenerating ? <Loader2 size={15} /> : <RefreshCw size={15} />}
                      </button>
                      <button
                        type="button"
                        aria-label="Delete message"
                        onClick={() => handleDeleteMessage(message.id)}
                        data-variant="danger"
                      >
                        <Trash2 size={15} />
                      </button>
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
                )}
              </div>
            );
          })}
            {shouldShowPendingStreamIndicator ? (
              <div className={styles.chatMessage} data-role="assistant" data-streaming="true">
                <div className={styles.chatAssistantBlock}>
                  <GrayStreamingBadge />
                </div>
              </div>
            ) : null}
            <div ref={scrollAnchorRef} />
          </div>
        )}
      </div>

      <div className={styles.chatComposerDock}>
        {composerAttachments.length > 0 && (
          <div className={styles.chatAttachmentList}>
            {composerAttachments.map((attachment) => {
              const isImage = attachment.file.type.startsWith("image/");
              const sizeLabel = formatFileSize(attachment.file.size);
              return (
                <div
                  key={attachment.id}
                  className={styles.chatAttachmentItem}
                  data-status={attachment.status}
                >
                  <div className={styles.chatAttachmentPreview}>
                    {isImage && attachment.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachment.previewUrl} alt={attachment.file.name} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </div>
                  <div className={styles.chatAttachmentMeta}>
                    <span className={styles.chatAttachmentName}>{attachment.file.name}</span>
                    <span className={styles.chatAttachmentDetails}>
                      {sizeLabel}
                      {sizeLabel && attachment.status !== "uploaded" ? " • " : ""}
                      {attachment.status === "uploading" && "Uploading"}
                      {attachment.status === "uploaded" && "Ready"}
                      {attachment.status === "error" && "Failed"}
                    </span>
                    {attachment.error && (
                      <span className={styles.chatAttachmentError}>{attachment.error}</span>
                    )}
                  </div>
                  <div className={styles.chatAttachmentActions}>
                    {attachment.status === "uploading" && (
                      <Loader2 size={16} className={styles.chatAttachmentSpinner} />
                    )}
                    {attachment.status === "uploaded" && <CheckCircle2 size={16} />}
                    {attachment.status === "error" && (
                      <button
                        type="button"
                        className={styles.chatAttachmentRetry}
                        onClick={() => handleRetryAttachment(attachment.id)}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.chatAttachmentRemove}
                      aria-label="Remove attachment"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className={styles.generalChatComposer}>
          <div className={`${styles.chatBarRow} ${styles.generalChatBarRow}`}>
            <GrayChatBar
              value={draft}
              onChange={setDraft}
              onSubmit={handleSubmit}
              onSelectFiles={handleFilesSelected}
              isSubmitDisabled={isSendDisabled}
              isSubmitting={isResponding}
              fileAccept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,.md,.json"
            />
            <div className={styles.chatBarUnderline} aria-hidden="true" />
          </div>
          <p className={styles.chatDisclaimer}>Gray can make mistakes. Check important info.</p>
        </div>
      </div>
    </div>
  );
}
