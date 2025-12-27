"use client";

import { useEffect, useMemo, useState } from "react";
import { analyticsService, ApiError, type AnalyticsSummary } from "@/lib/api";
import styles from "./AnalyticsView.module.css";

const numberFormatter = new Intl.NumberFormat("en-US");

const formatCount = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return numberFormatter.format(value);
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${Math.round(value * 1000) / 10}%`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

type AnalyticsCardProps = {
  title: string;
  children: React.ReactNode;
};

const AnalyticsCard = ({ title, children }: AnalyticsCardProps) => (
  <section className={styles.analyticsCard}>
    <h3 className={styles.analyticsCardTitle}>{title}</h3>
    {children}
  </section>
);

type AnalyticsStatProps = {
  label: string;
  value: string;
};

const AnalyticsStat = ({ label, value }: AnalyticsStatProps) => (
  <div className={styles.analyticsStat}>
    <span className={styles.analyticsStatLabel}>{label}</span>
    <span className={styles.analyticsStatValue}>{value}</span>
  </div>
);

export function AnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const result = await analyticsService.getAnalyticsSummary();
        if (!cancelled) {
          setSummary(result);
          setError(null);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setError("Access restricted.");
        } else {
          setError("Failed to load analytics.");
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

  const planDistribution = summary?.user_growth?.plan_distribution ?? {};
  const planOrder = ["scout", "pathfinder", "voyager", "pioneer", "none"];
  const planEntries = useMemo(() => {
    return planOrder
      .map((key) => ({ key, value: planDistribution[key] ?? 0 }))
      .filter((entry) => entry.value > 0 || entry.key !== "none");
  }, [planDistribution]);

  const paidUsers = useMemo(() => {
    return (planDistribution.pathfinder ?? 0) + (planDistribution.voyager ?? 0) + (planDistribution.pioneer ?? 0);
  }, [planDistribution]);

  const statusEntries = useMemo(() => {
    const byStatus = summary?.revenue?.by_status ?? {};
    return Object.entries(byStatus).map(([key, value]) => ({ key, value: value ?? 0 }));
  }, [summary]);

  const revenuePlanEntries = useMemo(() => {
    const byPlan = summary?.revenue?.by_plan ?? {};
    return Object.entries(byPlan).map(([key, value]) => ({ key, value: value ?? 0 }));
  }, [summary]);

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

  return (
    <div className={styles.analyticsView}>
      <div className={styles.analyticsHeader}>
        <p className={styles.analyticsEyebrow}>Private</p>
        <h1 className={styles.analyticsTitle}>Analytics</h1>
        <p className={styles.analyticsSubtitle}>
          Generated {formatDateTime(summary?.generated_at)}
        </p>
      </div>

      <div className={styles.analyticsGrid}>
        <AnalyticsCard title="User growth">
          <div className={styles.analyticsStatList}>
            <AnalyticsStat label="Total users" value={formatCount(summary?.user_growth?.total_users)} />
            <AnalyticsStat label="Paid users" value={formatCount(paidUsers)} />
            <AnalyticsStat label="New (7d)" value={formatCount(summary?.user_growth?.new_7d)} />
            <AnalyticsStat label="New (30d)" value={formatCount(summary?.user_growth?.new_30d)} />
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Engagement">
          <div className={styles.analyticsStatList}>
            <AnalyticsStat label="DAU" value={formatCount(summary?.engagement?.dau)} />
            <AnalyticsStat label="WAU" value={formatCount(summary?.engagement?.wau)} />
            <AnalyticsStat label="MAU" value={formatCount(summary?.engagement?.mau)} />
            <AnalyticsStat label="Avg msgs / user" value={formatCount(summary?.engagement?.avg_messages_per_user)} />
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Churn (30d)">
          <div className={styles.analyticsStatList}>
            <AnalyticsStat label="Eligible users" value={formatCount(summary?.churn?.eligible_30d)} />
            <AnalyticsStat label="Active users" value={formatCount(summary?.churn?.active_30d)} />
            <AnalyticsStat label="Inactive users" value={formatCount(summary?.churn?.inactive_30d)} />
            <AnalyticsStat label="Churn rate" value={formatPercent(summary?.churn?.churn_rate_30d)} />
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Feature adoption">
          <div className={styles.analyticsStatList}>
            <AnalyticsStat label="Users with plans" value={formatCount(summary?.feature_adoption?.users_with_plans)} />
            <AnalyticsStat label="Users with habits" value={formatCount(summary?.feature_adoption?.users_with_habits)} />
            <AnalyticsStat label="Active reminders" value={formatCount(summary?.feature_adoption?.active_reminders)} />
            <AnalyticsStat label="Calendar events" value={formatCount(summary?.feature_adoption?.calendar_events)} />
            <AnalyticsStat label="Push subs" value={formatCount(summary?.feature_adoption?.push_subscriptions)} />
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Plan distribution">
          <ul className={styles.analyticsList}>
            {planEntries.map((entry) => (
              <li key={entry.key} className={styles.analyticsListItem}>
                <span className={styles.analyticsListLabel}>{entry.key}</span>
                <span className={styles.analyticsListValue}>{formatCount(entry.value)}</span>
              </li>
            ))}
          </ul>
        </AnalyticsCard>

        <AnalyticsCard title="Revenue">
          <div className={styles.analyticsStatList}>
            <AnalyticsStat label="Conversion" value={formatPercent(summary?.revenue?.conversion_rate)} />
          </div>
          <div className={styles.analyticsSplit}>
            <div>
              <p className={styles.analyticsSectionLabel}>By status</p>
              <ul className={styles.analyticsList}>
                {statusEntries.length > 0 ? (
                  statusEntries.map((entry) => (
                    <li key={entry.key} className={styles.analyticsListItem}>
                      <span className={styles.analyticsListLabel}>{entry.key}</span>
                      <span className={styles.analyticsListValue}>{formatCount(entry.value)}</span>
                    </li>
                  ))
                ) : (
                  <li className={styles.analyticsListEmpty}>No transactions</li>
                )}
              </ul>
            </div>
            <div>
              <p className={styles.analyticsSectionLabel}>By plan (settled)</p>
              <ul className={styles.analyticsList}>
                {revenuePlanEntries.length > 0 ? (
                  revenuePlanEntries.map((entry) => (
                    <li key={entry.key} className={styles.analyticsListItem}>
                      <span className={styles.analyticsListLabel}>{entry.key}</span>
                      <span className={styles.analyticsListValue}>{formatCount(entry.value)}</span>
                    </li>
                  ))
                ) : (
                  <li className={styles.analyticsListEmpty}>No revenue</li>
                )}
              </ul>
            </div>
          </div>
        </AnalyticsCard>
      </div>
    </div>
  );
}
