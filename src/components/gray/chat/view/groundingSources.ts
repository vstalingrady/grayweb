import type { GroundingMetadata } from "@/lib/api";

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

export const buildGroundingSourceInitials = (text?: string | null) => {
  if (!text) {
    return "↗";
  }
  const letters = text
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
  return letters || "↗";
};

export type DerivedGroundingSource = {
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

export const buildGroundingSourceFaviconUrl = (source: DerivedGroundingSource): string | undefined => {
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

export const buildGroundingSourceCards = (
  metadata: GroundingMetadata | undefined | null,
  t: (message: string, vars?: Record<string, string | number>) => string
): DerivedGroundingSource[] => {
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
        title: chunk.web.title ?? siteLabel ?? t("Referenced web content"),
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
        title: retrieved.title || retrieved.text?.slice(0, 80) || (siteLabel ?? t("Referenced context")),
        href: retrieved.uri ?? undefined,
        excerpt: retrieved.text,
        isReferenced,
        faviconHost: derivedHost,
      });
    }
  });

  return sources.sort((a, b) => Number(b.isReferenced) - Number(a.isReferenced));
};

