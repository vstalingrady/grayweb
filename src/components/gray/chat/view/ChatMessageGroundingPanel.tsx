"use client";

import styles from "./ChatMessageGroundingPanel.module.css";
import type { GroundingMetadata } from "@/lib/api";
import { buildGroundingSourceCards, buildGroundingSourceFaviconUrl, buildGroundingSourceInitials } from "./groundingSources";
import { getSanitizedSearchEntryHtml } from "./searchEntrySanitizer";

const getRenderedSearchEntry = (candidate: unknown): string | null => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const snake = record["rendered_content"];
  if (typeof snake === "string") {
    return snake;
  }
  const camel = record["renderedContent"];
  if (typeof camel === "string") {
    return camel;
  }
  return null;
};

export type ChatMessageGroundingPanelProps = {
  metadata: GroundingMetadata;
  messageId: string;
  previousUserMessageLowercase: string | null;
  t: (message: string, vars?: Record<string, string | number>) => string;
};

export function ChatMessageGroundingPanel({
  metadata,
  messageId,
  previousUserMessageLowercase,
  t,
}: ChatMessageGroundingPanelProps) {
  const searchQueries =
    metadata?.web_search_queries ?? (metadata as { webSearchQueries?: string[] })?.webSearchQueries ?? [];
  const searchEntryPoint =
    metadata?.search_entry_point ??
    (metadata as { searchEntryPoint?: { rendered_content?: string; renderedContent?: string } })?.searchEntryPoint ??
    null;
  const renderedSearchEntry = getRenderedSearchEntry(searchEntryPoint);
  const sanitizedSearchEntryHtml = renderedSearchEntry ? getSanitizedSearchEntryHtml(renderedSearchEntry) : null;

  const chunks =
    metadata?.grounding_chunks ??
    (metadata as { groundingChunks?: GroundingMetadata["grounding_chunks"] })?.groundingChunks ??
    [];

  const filteredQueries =
    searchQueries.filter((query) => {
      const trimmed = query.trim();
      if (!trimmed) {
        return false;
      }
      if (previousUserMessageLowercase && trimmed.toLowerCase() === previousUserMessageLowercase) {
        return false;
      }
      return true;
    }) ?? [];

  const sourceCards = buildGroundingSourceCards(metadata, t);

  if (sourceCards.length === 0 && filteredQueries.length === 0 && !sanitizedSearchEntryHtml) {
    return null;
  }

  return (
    <div className={styles.chatGroundingPanel}>
      {sanitizedSearchEntryHtml ? (
        <div className={styles.chatGroundingSearchEntryDeck}>
          <div className={styles.chatGroundingSearchEntry} dangerouslySetInnerHTML={{ __html: sanitizedSearchEntryHtml }} />
        </div>
      ) : null}
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
                        {/* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */}
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
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      initials
                    )}
                  </div>
                  <div className={styles.chatGroundingSourceCardContent}>
                    <div className={styles.chatGroundingSourceCardTitle}>{source.title ?? t("Referenced source")}</div>
                    {source.siteLabel ? <div className={styles.chatGroundingSourceCardSite}>{source.siteLabel}</div> : null}
                  </div>
                </>
              );

              if (source.href) {
                return (
                  <a
                    key={source.id}
                    href={source.href}
                    target="_self"
                    rel="noreferrer"
                    className={styles.chatGroundingSourceCard}
                  >
                    {cardContent}
                  </a>
                );
              }

              return (
                <div key={source.id} className={styles.chatGroundingSourceCard} data-clickable="false">
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
