"use client";

import styles from "./ChatMessageGroundingPanel.module.css";
import type { GroundingMetadata } from "@/lib/api";
import { buildGroundingSourceCards, buildGroundingSourceFaviconUrl, buildGroundingSourceInitials } from "./groundingSources";
import { getSanitizedSearchEntryHtml } from "./searchEntrySanitizer";

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
  const renderedSearchEntry =
    typeof searchEntryPoint?.rendered_content === "string"
      ? searchEntryPoint?.rendered_content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : typeof (searchEntryPoint as any)?.renderedContent === "string"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (searchEntryPoint as any).renderedContent
        : null;
  const sanitizedSearchEntryHtml = renderedSearchEntry ? getSanitizedSearchEntryHtml(renderedSearchEntry) : null;

  const chunks =
    metadata?.grounding_chunks ??
    (metadata as { groundingChunks?: GroundingMetadata["grounding_chunks"] })?.groundingChunks ??
    [];
  const mapSources = chunks
    .map((chunk) => chunk?.maps)
    .filter((maps): maps is NonNullable<(typeof chunks)[number]["maps"]> => Boolean(maps));

  const widgetToken =
    metadata?.google_maps_widget_context_token ??
    (metadata as { googleMapsWidgetContextToken?: string })?.googleMapsWidgetContextToken ??
    null;
  const hasWidget = Boolean(widgetToken);

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

  if (sourceCards.length === 0 && mapSources.length === 0 && filteredQueries.length === 0 && !hasWidget && !sanitizedSearchEntryHtml) {
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
                    target="_blank"
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
      {mapSources.length > 0 ? (
        <div className={styles.chatGroundingSources}>
          {mapSources.map((maps, index) => {
            const label = maps.title ?? maps.placeId ?? t("Maps source");
            const href = maps.uri ?? maps.googleMapsUri ?? undefined;
            return (
              <div key={`${messageId}-maps-source-${index}`} className={styles.chatGroundingSource}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className={styles.chatGroundingLink}>
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
      {hasWidget ? (
        <div className={styles.chatGroundingWidget}>
          <span>{t("Widget token:")}</span>
          <code>{widgetToken}</code>
        </div>
      ) : null}
    </div>
  );
}
