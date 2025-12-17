"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { MARKDOWN_PLUGINS } from "./plugins";
import { normalizeAssistantMath } from "./mathNormalization";
import {
  CODE_LIKE_PATTERN,
  LATEX_MATH_BLOCK_PATTERN,
  SINGLE_TOKEN_CODE_PATTERN,
  getLanguageId,
  stripUniformIndent,
  tokenizeCode,
} from "./codeHighlighting";

// Type definition for code component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeComponent = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MarkdownCodeBlock: CodeComponent = ({ inline, className, children, ...props }: any) => {
  const isInline = Boolean(inline);
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
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
  // Relaxed threshold: Single lines up to 80 chars are compact.
  // This covers most standard shell commands like "git commit -m '...'"
  const isCompactBlock = codeLines.length === 1 && totalLength <= 80;
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
          aria-label={t("Copy code")}
          data-copied={copied ? "true" : undefined}
        >
          {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
        </button>
      </div>
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
            <span className={`${styles.codeLineContent} ${isMiniBlock ? styles.codeLineContentMini : ""}`}>
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
