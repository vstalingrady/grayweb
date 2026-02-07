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

const extractImgSrcCandidate = (img: HTMLImageElement): string | null => {
  const direct = img.getAttribute("src") ?? img.getAttribute("data-src") ?? img.getAttribute("data-iurl");
  if (direct) {
    return normalizeSearchEntryImageUrl(direct);
  }
  const rawSrcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset");
  if (!rawSrcset) {
    return null;
  }
  const firstCandidate = rawSrcset.split(",")[0]?.trim().split(/\s+/)[0] ?? null;
  return normalizeSearchEntryImageUrl(firstCandidate);
};

const extractSearchEntryThumbnail = (anchor: HTMLAnchorElement): string | null => {
  const containers = [anchor, anchor.parentElement, anchor.parentElement?.parentElement];
  for (const container of containers) {
    if (!container) {
      continue;
    }
    const images = Array.from(container.querySelectorAll("img"));
    for (const img of images) {
      const candidate = extractImgSrcCandidate(img);
      if (candidate) {
        return candidate;
      }
    }
  }
  return null;
};

const normalizeSearchEntryHost = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().replace(/^www\./i, "");
  return normalized ? normalized.toLowerCase() : null;
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

const extractYouTubeVideoId = (url: URL): string | null => {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }
  if (YOUTUBE_HOSTS.has(host)) {
    const v = url.searchParams.get("v");
    if (v) {
      return v;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const embedIndex = parts.findIndex((segment) => segment === "embed" || segment === "shorts");
    if (embedIndex !== -1 && parts[embedIndex + 1]) {
      return parts[embedIndex + 1];
    }
  }
  return null;
};

const dedupeNonEmptyUrls = (values: Array<string | undefined>): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }
    unique.add(value.trim());
  }
  return Array.from(unique);
};

const buildWebsiteThumbnailCandidatesFromHref = (href?: string): string[] => {
  if (!href) {
    return [];
  }
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }
    const videoId = extractYouTubeVideoId(parsed);
    if (videoId) {
      return [`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`];
    }
    const absoluteUrl = parsed.toString();
    // Use two providers so cards still get thumbnails when one provider is down/rate-limited.
    return [
      `https://s.wordpress.com/mshots/v1/${encodeURIComponent(absoluteUrl)}?w=600`,
      `https://image.thum.io/get/width/1200/crop/675/noanimate/${absoluteUrl}`,
    ];
  } catch {
    return [];
  }
};

const resolveThumbnailWithFallbacks = (preferred: string | undefined, href?: string) => {
  const candidates = dedupeNonEmptyUrls([preferred, ...buildWebsiteThumbnailCandidatesFromHref(href)]);
  return {
    primary: candidates[0],
    fallbacks: candidates.slice(1),
  };
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
  const fallbackQueue = String(target.dataset.fallbackQueue ?? "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
  const nextFallback = fallbackQueue.shift();
  if (nextFallback) {
    target.dataset.fallbackQueue = fallbackQueue.join("|");
    target.src = nextFallback;
    return;
  }
  target.parentElement?.removeAttribute("data-image-loaded");
  target.style.display = "none";
};

const handleGroundingFaviconError = (event: SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.style.display = "none";
};

const extractSearchEntryResults = (rawHtml: string): SearchEntryResult[] => {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof DOMParser === "undefined") {
    return [];
  }
  try {
    const parsed = new DOMParser().parseFromString(rawHtml, "text/html");
    const anchors = Array.from(parsed.querySelectorAll<HTMLAnchorElement>("a[href]"));
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
  t: (message: string, vars?: Record<string, string | number>) => string;
};

const handleGroundingImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.style.opacity = "1";
  event.currentTarget.parentElement?.setAttribute("data-image-loaded", "true");
};

