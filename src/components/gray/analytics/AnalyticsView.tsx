"use client";

import { useEffect, useState } from "react";
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
