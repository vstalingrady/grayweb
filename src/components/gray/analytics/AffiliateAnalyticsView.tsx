"use client";

import { useEffect, useState } from "react";
import {
  analyticsService,
  ApiError,
  type AffiliateAnalyticsSummary,
  type AffiliateDirectoryResponse,
} from "@/lib/api";
import styles from "./AnalyticsView.module.css";
import {
  AnalyticsCard,
  AnalyticsMatrix,
  AnalyticsTable,
  LineChart,
  formatCount,
  formatCurrencyAmount,
  formatDateTime,
  formatMonthLabel,
  formatPercent,
  type AnalyticsSection,
} from "./AnalyticsComponents";

export function AffiliateAnalyticsView() {
  const [affiliateSummary, setAffiliateSummary] = useState<AffiliateAnalyticsSummary | null>(null);
  const [affiliateDirectory, setAffiliateDirectory] = useState<AffiliateDirectoryResponse | null>(null);
  const [selectedAffiliateCode, setSelectedAffiliateCode] = useState<string | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateActionError, setAffiliateActionError] = useState<string | null>(null);
  const [affiliateSeedPending, setAffiliateSeedPending] = useState(false);
  const [showAllSections, setShowAllSections] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDirectory = async () => {
      try {
        const directory = await analyticsService.getAffiliateDirectory();
        if (cancelled) {
          return;
        }
        setAffiliateDirectory(directory);
        setSelectedAffiliateCode((current) => current ?? directory.affiliates?.[0]?.code ?? null);
        setError(null);
      } catch (errorCandidate) {
        if (!cancelled) {
          if (errorCandidate instanceof ApiError && (errorCandidate.status === 403 || errorCandidate.status === 404)) {
            setError("Access restricted.");
          } else {
            setError("Failed to load affiliate analytics.");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedAffiliateCode) {
      return;
    }
    if (affiliateSummary?.affiliate.code === selectedAffiliateCode) {
      return;
    }
    let cancelled = false;
    setAffiliateLoading(true);
    setAffiliateSummary(null);
    analyticsService
      .getAffiliateSummary(selectedAffiliateCode)
      .then((result) => {
        if (!cancelled) {
          setAffiliateSummary(result);
          setAffiliateActionError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAffiliateActionError("Unable to load affiliate details.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAffiliateLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [affiliateSummary?.affiliate.code, selectedAffiliateCode]);

  const affiliateOptions = affiliateDirectory?.affiliates ?? [];
  const selectedAffiliate = affiliateOptions.find((entry) => entry.code === selectedAffiliateCode) ?? null;
  const hasAffiliateDirectory = affiliateOptions.length > 0;
  const hasTestAffiliate = affiliateOptions.some((entry) => entry.code === "test");
  const affiliateShareUrl = affiliateSummary?.affiliate.share_url ?? selectedAffiliate?.share_url ?? null;

  const affiliatePerformanceRows = affiliateSummary
    ? [
      { label: "Affiliate code", value: affiliateSummary.affiliate.code },
      { label: "Commission rate", value: formatPercent(affiliateSummary.affiliate.commission_rate) },
      { label: "Discount rate", value: formatPercent(affiliateSummary.affiliate.discount_rate) },
      { label: "Signups", value: formatCount(affiliateSummary.summary.signups) },
      { label: "Conversions", value: formatCount(affiliateSummary.summary.conversions) },
      { label: "Active (6 mo)", value: formatCount(affiliateSummary.summary.active_conversions) },
    ]
    : [];

  const affiliateTimeline = affiliateSummary?.timeline ?? [];
  const affiliateMonths = affiliateTimeline.map((entry) => formatMonthLabel(entry.month));
  const affiliateSeries = affiliateTimeline.length
    ? [
      {
        label: "Signups",
        values: affiliateTimeline.map((entry) => entry.signups),
        color: "rgba(122, 214, 255, 0.95)",
      },
      {
        label: "Conversions",
        values: affiliateTimeline.map((entry) => entry.conversions),
        color: "rgba(172, 255, 199, 0.9)",
      },
    ]
    : [];
  const showAffiliateChart = affiliateSeries.length > 0 && affiliateMonths.length > 0;

  const affiliateMatrixColumns = [
    { key: "month", label: "Month" },
    { key: "signups", label: "Signups" },
    { key: "conversions", label: "Conversions" },
  ];
  const affiliateMatrixRows = affiliateTimeline.map((entry) => ({
    key: entry.month,
    values: {
      month: formatMonthLabel(entry.month),
      signups: formatCount(entry.signups),
      conversions: formatCount(entry.conversions),
    },
  }));

  const affiliatePipelineSignupRows = affiliateTimeline.map((entry) => ({
    label: formatMonthLabel(entry.month),
    value: formatCount(entry.signups),
  }));
  const affiliatePipelineConversionRows = affiliateTimeline.map((entry) => ({
    label: formatMonthLabel(entry.month),
    value: formatCount(entry.conversions),
  }));

  const affiliateCurrencyEntries = Object.entries(
    affiliateSummary?.summary?.currency_breakdown ?? {}
  ).map(([currency, values]) => ({
    currency,
    grossRevenue: values.gross_revenue,
    commissionOwed: values.commission_owed,
  }));
  const affiliateCurrencyColumns = [
    { key: "currency", label: "Currency" },
    { key: "gross", label: "Gross revenue" },
    { key: "commission", label: "Commission owed" },
  ];
  const affiliateCurrencyRows = affiliateCurrencyEntries.map((entry) => ({
    key: entry.currency,
    values: {
      currency: entry.currency,
      gross: formatCurrencyAmount(entry.grossRevenue, entry.currency),
      commission: formatCurrencyAmount(entry.commissionOwed, entry.currency),
    },
  }));
  const affiliateCurrencyKeys = Object.keys(affiliateSummary?.summary?.currency_breakdown ?? {});
  const affiliateRevenueCurrency = affiliateCurrencyKeys.length === 1 ? affiliateCurrencyKeys[0] : null;
  const affiliateRevenueSeries =
    affiliateRevenueCurrency && affiliateTimeline.length
      ? [
        {
          label: "Gross revenue",
          values: affiliateTimeline.map((entry) => entry.gross_revenue),
          color: "rgba(255, 180, 110, 0.95)",
        },
        {
          label: "Commission",
          values: affiliateTimeline.map((entry) => entry.commission),
          color: "rgba(255, 236, 180, 0.9)",
        },
      ]
      : [];
  const showAffiliateRevenueChart = affiliateRevenueSeries.length > 0 && affiliateMonths.length > 0;

  const affiliateRevenueColumns = [
    { key: "month", label: "Month" },
    { key: "gross", label: "Gross revenue" },
    { key: "commission", label: "Commission" },
  ];
  const affiliateRevenueRows = affiliateTimeline.map((entry) => ({
    key: entry.month,
    values: {
      month: formatMonthLabel(entry.month),
      gross: affiliateRevenueCurrency
        ? formatCurrencyAmount(entry.gross_revenue, affiliateRevenueCurrency)
        : formatCount(entry.gross_revenue),
      commission: affiliateRevenueCurrency
        ? formatCurrencyAmount(entry.commission, affiliateRevenueCurrency)
        : formatCount(entry.commission),
    },
  }));

  const refreshAffiliateDirectory = async (preferredCode?: string | null) => {
    try {
      const directory = await analyticsService.getAffiliateDirectory();
      setAffiliateDirectory(directory);
      const nextCode =
        preferredCode ??
        selectedAffiliateCode ??
        directory.affiliates?.[0]?.code ??
        null;
      if (nextCode) {
        setSelectedAffiliateCode(nextCode);
      }
      setAffiliateActionError(null);
    } catch {
      setAffiliateActionError("Unable to refresh affiliate list.");
    }
  };

  const handleSeedTestAffiliate = async () => {
    setAffiliateSeedPending(true);
    setAffiliateActionError(null);
    try {
      const seeded = await analyticsService.seedTestAffiliate();
      await refreshAffiliateDirectory(seeded.code);
    } catch {
      setAffiliateActionError("Unable to create test affiliate.");
    } finally {
      setAffiliateSeedPending(false);
    }
  };

  const affiliateSections: AnalyticsSection[] = hasAffiliateDirectory
    ? [
      {
        id: "affiliate-performance",
        label: "Affiliate performance",
        content: (
          <>
            <div className={styles.analyticsSelectRow}>
              <span className={styles.analyticsSelectLabel}>Affiliate</span>
              <select
                className={styles.analyticsSelect}
                value={selectedAffiliateCode ?? ""}
                onChange={(event) => setSelectedAffiliateCode(event.target.value)}
              >
                {affiliateOptions.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.display_name ? `${entry.display_name} (${entry.code})` : entry.code}
                  </option>
                ))}
              </select>
              {!hasTestAffiliate ? (
                <button
                  type="button"
                  className={styles.analyticsButton}
                  onClick={handleSeedTestAffiliate}
                  disabled={affiliateSeedPending}
                >
                  {affiliateSeedPending ? "Creating test affiliate..." : "Seed test affiliate"}
                </button>
              ) : null}
            </div>
            {affiliateLoading ? (
              <p className={styles.analyticsListEmpty}>Loading affiliate details...</p>
            ) : null}
            {affiliateSummary ? (
              <>
                <AnalyticsTable rows={affiliatePerformanceRows} />
                {affiliateShareUrl ? (
                  <div className={styles.analyticsLinkRow}>
                    <span className={styles.analyticsTableLabel}>Share link</span>
                    <a
                      className={styles.analyticsLink}
                      href={affiliateShareUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {affiliateShareUrl}
                    </a>
                  </div>
                ) : null}
                {affiliateCurrencyRows.length ? (
                  <AnalyticsMatrix
                    columns={affiliateCurrencyColumns}
                    rows={affiliateCurrencyRows}
                    emptyLabel="No affiliate revenue yet."
                  />
                ) : null}
              </>
            ) : affiliateLoading ? null : (
              <p className={styles.analyticsListEmpty}>Select an affiliate to view performance.</p>
            )}
            {affiliateActionError ? (
              <p className={styles.analyticsListEmpty}>{affiliateActionError}</p>
            ) : null}
          </>
        ),
      },
      {
        id: "affiliate-growth",
        label: "Affiliate growth (6 mo)",
        content: (
          <>
            {showAffiliateChart ? <LineChart xLabels={affiliateMonths} series={affiliateSeries} /> : null}
            <AnalyticsMatrix
              columns={affiliateMatrixColumns}
              rows={affiliateMatrixRows}
              emptyLabel="No affiliate history yet."
            />
          </>
        ),
      },
      {
        id: "affiliate-pipeline",
        label: "Affiliate pipeline (6 mo)",
        content: (
          <div className={styles.analyticsSplit}>
            <div>
              <p className={styles.analyticsSectionLabel}>Signups</p>
              <AnalyticsTable rows={affiliatePipelineSignupRows} emptyLabel="No signups yet" />
            </div>
            <div>
              <p className={styles.analyticsSectionLabel}>Conversions</p>
              <AnalyticsTable rows={affiliatePipelineConversionRows} emptyLabel="No conversions yet" />
            </div>
          </div>
        ),
      },
      {
        id: "affiliate-revenue",
        label: "Affiliate revenue (6 mo)",
        content: (
          <>
            {showAffiliateRevenueChart ? (
              <LineChart
                xLabels={affiliateMonths}
                series={affiliateRevenueSeries}
                formatTick={(value) =>
                  affiliateRevenueCurrency
                    ? formatCurrencyAmount(value, affiliateRevenueCurrency)
                    : formatCount(value)
                }
              />
            ) : (
              <p className={styles.analyticsListEmpty}>
                Revenue charts show when a single billing currency is used.
              </p>
            )}
            <AnalyticsMatrix
              columns={affiliateRevenueColumns}
              rows={affiliateRevenueRows}
              emptyLabel="No affiliate revenue yet."
            />
          </>
        ),
      },
    ]
    : [];

  const resolvedSectionId =
    selectedSectionId && affiliateSections.some((section) => section.id === selectedSectionId)
      ? selectedSectionId
      : affiliateSections[0]?.id ?? null;
  const selectedSection = affiliateSections.find((section) => section.id === resolvedSectionId) ?? null;

  if (isLoading) {
    return (
      <div className={styles.analyticsView}>
        <div className={styles.analyticsHeader}>
          <p className={styles.analyticsEyebrow}>Private</p>
          <h1 className={styles.analyticsTitle}>Affiliates</h1>
          <p className={styles.analyticsSubtitle}>Loading affiliate analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.analyticsView}>
        <div className={styles.analyticsHeader}>
          <p className={styles.analyticsEyebrow}>Private</p>
          <h1 className={styles.analyticsTitle}>Affiliates</h1>
          <p className={styles.analyticsSubtitle}>{error}</p>
        </div>
      </div>
    );
  }

  const generatedAtLabel = formatDateTime(affiliateSummary?.generated_at ?? affiliateDirectory?.generated_at);

  return (
    <div className={styles.analyticsView}>
      <div className={styles.analyticsHeader}>
        <p className={styles.analyticsEyebrow}>Private</p>
        <h1 className={styles.analyticsTitle}>Affiliates</h1>
        <p className={styles.analyticsSubtitle}>Generated {generatedAtLabel}</p>
      </div>

      {showAllSections ? (
        <div className={styles.analyticsControls}>
          <button type="button" className={styles.analyticsButton} onClick={() => setShowAllSections(false)}>
            Focus view
          </button>
        </div>
      ) : null}

      <div className={styles.analyticsGrid}>
        {showAllSections
          ? affiliateSections.map((section) => (
            <AnalyticsCard key={section.id} title={section.label}>
              {section.content}
            </AnalyticsCard>
          ))
          : selectedSection ? (
            <AnalyticsCard
              className={styles.analyticsFocusCard}
              headerClassName={styles.analyticsFocusHeader}
              actions={
                <div className={[styles.analyticsSelectRow, styles.analyticsSelectRowFull].join(" ")}>
                  <span className={styles.analyticsSelectLabel}>Section</span>
                  <select
                    className={styles.analyticsSelect}
                    value={resolvedSectionId ?? ""}
                    onChange={(event) => setSelectedSectionId(event.target.value)}
                  >
                    {affiliateSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.analyticsButton}
                    onClick={() => setShowAllSections(true)}
                  >
                    Show all
                  </button>
                </div>
              }
            >
              {selectedSection.content}
            </AnalyticsCard>
          ) : (
            <p className={styles.analyticsListEmpty}>No affiliate sections available.</p>
          )}
      </div>
    </div>
  );
}