export function ChatMessageGroundingPanel({ metadata, t }: ChatMessageGroundingPanelProps) {
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

  const searchedQueries = Array.from(
    new Set(
      (searchQueries ?? [])
        .map((query) => (typeof query === "string" ? query.trim() : ""))
        .filter((query) => query.length > 0)
    )
  );

  const sourceCards = buildGroundingSourceCards(metadata, t);
  const inlineSourceIcons = sourceCards
    .slice(0, 10)
    .map((source) => ({
      ...source,
      faviconUrl: buildGroundingSourceFaviconUrl(source),
      initials: buildGroundingSourceInitials(source.siteLabel ?? source.title),
    }));

  if (
    sourceCards.length === 0 &&
    searchedQueries.length === 0 &&
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
              const thumbnailResolution = resolveThumbnailWithFallbacks(result.thumbnailUrl, result.href);
              const previewImageUrl = thumbnailResolution.primary;
              const previewFallbackQueue = thumbnailResolution.fallbacks.join("|");
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
                    {previewImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                      <img
                        src={previewImageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={styles.chatGroundingSearchResultImage}
                        data-fallback-queue={previewFallbackQueue || undefined}
                        onLoad={handleGroundingImageLoad}
                        onError={handleGroundingImageError}
                      />
                    ) : null}
                  </div>
                  <div className={styles.chatGroundingSearchResultMeta}>
                    <div className={styles.chatGroundingSearchResultFavicon}>
                      <span className={styles.chatGroundingSearchResultFaviconFallback}>{initials}</span>
                      {faviconUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                        <img
                          src={faviconUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className={styles.chatGroundingSearchResultFaviconImage}
                          onLoad={handleGroundingImageLoad}
                          onError={handleGroundingFaviconError}
                        />
                      ) : null}
                    </div>
                    <div className={styles.chatGroundingSearchResultContent}>
                      <div className={styles.chatGroundingSearchResultTitle}>{result.title}</div>
                      {result.siteLabel ? (
                        <div className={styles.chatGroundingSearchResultSite}>{result.siteLabel}</div>
                      ) : null}
                    </div>
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
      {searchedQueries.length > 0 ? (
        <div className={styles.chatGroundingQueries}>
          {searchedQueries.map((query) => (
            <div key={query} className={styles.chatGroundingQueryChip}>
              <span className={styles.chatGroundingQueryChipLabel}>{t("Searched")}</span>
              <span className={styles.chatGroundingQueryChipText}>{query}</span>
            </div>
          ))}
        </div>
      ) : null}
      {inlineSourceIcons.length > 0 ? (
        <div className={styles.chatGroundingInlineSourceRow}>
          {inlineSourceIcons.map((source) => {
            const iconContent = (
              <span className={styles.chatGroundingInlineSourceIcon}>
                <span className={styles.chatGroundingInlineSourceIconFallback}>{source.initials}</span>
                {source.faviconUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                  <img
                    src={source.faviconUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className={styles.chatGroundingInlineSourceIconImage}
                    onLoad={handleGroundingImageLoad}
                    onError={handleGroundingFaviconError}
                  />
                ) : null}
              </span>
            );

            if (source.href) {
              return (
                <a key={`inline-${source.id}`} href={source.href} target="_self" rel="noreferrer" aria-label={source.title}>
                  {iconContent}
                </a>
              );
            }

            return <span key={`inline-${source.id}`}>{iconContent}</span>;
          })}
        </div>
      ) : null}
      {sourceCards.length > 0 ? (
        <div className={styles.chatGroundingSourceDeck}>
          <div className={styles.chatGroundingSourceCards}>
            {sourceCards.map((source) => {
              const faviconUrl = buildGroundingSourceFaviconUrl(source);
              const extractedThumbnailUrl = resolveThumbnailForSource(source, thumbnailIndex);
              const thumbnailResolution = resolveThumbnailWithFallbacks(extractedThumbnailUrl, source.href);
              const previewImageUrl = thumbnailResolution.primary;
              const previewFallbackQueue = thumbnailResolution.fallbacks.join("|");
              const initials = buildGroundingSourceInitials(source.siteLabel ?? source.title);

              const cardContent = (
                <>
                  <div className={styles.chatGroundingSourceCardAvatar}>
                    <span className={styles.chatGroundingSourceCardFallback}>{initials}</span>
                    {previewImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                      <img
                        src={previewImageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={styles.chatGroundingSourceCardImage}
                        data-fallback-queue={previewFallbackQueue || undefined}
                        onLoad={handleGroundingImageLoad}
                        onError={handleGroundingImageError}
                      />
                    ) : null}
                  </div>
                  <div className={styles.chatGroundingSourceCardMeta}>
                    <div className={styles.chatGroundingSourceCardFavicon}>
                      <span className={styles.chatGroundingSourceCardFaviconFallback}>{initials}</span>
                      {faviconUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- Favicon URLs are arbitrary; prefer a plain img with graceful fallback. */
                        <img
                          src={faviconUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className={styles.chatGroundingSourceCardFaviconImage}
                          onLoad={handleGroundingImageLoad}
                          onError={handleGroundingFaviconError}
                        />
                      ) : null}
                    </div>
                    <div className={styles.chatGroundingSourceCardContent}>
                      <div className={styles.chatGroundingSourceCardTitle}>{source.title ?? t("Referenced source")}</div>
                      {source.siteLabel ? <div className={styles.chatGroundingSourceCardSite}>{source.siteLabel}</div> : null}
                    </div>
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
