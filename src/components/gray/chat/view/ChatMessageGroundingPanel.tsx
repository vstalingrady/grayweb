"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./ChatMessageGroundingPanel.module.css";
import type { GroundingMetadata } from "@/lib/api";
import { resolveApiUrl } from "@/lib/api/baseUrl";
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
  snippet?: string;
  thumbnailUrl?: string;
};

type GroundingPanelCard = {
  id: string;
  title: string;
  href?: string;
  siteLabel?: string;
  snippet?: string;
  faviconUrl?: string;
  previewImageUrl?: string;
  previewFallbackQueue?: string;
  initials: string;
};

type LinkPreviewResponsePayload = {
  image_url?: string;
  imageUrl?: string;
  image_proxy_url?: string;
  imageProxyUrl?: string;
};

const LINK_PREVIEW_FETCH_LIMIT = 10;
const HTTP_URL_PATTERN = /^https?:\/\//i;
const linkPreviewImageCache = new Map<string, string | null>();

const normalizeSearchEntryImageUrl = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
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

const classifyGroundingHref = (href?: string, siteLabel?: string): string => {
  const normalizedSite = normalizeSearchEntryHost(siteLabel) ?? "";
  if (!href) {
    if (normalizedSite.includes("wikipedia.org") || normalizedSite.includes("archlinux.org")) {
      return "Wiki article";
    }
    if (normalizedSite.includes("wiktionary.org")) {
      return "Dictionary entry";
    }
    if (normalizedSite.includes("w3.org")) {
      return "Standards reference";
    }
    return "Web reference";
  }

  try {
    const url = new URL(href);
    const host = normalizeSearchEntryHost(url.hostname) ?? normalizedSite;
    const path = url.pathname.toLowerCase();
    if (host.includes("wiktionary.org")) {
      return "Dictionary entry";
    }
    if (host.includes("wikipedia.org")) {
      return "Encyclopedia article";
    }
    if (path.includes("/wiki/")) {
      return "Wiki article";
    }
    if (host.includes("github.com")) {
      return "Repository page";
    }
    if (host.includes("stackoverflow.com")) {
      return "Q&A thread";
    }
    if (host.includes("arxiv.org")) {
      return "Research paper";
    }
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "Video page";
    }
    if (path.endsWith(".pdf")) {
      return "PDF document";
    }
    if (path.includes("/docs") || path.includes("/documentation")) {
      return "Documentation page";
    }
    if (path.includes("/blog")) {
      return "Blog post";
    }
    if (path.includes("/news")) {
      return "News article";
    }
    if (host.includes("w3.org")) {
      return "Standards reference";
    }
    return "Web reference";
  } catch {
    return "Web reference";
  }
};

const buildGroundingCardDetail = (href?: string, siteLabel?: string, fallbackSnippet?: string): string | undefined => {
  const fallback = extractSourceSnippet(fallbackSnippet);
  if (fallback) {
    return fallback;
  }
  const classification = classifyGroundingHref(href, siteLabel);
  if (classification && classification !== "Web reference") {
    return classification;
  }
  return undefined;
};

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const truncatePreviewText = (value: string, maxLength = 220): string =>
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;

const extractSourceSnippet = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = collapseWhitespace(value);
  if (!normalized || normalized.length < 24) {
    return undefined;
  }
  return truncatePreviewText(normalized);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanSearchEntrySnippetCandidate = (candidate: string, title: string, siteLabel?: string): string | null => {
  let normalized = collapseWhitespace(candidate);
  if (!normalized) {
    return null;
  }
  const normalizedTitle = collapseWhitespace(title);
  if (normalizedTitle) {
    if (normalized.toLowerCase() === normalizedTitle.toLowerCase()) {
      return null;
    }
    const escapedTitle = escapeRegExp(normalizedTitle);
    normalized = normalized.replace(new RegExp(`^${escapedTitle}\\s*[|:·•\\-–—]+\\s*`, "i"), "");
    if (normalized.toLowerCase().startsWith(normalizedTitle.toLowerCase())) {
      normalized = normalized.slice(normalizedTitle.length).trim();
    }
  }
  if (siteLabel) {
    const normalizedSite = collapseWhitespace(siteLabel);
    if (normalizedSite) {
      const escapedSite = escapeRegExp(normalizedSite);
      normalized = normalized.replace(new RegExp(`^${escapedSite}\\s*[|:·•\\-–—]+\\s*`, "i"), "");
    }
  }
  normalized = normalized.replace(/^[|:·•\-\u2013\u2014]+\s*/, "");
  normalized = collapseWhitespace(normalized);
  if (!normalized || normalized.length < 28) {
    return null;
  }
  return truncatePreviewText(normalized);
};

