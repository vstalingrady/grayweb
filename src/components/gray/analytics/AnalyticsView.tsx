"use client";

import { useEffect, useState, type FormEvent } from "react";
import { analyticsService, ApiError, type AnalyticsSummary } from "@/lib/api";
import styles from "./AnalyticsView.module.css";
import {
  AnalyticsCard,
  AnalyticsMatrix,
  AnalyticsMeter,
  AnalyticsTable,
  LineChart,
  formatCount,
  formatDateTime,
  formatDayLabel,
  formatMonthLabel,
  formatPercent,
  type AnalyticsSection,
} from "./AnalyticsComponents";

const PLAN_ORDER = ["scout", "pathfinder", "voyager", "pioneer", "none"];

export function AnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [showAllSections, setShowAllSections] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [affiliateSeedPending, setAffiliateSeedPending] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdAffiliateLink, setCreatedAffiliateLink] = useState<string | null>(null);
  const [newAffiliate, setNewAffiliate] = useState({
    code: "",
    displayName: "",
    ownerEmail: "",
    commissionRate: "20",
    discountRate: "10",
    isActive: true,
  });

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summaryResult = await analyticsService.getAnalyticsSummary();

        if (cancelled) {
          return;
        }

        setSummary(summaryResult);
        setError(null);
      } catch (errorCandidate) {
        if (!cancelled) {
          if (errorCandidate instanceof ApiError && (errorCandidate.status === 403 || errorCandidate.status === 404)) {
            setError("Access restricted.");
          } else {
            setError("Failed to load analytics.");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const sharePreview = newAffiliate.code.trim()
    ? `/a/${newAffiliate.code.trim().toLowerCase()}`
    : null;

  const handleSeedTestAffiliate = async () => {
    setAffiliateSeedPending(true);
    setCreateError(null);
    try {
      const seeded = await analyticsService.seedTestAffiliate();
      setCreatedAffiliateLink(seeded.share_url);
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(err.message || "Unable to create test affiliate.");
      } else {
        setCreateError("Unable to create test affiliate.");
      }
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
      setCreatedAffiliateLink(created.share_url);
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

  const showAdminAnalytics = Boolean(summary);
  const planDistribution = summary?.user_growth?.plan_distribution ?? {};
  const planEntries = PLAN_ORDER
    .map((key) => ({ key, value: planDistribution[key] ?? 0 }))
    .filter((entry) => entry.value > 0 || entry.key !== "none");

  const paidUsers =
    (planDistribution.pathfinder ?? 0) + (planDistribution.voyager ?? 0) + (planDistribution.pioneer ?? 0);

  const totalUsers = summary?.user_growth?.total_users ?? 0;
  const paidShare = totalUsers > 0 ? paidUsers / totalUsers : 0;

  const userGrowthRows = [
    { label: "Total users", value: formatCount(summary?.user_growth?.total_users) },
    { label: "Paid users", value: formatCount(paidUsers) },
    { label: "New (7d)", value: formatCount(summary?.user_growth?.new_7d) },
    { label: "New (30d)", value: formatCount(summary?.user_growth?.new_30d) },
  ];

  const engagementRows = [
    { label: "DAU", value: formatCount(summary?.engagement?.dau) },
    { label: "WAU", value: formatCount(summary?.engagement?.wau) },
    { label: "MAU", value: formatCount(summary?.engagement?.mau) },
    { label: "Avg msgs / user", value: formatCount(summary?.engagement?.avg_messages_per_user) },
  ];

  const churnRows = [
    { label: "Eligible users", value: formatCount(summary?.churn?.eligible_30d) },
    { label: "Active users", value: formatCount(summary?.churn?.active_30d) },
    { label: "Inactive users", value: formatCount(summary?.churn?.inactive_30d) },
    { label: "Churn rate", value: formatPercent(summary?.churn?.churn_rate_30d) },
  ];

  const featureRows = [
    { label: "Users with plans", value: formatCount(summary?.feature_adoption?.users_with_plans) },
    { label: "Users with habits", value: formatCount(summary?.feature_adoption?.users_with_habits) },
    { label: "Active reminders", value: formatCount(summary?.feature_adoption?.active_reminders) },
    { label: "Calendar events", value: formatCount(summary?.feature_adoption?.calendar_events) },
    { label: "Push subs", value: formatCount(summary?.feature_adoption?.push_subscriptions) },
  ];

  const planRows = planEntries.map((entry) => ({
    label: entry.key,
    value: formatCount(entry.value),
  }));

  const statusEntries = Object.entries(summary?.revenue?.by_status ?? {}).map(([key, value]) => ({
    key,
    value: value ?? 0,
  }));

  const revenuePlanEntries = Object.entries(summary?.revenue?.by_plan ?? {}).map(([key, value]) => ({
    key,
    value: value ?? 0,
  }));

  const statusRows = statusEntries.map((entry) => ({
    label: entry.key,
    value: formatCount(entry.value),
  }));

  const revenuePlanRows = revenuePlanEntries.map((entry) => ({
    label: entry.key,
    value: formatCount(entry.value),
  }));

  const adminTimeline = summary?.timeseries;
  const adminMonths = adminTimeline?.months?.map(formatMonthLabel) ?? [];
  const adminSeries = adminTimeline
    ? [
      {
        label: "Signups",
        values: adminTimeline.signups,
        color: "rgba(122, 214, 255, 0.95)",
      },
      {
        label: "Paid transactions",
        values: adminTimeline.paid_transactions,
        color: "rgba(255, 180, 110, 0.95)",
      },
    ]
    : [];
  const showAdminChart = adminSeries.length > 0 && adminMonths.length > 0;

  const dailyDays = adminTimeline?.days ?? [];
  const dailyLabels = dailyDays.map(formatDayLabel);
  const dailySignups = adminTimeline?.daily_signups ?? [];
  const dailyPointCount = Math.min(dailyLabels.length, dailySignups.length);
  const dailySeries =
    dailyPointCount > 0
      ? [
        {
          label: "Signups",
          values: dailySignups.slice(0, dailyPointCount),
          color: "rgba(118, 255, 175, 0.95)",
        },
      ]
      : [];
  const showDailyChart = dailySeries.length > 0 && dailyPointCount > 0;

  const adminMatrixColumns = [
    { key: "month", label: "Month" },
    { key: "signups", label: "Signups" },
    { key: "paid", label: "Paid transactions" },
  ];
  const adminMatrixRows = adminTimeline
    ? adminTimeline.months.map((month, index) => ({
      key: month,
      values: {
        month: formatMonthLabel(month),
        signups: formatCount(adminTimeline.signups[index] ?? 0),
        paid: formatCount(adminTimeline.paid_transactions[index] ?? 0),
      },
    }))
    : [];

  const adminSections: AnalyticsSection[] = showAdminAnalytics
    ? [
      {
        id: "user-growth",
        label: "User growth",
        content: (
          <>
            <AnalyticsTable rows={userGrowthRows} />
            <AnalyticsMeter label="Paid share" value={paidShare} />
            {showDailyChart ? (
              <>
                <p className={styles.analyticsSectionLabel}>Last 30 days signups</p>
                <LineChart
                  xLabels={dailyLabels.slice(0, dailyPointCount)}
                  series={dailySeries}
                  height={140}
                  showLegend={false}
                />
              </>
            ) : null}
          </>
        ),
      },
      {
        id: "trends",
        label: "Trends (6 mo)",
        content: (
          <>
            {showAdminChart ? <LineChart xLabels={adminMonths} series={adminSeries} /> : null}
            <AnalyticsMatrix
              columns={adminMatrixColumns}
              rows={adminMatrixRows}
              emptyLabel="No trend data yet."
            />
          </>
        ),
      },
      {
        id: "daily-growth",
        label: "Daily growth (30d)",
        content: showDailyChart ? (
          <LineChart xLabels={dailyLabels.slice(0, dailyPointCount)} series={dailySeries} />
        ) : (
          <p className={styles.analyticsListEmpty}>No daily signup data yet.</p>
        ),
      },
      {
        id: "engagement",
        label: "Engagement",
        content: <AnalyticsTable rows={engagementRows} />,
      },
      {
        id: "churn",
        label: "Churn (30d)",
        content: (
          <>
            <AnalyticsTable rows={churnRows} />
            <AnalyticsMeter label="Churn rate" value={summary?.churn?.churn_rate_30d} />
          </>
        ),
      },
      {
        id: "feature-adoption",
        label: "Feature adoption",
        content: <AnalyticsTable rows={featureRows} />,
      },
      {
        id: "plan-distribution",
        label: "Plan distribution",
        content: <AnalyticsTable rows={planRows} emptyLabel="No plans" />,
      },
      {
        id: "revenue",
        label: "Revenue",
        content: (
          <>
            <AnalyticsTable
              rows={[
                { label: "Conversion", value: formatPercent(summary?.revenue?.conversion_rate) },
              ]}
            />
            <div className={styles.analyticsSplit}>
              <div>
                <p className={styles.analyticsSectionLabel}>By status</p>
                <AnalyticsTable rows={statusRows} emptyLabel="No transactions" />
              </div>
              <div>
                <p className={styles.analyticsSectionLabel}>By plan (settled)</p>
                <AnalyticsTable rows={revenuePlanRows} emptyLabel="No revenue" />
              </div>
            </div>
          </>
        ),
      },
    ]
    : [];

  const allSections = adminSections;
  const resolvedSectionId =
    selectedSectionId && allSections.some((section) => section.id === selectedSectionId)
      ? selectedSectionId
      : allSections[0]?.id ?? null;
  const selectedSection = allSections.find((section) => section.id === resolvedSectionId) ?? null;

  if (isLoading) {
    return (
      <div className={styles.analyticsView}>
        <div className={styles.analyticsHeader}>
          <p className={styles.analyticsEyebrow}>Private</p>
          <h1 className={styles.analyticsTitle}>Analytics</h1>
          <p className={styles.analyticsSubtitle}>Loading analytics snapshot...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.analyticsView}>
        <div className={styles.analyticsHeader}>
          <p className={styles.analyticsEyebrow}>Private</p>
          <h1 className={styles.analyticsTitle}>Analytics</h1>
          <p className={styles.analyticsSubtitle}>{error}</p>
        </div>
      </div>
    );
  }

  const generatedAtLabel = formatDateTime(summary?.generated_at);

  return (
    <div className={styles.analyticsView}>
      <div className={styles.analyticsHeader}>
        <p className={styles.analyticsEyebrow}>Private</p>
        <h1 className={styles.analyticsTitle}>Analytics</h1>
        <p className={styles.analyticsSubtitle}>
          Generated {generatedAtLabel}
        </p>
      </div>

      {showAdminAnalytics ? (
        <AnalyticsCard title="Affiliate setup">
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
            {createdAffiliateLink ? (
              <div className={styles.analyticsLinkRow}>
                <span className={styles.analyticsTableLabel}>Created link</span>
                <a className={styles.analyticsLink} href={createdAffiliateLink} target="_blank" rel="noreferrer">
                  {createdAffiliateLink}
                </a>
              </div>
            ) : null}
            <div className={styles.analyticsFormActions}>
              <button type="submit" className={styles.analyticsButton} disabled={createPending}>
                {createPending ? "Creating..." : "Create affiliate"}
              </button>
              <button
                type="button"
                className={styles.analyticsButton}
                onClick={handleSeedTestAffiliate}
                disabled={affiliateSeedPending}
              >
                {affiliateSeedPending ? "Seeding test..." : "Seed test affiliate"}
              </button>
              {createError ? <span className={styles.analyticsListEmpty}>{createError}</span> : null}
            </div>
          </form>
        </AnalyticsCard>
      ) : null}

      {showAllSections ? (
        <div className={styles.analyticsControls}>
          <button
            type="button"
            className={styles.analyticsButton}
            onClick={() => setShowAllSections(false)}
          >
            Focus view
          </button>
        </div>
      ) : null}

      <div className={styles.analyticsGrid}>
        {showAllSections
          ? allSections.map((section) => (
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
                    {allSections.map((section) => (
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
            <p className={styles.analyticsListEmpty}>No analytics sections available.</p>
          )}
      </div>
    </div>
  );
}
