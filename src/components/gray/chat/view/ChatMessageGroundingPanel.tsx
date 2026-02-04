"use client";

import type { SyntheticEvent } from "react";
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
  thumbnailUrl?: string;
};

const SEARCH_ENTRY_IMAGE_ATTRS = ["src", "data-src", "data-iurl", "data-srcset", "srcset"];

const normalizeSearchEntryImageUrl = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }
  const candidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const extractFirstSrcsetUrl = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }
  const first = raw.split(",")[0]?.trim();
  if (!first) {
    return null;
  }
  return first.split(/\s+/)[0] ?? null;
};

const resolveSearchEntryImageUrl = (img: HTMLImageElement): string | null => {
  for (const attr of SEARCH_ENTRY_IMAGE_ATTRS) {
    if (attr.includes("srcset")) {
      const srcsetValue = img.getAttribute(attr);
      const candidate = extractFirstSrcsetUrl(srcsetValue);
      const normalized = normalizeSearchEntryImageUrl(candidate);
      if (normalized) {
        return normalized;
      }
      continue;
    }

    const candidate = img.getAttribute(attr);
    const normalized = normalizeSearchEntryImageUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const parseNumericAttribute = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const scoreSearchEntryImage = (img: HTMLImageElement, url: string | null): number => {
  const width = parseNumericAttribute(img.getAttribute("width"));
  const height = parseNumericAttribute(img.getAttribute("height"));
  const area = width && height ? width * height : 1;
  const smallSide = width && height ? Math.min(width, height) : null;
  if (smallSide !== null && smallSide < 24) {
    return 0;
  }
  if (url && /(favicon|logo|icon)/i.test(url)) {
    return area * 0.2;
  }
  return area;
};

const extractSearchEntryThumbnail = (anchor: HTMLAnchorElement): string | null => {
  const candidates: HTMLImageElement[] = [];
  const collect = (root: Element | null) => {
    if (!root) {
      return;
    }
    candidates.push(...Array.from(root.querySelectorAll("img")));
  };
  collect(anchor);
  collect(anchor.parentElement);
  collect(anchor.parentElement?.parentElement ?? null);

  let bestUrl: string | null = null;
  let bestScore = 0;
  const seen = new Set<string>();

  for (const img of candidates) {
    const url = resolveSearchEntryImageUrl(img);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    const score = scoreSearchEntryImage(img, url);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return bestUrl;
};

const normalizeSearchEntryHost = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().replace(/^www\./i, "");
  return normalized ? normalized.toLowerCase() : null;
};

const buildSearchEntryThumbnailIndex = (results: SearchEntryResult[]) => {
  const byHref = new Map<string, string>();
  const byHost = new Map<string, string>();

  for (const result of results) {
    if (!result.thumbnailUrl) {
      continue;
    }
    byHref.set(result.href, result.thumbnailUrl);
    const host = normalizeSearchEntryHost(result.siteLabel);
    if (host && !byHost.has(host)) {
      byHost.set(host, result.thumbnailUrl);
      continue;
    }
    if (!host) {
      try {
        const parsed = new URL(result.href);
        const resolvedHost = normalizeSearchEntryHost(parsed.hostname);
        if (resolvedHost && !byHost.has(resolvedHost)) {
          byHost.set(resolvedHost, result.thumbnailUrl);
        }
      } catch {
        // Ignore malformed URLs; href is already sanitized.
      }
    }
  }

  return { byHref, byHost };
};

const resolveThumbnailForSource = (
  source: ReturnType<typeof buildGroundingSourceCards>[number],
  thumbnailIndex: ReturnType<typeof buildSearchEntryThumbnailIndex>
): string | undefined => {
  if (source.href) {
    const directMatch = thumbnailIndex.byHref.get(source.href);
    if (directMatch) {
      return directMatch;
    }
  }
  const host = normalizeSearchEntryHost(source.siteLabel);
  if (host) {
    return thumbnailIndex.byHost.get(host);
  }
  if (source.href) {
    try {
      const parsed = new URL(source.href);
      const parsedHost = normalizeSearchEntryHost(parsed.hostname);
      if (parsedHost) {
        return thumbnailIndex.byHost.get(parsedHost);
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const handleGroundingImageError = (event: SyntheticEvent<HTMLImageElement>) => {
  const target = event.currentTarget;
  const fallback = target.dataset.fallback;
  if (fallback) {
    target.dataset.fallback = "";
    target.dataset.kind = "thumbnail";
    target.parentElement?.setAttribute("data-kind", "thumbnail");
    target.src = fallback;
    return;
  }
  target.style.display = "none";
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
      const thumbnailUrl = extractSearchEntryThumbnail(anchor);
      results.push({
        id: `search-${results.length}`,
        title,
        href: normalizedHref,
        siteLabel: siteLabel || undefined,
        thumbnailUrl: thumbnailUrl ?? undefined,
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
  const thumbnailIndex = buildSearchEntryThumbnailIndex(searchEntryResults);

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
              const thumbnailUrl = result.thumbnailUrl;
              const imageUrl = faviconUrl ?? thumbnailUrl;
              const imageKind = faviconUrl ? "favicon" : "thumbnail";
              const initials = buildGroundingSourceInitials(result.siteLabel ?? result.title);

              return (
                <a
                  key={result.id}
                  href={result.href}
                  target="_self"
                  rel="noreferrer"
                  className={styles.chatGroundingSearchResult}
                >
                  <div className={styles.chatGroundingSearchResultIcon} data-kind={imageKind}>
                    <span className={styles.chatGroundingSearchResultFallback}>{initials}</span>
                    {imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                      <img
                        src={imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={styles.chatGroundingSearchResultImage}
                        data-kind={imageKind}
                        data-fallback={faviconUrl && thumbnailUrl ? thumbnailUrl : undefined}
                        onLoad={(event) => {
                          event.currentTarget.style.opacity = "1";
                          event.currentTarget.parentElement?.setAttribute("data-image-loaded", "true");
                        }}
                        onError={handleGroundingImageError}
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
              const thumbnailUrl = resolveThumbnailForSource(source, thumbnailIndex);
              const imageUrl = faviconUrl ?? thumbnailUrl;
              const imageKind = faviconUrl ? "favicon" : "thumbnail";
              const initials = buildGroundingSourceInitials(source.siteLabel ?? source.title);

              const cardContent = (
                <>
                  <div className={styles.chatGroundingSourceCardAvatar} data-kind={imageKind}>
                    <span className={styles.chatGroundingSourceCardFallback}>{initials}</span>
                    {imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                      <img
                        src={imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={styles.chatGroundingSourceCardImage}
                        data-kind={imageKind}
                        data-fallback={faviconUrl && thumbnailUrl ? thumbnailUrl : undefined}
                        onLoad={(event) => {
                          event.currentTarget.style.opacity = "1";
                          event.currentTarget.parentElement?.setAttribute("data-image-loaded", "true");
                        }}
                        onError={handleGroundingImageError}
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