const extractSearchEntrySnippet = (anchor: HTMLAnchorElement, title: string, siteLabel?: string): string | undefined => {
  const candidates: string[] = [];
  const push = (value?: string | null) => {
    if (!value) {
      return;
    }
    const normalized = collapseWhitespace(value);
    if (normalized) {
      candidates.push(normalized);
    }
  };

  push(anchor.getAttribute("aria-description"));
  push(anchor.getAttribute("aria-label"));
  push(anchor.getAttribute("title"));

  const anchorText = collapseWhitespace(anchor.textContent ?? "");
  const parent = anchor.parentElement;
  if (parent) {
    for (const child of Array.from(parent.children)) {
      if (child === anchor || child.contains(anchor)) {
        continue;
      }
      push(child.textContent);
    }
    if (anchorText) {
      push((parent.textContent ?? "").replace(anchorText, " "));
    }
  }

  const containers = [anchor.closest("article"), anchor.closest("li"), parent?.parentElement, parent?.parentElement?.parentElement];
  for (const container of containers) {
    if (!container) {
      continue;
    }
    for (const child of Array.from(container.children)) {
      if (child === anchor || child.contains(anchor)) {
        continue;
      }
      push(child.textContent);
      if (candidates.length >= 14) {
        break;
      }
    }
    if (candidates.length >= 14) {
      break;
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const snippet = cleanSearchEntrySnippetCandidate(candidate, title, siteLabel);
    if (snippet) {
      return snippet;
    }
  }
  return undefined;
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

const PRIVATE_IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const isPrivateIpv4Host = (hostname: string): boolean => {
  if (!PRIVATE_IPV4_PATTERN.test(hostname)) {
    return false;
  }
  const parts = hostname.split(".").map((value) => Number.parseInt(value, 10));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }
  if (parts[0] === 10 || parts[0] === 127) {
    return true;
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }
  return parts[0] === 0;
};

const isLikelyInternalHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!normalized) {
    return true;
  }
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  if (isPrivateIpv4Host(normalized)) {
    return true;
  }
  if (normalized.includes(":")) {
    if (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    ) {
      return true;
    }
  }
  return false;
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
    if (isLikelyInternalHost(parsed.hostname)) {
      return [];
    }
    const videoId = extractYouTubeVideoId(parsed);
    if (videoId) {
      return [`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`];
    }
    const pathname = parsed.pathname.toLowerCase();
    const hasDirectImageExtension = /\.(?:png|jpe?g|webp|avif|gif|bmp|svg)$/.test(pathname);
    if (hasDirectImageExtension) {
      return [parsed.toString()];
    }
    return [];
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
  const sourcePreview = normalizeSearchEntryImageUrl(source.previewImageUrl ?? null);
  if (sourcePreview) {
    return sourcePreview;
  }
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

