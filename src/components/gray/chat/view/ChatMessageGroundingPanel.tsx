"use client";

import styles from "./ChatMessageGroundingPanel.module.css";
import type { GroundingMetadata } from "@/lib/api";
import {
  buildGroundingSourceCards,
  buildGroundingSourceFaviconUrl,
  buildGroundingSourceInitials,
} from "./groundingSources";
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

type SearchEntryResult = {
  id: string;
  title: string;
  href: string;
  siteLabel?: string;
};

const extractSearchEntryResults = (rawHtml: string): SearchEntryResult[] => {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof DOMParser === "undefined") {
    return [];
  }
  try {
    const parsed = new DOMParser().parseFromString(rawHtml, "text/html");
    const anchors = Array.from(parsed.querySelectorAll("a[href]"));
    const results: SearchEntryResult[] = [];
    const seen = new Set<string>();

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");
      if (!href) {
        continue;
      }
      let url: URL | null = null;
      try {
        url = new URL(href);
      } catch {
        url = null;
      }
      if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
        continue;
      }
      const title = (anchor.textContent ?? "").trim();
      if (!title) {
        continue;
      }
      const normalizedHref = url.toString();
      if (seen.has(normalizedHref)) {
        continue;
      }
      seen.add(normalizedHref);
      const siteLabel = url.hostname.replace(/^www\./i, "");
      results.push({
        id: `search-${results.length}`,
        title,
        href: normalizedHref,
        siteLabel: siteLabel || undefined,
      });
      if (results.length >= 6) {
        break;
      }
    }

    return results;
  } catch {
    return [];
  }
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
  const searchEntryResults = renderedSearchEntry ? extractSearchEntryResults(renderedSearchEntry) : [];

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

  if (
    sourceCards.length === 0 &&
    filteredQueries.length === 0 &&
    !sanitizedSearchEntryHtml &&
    searchEntryResults.length === 0
  ) {
    return null;
  }

  return (
    <div className={styles.chatGroundingPanel}>
      {searchEntryResults.length > 0 ? (
        <div className={styles.chatGroundingSearchEntryDeck}>
          <div className={styles.chatGroundingSearchResults}>
            {searchEntryResults.map((result) => {
              const faviconUrl = buildGroundingSourceFaviconUrl({
                id: result.id,
                title: result.title,
                isReferenced: false,
                href: result.href,
                siteLabel: result.siteLabel,
              });
              const initials = buildGroundingSourceInitials(result.siteLabel ?? result.title);

              return (
                <a
                  key={result.id}
                  href={result.href}
                  target="_self"
                  rel="noreferrer"
                  className={styles.chatGroundingSearchResult}
                >
                  <div className={styles.chatGroundingSearchResultIcon}>
                    <span className={styles.chatGroundingSearchResultFallback}>{initials}</span>
                    {faviconUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                      <img
                        src={faviconUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={styles.chatGroundingSearchResultFavicon}
                        onLoad={(event) => {
                          event.currentTarget.style.opacity = "1";
                          event.currentTarget.parentElement?.setAttribute("data-image-loaded", "true");
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className={styles.chatGroundingSearchResultContent}>
                    <div className={styles.chatGroundingSearchResultTitle}>{result.title}</div>
                    {result.siteLabel ? (
                      <div className={styles.chatGroundingSearchResultSite}>{result.siteLabel}</div>
                    ) : null}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ) : sanitizedSearchEntryHtml ? (
        <div className={styles.chatGroundingSearchEntryDeck}>
          <div
            className={styles.chatGroundingSearchEntry}
            dangerouslySetInnerHTML={{ __html: sanitizedSearchEntryHtml }}
          />
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
              const faviconUrl = buildGroundingSourceFaviconUrl(source);
              const initials = buildGroundingSourceInitials(source.siteLabel ?? source.title);

              const cardContent = (
                <>
                  <div className={styles.chatGroundingSourceCardAvatar}>
                    <span className={styles.chatGroundingSourceCardFallback}>{initials}</span>
                    {faviconUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                      <img
                        src={faviconUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={styles.chatGroundingSourceCardFavicon}
                        onLoad={(event) => {
                          event.currentTarget.style.opacity = "1";
                          event.currentTarget.parentElement?.setAttribute("data-image-loaded", "true");
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
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
