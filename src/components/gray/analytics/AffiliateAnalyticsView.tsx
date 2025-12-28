"use client";

import { useEffect, useState, type FormEvent } from "react";
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
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newAffiliate, setNewAffiliate] = useState({
    code: "",
    displayName: "",
    ownerEmail: "",
    commissionRate: "20",
    discountRate: "10",
    isActive: true,
  });
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
  const sharePreview = newAffiliate.code.trim()
    ? `/a/${newAffiliate.code.trim().toLowerCase()}`
    : null;

  const affiliatePerformanceRows = affiliateSummary
    ? [
      { label: "Affiliate code", value: affiliateSummary.affiliate.code },
      { label: "Commission rate", value: formatPercent(affiliateSummary.affiliate.commission_rate) },
      { label: "Discount rate", value: formatPercent(affiliateSummary.affiliate.discount_rate) },
      { label: "Clicks", value: formatCount(affiliateSummary.summary.clicks) },
      { label: "Signups", value: formatCount(affiliateSummary.summary.signups) },
      { label: "Conversions", value: formatCount(affiliateSummary.summary.conversions) },
      { label: "Signup rate", value: formatPercent(affiliateSummary.summary.signup_rate) },
      { label: "Conversion rate", value: formatPercent(affiliateSummary.summary.conversion_rate) },
      { label: "Active (6 mo)", value: formatCount(affiliateSummary.summary.active_conversions) },
    ]
    : [];

  const affiliateTimeline = affiliateSummary?.timeline ?? [];
  const affiliateMonths = affiliateTimeline.map((entry) => formatMonthLabel(entry.month));
  const affiliateSeries = affiliateTimeline.length
    ? [
      {
        label: "Clicks",
        values: affiliateTimeline.map((entry) => entry.clicks ?? 0),
        color: "rgba(210, 210, 210, 0.75)",
      },
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
    { key: "clicks", label: "Clicks" },
    { key: "signups", label: "Signups" },
    { key: "conversions", label: "Conversions" },
  ];
  const affiliateMatrixRows = affiliateTimeline.map((entry) => ({
    key: entry.month,
    values: {
      month: formatMonthLabel(entry.month),
      clicks: formatCount(entry.clicks ?? 0),
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

  const recentSignupColumns = [
    { key: "email", label: "Email" },
    { key: "attributed_at", label: "Signed up" },
  ];
  const recentSignupRows = (affiliateSummary?.recent_signups ?? []).map((entry, index) => ({
    key: `${entry.email}-${index}`,
    values: {
      email: entry.email,
      attributed_at: formatDateTime(entry.attributed_at),
    },
  }));

  const recentConversionColumns = [
    { key: "email", label: "Email" },
    { key: "amount", label: "Amount" },
    { key: "order", label: "Order" },
    { key: "paid_at", label: "Paid" },
  ];
  const recentConversionRows = (affiliateSummary?.recent_conversions ?? []).map((entry, index) => ({
    key: `${entry.order_id ?? "order"}-${index}`,
    values: {
      email: entry.email,
      amount:
        entry.amount && entry.currency
          ? formatCurrencyAmount(entry.amount, entry.currency)
          : formatCount(entry.amount ?? 0),
      order: entry.order_id ?? "—",
      paid_at: formatDateTime(entry.paid_at),
    },
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

  const handleCreateAffiliate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newAffiliate.code.trim()) {
      setCreateError("Enter an affiliate code.");
      return;
    }
    const commissionRate = Number(newAffiliate.commissionRate);
    const discountRate = Number(newAffiliate.discountRate);
    setCreatePending(true);
    setCreateError(null);
    try {
      const created = await analyticsService.createAffiliate({
        code: newAffiliate.code.trim(),
        display_name: newAffiliate.displayName.trim() || null,
        owner_email: newAffiliate.ownerEmail.trim() || null,
        commission_rate: Number.isFinite(commissionRate) ? commissionRate / 100 : 0,
        discount_rate: Number.isFinite(discountRate) ? discountRate / 100 : 0,
        is_active: newAffiliate.isActive,
      });
      await refreshAffiliateDirectory(created.code);
      setNewAffiliate((current) => ({
        ...current,
        code: "",
        displayName: "",
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(err.message || "Unable to create affiliate.");
      } else {
        setCreateError("Unable to create affiliate.");
      }
    } finally {
      setCreatePending(false);
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
        id: "affiliate-signups",
        label: "Recent signups",
        content: (
          <AnalyticsMatrix
            columns={recentSignupColumns}
            rows={recentSignupRows}
            emptyLabel="No signups yet."
          />
        ),
      },
      {
        id: "affiliate-purchases",
        label: "Recent purchases",
        content: (
          <AnalyticsMatrix
            columns={recentConversionColumns}
            rows={recentConversionRows}
            emptyLabel="No purchases yet."
          />
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

      <AnalyticsCard title="Create affiliate link">
        <form className={styles.analyticsForm} onSubmit={handleCreateAffiliate}>
          <div className={styles.analyticsFormRow}>
            <label className={styles.analyticsFormField}>
              <span className={styles.analyticsInputLabel}>Code</span>
              <input
                className={styles.analyticsInput}
                value={newAffiliate.code}
                onChange={(event) => setNewAffiliate((current) => ({ ...current, code: event.target.value }))}
                placeholder="creator-name"
                required
              />
            </label>
            <label className={styles.analyticsFormField}>
              <span className={styles.analyticsInputLabel}>Display name</span>
              <input
                className={styles.analyticsInput}
                value={newAffiliate.displayName}
                onChange={(event) => setNewAffiliate((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Creator"
              />
            </label>
            <label className={styles.analyticsFormField}>
              <span className={styles.analyticsInputLabel}>Owner email</span>
              <input
                className={styles.analyticsInput}
                type="email"
                value={newAffiliate.ownerEmail}
                onChange={(event) => setNewAffiliate((current) => ({ ...current, ownerEmail: event.target.value }))}
                placeholder="name@example.com"
              />
            </label>
          </div>
          <div className={styles.analyticsFormRow}>
            <label className={styles.analyticsFormField}>
              <span className={styles.analyticsInputLabel}>Commission %</span>
              <input
                className={styles.analyticsInput}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={newAffiliate.commissionRate}
                onChange={(event) => setNewAffiliate((current) => ({ ...current, commissionRate: event.target.value }))}
              />
            </label>
            <label className={styles.analyticsFormField}>
              <span className={styles.analyticsInputLabel}>Discount %</span>
              <input
                className={styles.analyticsInput}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={newAffiliate.discountRate}
                onChange={(event) => setNewAffiliate((current) => ({ ...current, discountRate: event.target.value }))}
              />
            </label>
            <label className={styles.analyticsFormField}>
              <span className={styles.analyticsInputLabel}>Active</span>
              <div className={styles.analyticsCheckboxRow}>
                <input
                  type="checkbox"
                  checked={newAffiliate.isActive}
                  onChange={(event) => setNewAffiliate((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span>Enabled</span>
              </div>
            </label>
          </div>
          {sharePreview ? (
            <div className={styles.analyticsLinkRow}>
              <span className={styles.analyticsTableLabel}>Share link</span>
              <span className={styles.analyticsLink}>{sharePreview}</span>
            </div>
          ) : null}
          <div className={styles.analyticsFormActions}>
            <button type="submit" className={styles.analyticsButton} disabled={createPending}>
              {createPending ? "Creating..." : "Create affiliate"}
            </button>
            {createError ? <span className={styles.analyticsListEmpty}>{createError}</span> : null}
          </div>
        </form>
      </AnalyticsCard>

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