const resolveLinkPreviewImage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as LinkPreviewResponsePayload;
  const proxiedUrl = typeof record.image_proxy_url === "string" ? record.image_proxy_url : record.imageProxyUrl;
  const directImageUrl = typeof record.image_url === "string" ? record.image_url : record.imageUrl;

  if (proxiedUrl) {
    const normalizedProxy = normalizeSearchEntryImageUrl(resolveApiUrl(proxiedUrl));
    if (normalizedProxy) {
      return normalizedProxy;
    }
  }

  return normalizeSearchEntryImageUrl(directImageUrl ?? null);
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
      const snippet = extractSearchEntrySnippet(anchor, title, siteLabel || undefined);
      results.push({
        id: `search-${results.length}`,
        title,
        href: normalizedHref,
        siteLabel: siteLabel || undefined,
        snippet: snippet ?? undefined,
        thumbnailUrl: thumbnailUrl ?? undefined,
      });
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [resolvedPreviewByHref, setResolvedPreviewByHref] = useState<Record<string, string>>({});
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
  const cards: GroundingPanelCard[] = [];
  const seenCardKeys = new Set<string>();

  const addCard = (card: GroundingPanelCard) => {
    const dedupeKey = card.href ? `href:${card.href}` : `${card.title}|${card.siteLabel ?? ""}`;
    if (seenCardKeys.has(dedupeKey)) {
      return;
    }
    seenCardKeys.add(dedupeKey);
    cards.push(card);
  };

  for (const result of searchEntryResults) {
    const faviconUrl = buildGroundingSourceFaviconUrl({
      id: result.id,
      title: result.title,
      isReferenced: false,
      href: result.href,
      siteLabel: result.siteLabel,
    });
    const thumbnailResolution = resolveThumbnailWithFallbacks(result.thumbnailUrl, result.href);
    addCard({
      id: `search-${result.id}`,
      title: result.title,
      href: result.href,
      siteLabel: result.siteLabel,
      snippet: buildGroundingCardDetail(result.href, result.siteLabel, result.snippet),
      faviconUrl,
      previewImageUrl: thumbnailResolution.primary,
      previewFallbackQueue: thumbnailResolution.fallbacks.join("|"),
      initials: buildGroundingSourceInitials(result.siteLabel ?? result.title),
    });
  }

  for (const source of sourceCards) {
    const faviconUrl = buildGroundingSourceFaviconUrl(source);
    const extractedThumbnailUrl = resolveThumbnailForSource(source, thumbnailIndex);
    const thumbnailResolution = resolveThumbnailWithFallbacks(extractedThumbnailUrl, source.href);
    addCard({
      id: `source-${source.id}`,
      title: source.title ?? t("Referenced source"),
      href: source.href,
      siteLabel: source.siteLabel,
      snippet: buildGroundingCardDetail(source.href, source.siteLabel, source.excerpt),
      faviconUrl,
      previewImageUrl: thumbnailResolution.primary,
      previewFallbackQueue: thumbnailResolution.fallbacks.join("|"),
      initials: buildGroundingSourceInitials(source.siteLabel ?? source.title),
    });
  }

  const previewLookupCandidates = Array.from(
    new Set(
      cards
        .filter((card) => !card.previewImageUrl)
        .map((card) => card.href?.trim())
        .filter((href): href is string => Boolean(href) && HTTP_URL_PATTERN.test(href))
    )
  ).slice(0, LINK_PREVIEW_FETCH_LIMIT);
  const previewLookupKey = previewLookupCandidates.join("\n");
  const cachedPreviewByHref: Record<string, string> = {};
  for (const href of previewLookupCandidates) {
    const cached = linkPreviewImageCache.get(href);
    if (cached) {
      cachedPreviewByHref[href] = cached;
    }
  }

  useEffect(() => {
    const hrefs = previewLookupKey
      ? previewLookupKey
          .split("\n")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];
    if (hrefs.length === 0) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const pendingFetches: string[] = [];

    for (const href of hrefs) {
      if (linkPreviewImageCache.has(href)) {
        continue;
      }
      pendingFetches.push(href);
    }

    if (pendingFetches.length === 0) {
      return () => controller.abort();
    }

    const loadPreviews = async () => {
      await Promise.all(
        pendingFetches.map(async (href) => {
          try {
            const endpoint = `${resolveApiUrl("/api/link-preview")}?url=${encodeURIComponent(href)}`;
            const response = await fetch(endpoint, {
              method: "GET",
              credentials: "same-origin",
              cache: "force-cache",
              signal: controller.signal,
            });
            if (!response.ok) {
              linkPreviewImageCache.set(href, null);
              return;
            }
            const payload = (await response.json()) as unknown;
            const imageUrl = resolveLinkPreviewImage(payload);
            linkPreviewImageCache.set(href, imageUrl);
            if (imageUrl) {
              if (cancelled) {
                return;
              }
              setResolvedPreviewByHref((previous) => {
                if (previous[href] === imageUrl) {
                  return previous;
                }
                return { ...previous, [href]: imageUrl };
              });
            }
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              return;
            }
            linkPreviewImageCache.set(href, null);
          }
        })
      );
    };

    void loadPreviews();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [previewLookupKey]);

  const selfTargetSearchEntryHtml = sanitizedSearchEntryHtml
    ? sanitizedSearchEntryHtml
        .replace(/\btarget=(["'])_blank\1/gi, 'target="_self"')
        .replace(/\brel=(["'])noreferrer noopener\1/gi, 'rel="noreferrer"')
    : null;
  const hasExpandableContent = cards.length > 0 || Boolean(selfTargetSearchEntryHtml);
  const summaryChipQueries = searchedQueries;

  if (
    cards.length === 0 &&
    searchedQueries.length === 0 &&
    !selfTargetSearchEntryHtml
  ) {
    return null;
  }

  const renderGroundingCard = (card: GroundingPanelCard) => {
    const resolvedPreviewImageUrl = card.href
      ? resolvedPreviewByHref[card.href] ?? cachedPreviewByHref[card.href] ?? card.previewImageUrl
      : card.previewImageUrl;
    const resolvedFallbackQueue = resolvedPreviewImageUrl
      ? dedupeNonEmptyUrls([
          ...(resolvedPreviewImageUrl !== card.previewImageUrl ? [card.previewImageUrl] : []),
          ...(card.previewFallbackQueue ? card.previewFallbackQueue.split("|") : []),
        ]).join("|")
      : card.previewFallbackQueue;
    const mediaClassName = resolvedPreviewImageUrl
      ? styles.chatGroundingCardMedia
      : `${styles.chatGroundingCardMedia} ${styles.chatGroundingCardMediaNoPreview}`;
    const showFaviconBackdrop = !resolvedPreviewImageUrl && Boolean(card.faviconUrl);
    const cardContent = (
      <>
        <div className={mediaClassName}>
          {resolvedPreviewImageUrl ? (
            <>
              <span className={styles.chatGroundingCardMediaFallback}>{card.initials}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- Remote search thumbnails require direct img usage and custom fallback handling. */}
              <img
                src={resolvedPreviewImageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className={styles.chatGroundingCardMediaImage}
                data-fallback-queue={resolvedFallbackQueue || undefined}
                onLoad={handleGroundingImageLoad}
                onError={handleGroundingImageError}
              />
            </>
          ) : (
            <>
              {showFaviconBackdrop ? (
                /* eslint-disable-next-line @next/next/no-img-element -- Remote favicon endpoints require direct img usage and fallback handling. */
                <img
                  src={card.faviconUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className={styles.chatGroundingCardMediaFaviconBackdrop}
                  onError={handleGroundingFaviconError}
                />
              ) : null}
              <span className={styles.chatGroundingCardMediaBackdropShade} aria-hidden="true" />
              <div className={styles.chatGroundingCardMediaFallbackShell}>
                <div className={styles.chatGroundingCardMediaFallbackBadge}>
                  <span className={styles.chatGroundingCardMediaFallbackText}>{card.initials}</span>
                  {card.faviconUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- Remote favicon endpoints require direct img usage and fallback handling. */
                    <img
                      src={card.faviconUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={styles.chatGroundingCardMediaFallbackFavicon}
                      onLoad={handleGroundingImageLoad}
                      onError={handleGroundingFaviconError}
                    />
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
        <div className={styles.chatGroundingCardMeta}>
          <div className={styles.chatGroundingCardFavicon}>
            <span className={styles.chatGroundingCardFaviconFallback}>{card.initials}</span>
            {card.faviconUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- Remote favicon endpoints require direct img usage and fallback handling. */
              <img
                src={card.faviconUrl}
                alt=""
                referrerPolicy="no-referrer"
                className={styles.chatGroundingCardFaviconImage}
                onLoad={handleGroundingImageLoad}
                onError={handleGroundingFaviconError}
              />
            ) : null}
          </div>
          <div className={styles.chatGroundingCardContent}>
            <div className={styles.chatGroundingCardTitle}>{card.title}</div>
            {card.siteLabel ? <div className={styles.chatGroundingCardSite}>{card.siteLabel}</div> : null}
          </div>
        </div>
      </>
    );

    if (card.href) {
      return (
        <a key={card.id} href={card.href} target="_self" rel="noreferrer" className={styles.chatGroundingCard}>
          {cardContent}
        </a>
      );
    }

    return (
      <div key={card.id} className={styles.chatGroundingCard} data-clickable="false">
        {cardContent}
      </div>
    );
  };

  return (
    <div className={styles.chatGroundingPanel}>
      {hasExpandableContent ? (
        <button
          type="button"
          className={styles.chatGroundingSummaryToggle}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className={styles.chatGroundingSummaryToggleMeta}>
            <span className={styles.chatGroundingSummaryLabel}>{t("Searched")}</span>
            <div className={styles.chatGroundingSummaryQueries}>
              {summaryChipQueries.map((query) => (
                <span key={query} className={styles.chatGroundingSummaryQueryChip}>
                  {query}
                </span>
              ))}
            </div>
          </div>
          <ChevronDown
            size={15}
            className={`${styles.chatGroundingSummaryChevron} ${isExpanded ? styles.chatGroundingSummaryChevronExpanded : ""}`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className={styles.chatGroundingSummaryStatic}>
          <span className={styles.chatGroundingSummaryLabel}>{t("Searched")}</span>
          <div className={styles.chatGroundingSummaryQueries}>
            {summaryChipQueries.map((query) => (
              <span key={query} className={styles.chatGroundingSummaryQueryChip}>
                {query}
              </span>
            ))}
          </div>
        </div>
      )}
      {hasExpandableContent && isExpanded ? (
        cards.length > 0 ? (
          <div className={styles.chatGroundingCards}>{cards.map((card) => renderGroundingCard(card))}</div>
        ) : selfTargetSearchEntryHtml ? (
          <div className={styles.chatGroundingSearchEntryDeck}>
            <div className={styles.chatGroundingSearchEntry} dangerouslySetInnerHTML={{ __html: selfTargetSearchEntryHtml }} />
          </div>
        ) : null
      ) : null}
    </div>
  );
}
