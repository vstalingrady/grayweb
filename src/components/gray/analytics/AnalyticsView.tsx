"use client";

import { useEffect, useState } from "react";
import { analyticsService, ApiError, type AnalyticsSummary, type AffiliateAnalyticsSummary } from "@/lib/api";
import styles from "./AnalyticsView.module.css";

const numberFormatter = new Intl.NumberFormat("en-US");
const PLAN_ORDER = ["scout", "pathfinder", "voyager", "pioneer", "none"];

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

const formatMonthLabel = (value: string) => {
  const [year, month] = value.split("-");
  const monthIndex = Number(month) - 1;
  if (!Number.isFinite(monthIndex)) {
    return value;
  }
  const date = new Date(Number(year), monthIndex, 1);
  return date.toLocaleString("en-US", { month: "short" });
};

const formatCurrencyAmount = (value: number, currency: string) => {
  const normalized = currency.toUpperCase();
  if (normalized === "USD") {
    return `$${(value / 100).toFixed(2)}`;
  }
  if (normalized === "IDR") {
    return `Rp ${numberFormatter.format(value)}`;
  }
  return numberFormatter.format(value);
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

type AnalyticsBarEntry = {
  label: string;
  value: number;
  valueLabel?: string;
};

type AnalyticsBarListProps = {
  entries: AnalyticsBarEntry[];
  emptyLabel?: string;
};

const AnalyticsBarList = ({ entries, emptyLabel = "No data" }: AnalyticsBarListProps) => {
  if (entries.length === 0) {
    return <p className={styles.analyticsListEmpty}>{emptyLabel}</p>;
  }

  const maxValue = Math.max(1, ...entries.map((entry) => entry.value));

  return (
    <div className={styles.analyticsBarList}>
      {entries.map((entry) => {
        const width = Math.round((entry.value / maxValue) * 1000) / 10;
        return (
          <div key={entry.label} className={styles.analyticsBarRow}>
            <div className={styles.analyticsBarHeader}>
              <span className={styles.analyticsBarLabel}>{entry.label}</span>
              <span className={styles.analyticsBarValue}>{entry.valueLabel ?? formatCount(entry.value)}</span>
            </div>
            <div className={styles.analyticsBarTrack}>
              <div className={styles.analyticsBarFill} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

type AnalyticsMeterProps = {
  label: string;
  value?: number | null;
  valueLabel?: string;
};

const AnalyticsMeter = ({ label, value, valueLabel }: AnalyticsMeterProps) => {
  const resolvedValue = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className={styles.analyticsMeter}>
      <div className={styles.analyticsBarHeader}>
        <span className={styles.analyticsBarLabel}>{label}</span>
        <span className={styles.analyticsBarValue}>{valueLabel ?? formatPercent(resolvedValue)}</span>
      </div>
      <div className={styles.analyticsMeterTrack}>
        <div className={styles.analyticsMeterFill} style={{ width: `${resolvedValue * 100}%` }} />
      </div>
    </div>
  );
};

type LineChartSeries = {
  label: string;
  values: number[];
  color: string;
};

type LineChartProps = {
  xLabels: string[];
  series: LineChartSeries[];
  height?: number;
  formatTick?: (value: number) => string;
};

const LineChart = ({ xLabels, series, height = 200, formatTick = formatCount }: LineChartProps) => {
  const width = 640;
  const padding = { top: 20, right: 24, bottom: 32, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...series.flatMap((entry) => entry.values));
  const pointsCount = Math.max(1, xLabels.length);
  const stepX = pointsCount > 1 ? plotWidth / (pointsCount - 1) : 0;

  const resolvePoint = (value: number, index: number) => {
    const x = padding.left + stepX * index;
    const ratio = maxValue > 0 ? value / maxValue : 0;
    const y = padding.top + (1 - ratio) * plotHeight;
    return { x, y };
  };

  const buildPath = (values: number[]) => {
    return values
      .map((value, index) => {
        const point = resolvePoint(value, index);
        return `${index === 0 ? "M" : "L"}${point.x},${point.y}`;
      })
      .join(" ");
  };

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const ratio = index / tickCount;
    const y = padding.top + ratio * plotHeight;
    const value = Math.round((1 - ratio) * maxValue);
    return { y, value };
  });

  const labelIndices = new Set<number>();
  if (xLabels.length <= 5) {
    xLabels.forEach((_, index) => labelIndices.add(index));
  } else {
    labelIndices.add(0);
    labelIndices.add(Math.floor((xLabels.length - 1) / 2));
    labelIndices.add(xLabels.length - 1);
  }

  return (
    <div className={styles.analyticsChart}>
      <div className={styles.analyticsChartLegend}>
        {series.map((entry) => (
          <div key={entry.label} className={styles.analyticsChartLegendItem}>
            <span className={styles.analyticsChartSwatch} style={{ background: entry.color }} />
            <span>{entry.label}</span>
          </div>
        ))}
      </div>
      <svg
        className={styles.analyticsChartSvg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Analytics chart"
      >
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              className={styles.analyticsChartGrid}
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
            />
            <text
              className={styles.analyticsChartLabel}
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
            >
              {formatTick(tick.value)}
            </text>
          </g>
        ))}
        <line
          className={styles.analyticsChartAxis}
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
        />
        <line
          className={styles.analyticsChartAxis}
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
        />

        {xLabels.map((label, index) =>
          labelIndices.has(index) ? (
            <text
              key={label}
              className={styles.analyticsChartLabel}
              x={padding.left + stepX * index}
              y={height - 8}
              textAnchor="middle"
            >
              {label}
            </text>
          ) : null
        )}

        {series.map((entry) => (
          <g key={entry.label}>
            <path className={styles.analyticsChartLine} d={buildPath(entry.values)} stroke={entry.color} />
            {entry.values.map((value, index) => {
              const point = resolvePoint(value, index);
              return (
                <circle
                  key={`${entry.label}-${index}`}
                  className={styles.analyticsChartDot}
                  cx={point.x}
                  cy={point.y}
                  r={3}
                  fill={entry.color}
                />
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
};

export function AnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [affiliateSummary, setAffiliateSummary] = useState<AffiliateAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const [summaryResult, affiliateResult] = await Promise.allSettled([
          analyticsService.getAnalyticsSummary(),
          analyticsService.getAffiliateSummary(),
        ]);

        if (cancelled) {
          return;
        }

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
        }

        if (affiliateResult.status === "fulfilled") {
          setAffiliateSummary(affiliateResult.value);
        }

        const hasSummary = summaryResult.status === "fulfilled";
        const hasAffiliate = affiliateResult.status === "fulfilled";
        if (!hasSummary && !hasAffiliate) {
          const errorCandidate =
            summaryResult.status === "rejected" ? summaryResult.reason : affiliateResult.reason;
          if (errorCandidate instanceof ApiError && (errorCandidate.status === 403 || errorCandidate.status === 404)) {
            setError("Access restricted.");
          } else {
            setError("Failed to load analytics.");
          }
        } else {
          setError(null);
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
  const planEntries = PLAN_ORDER
    .map((key) => ({ key, value: planDistribution[key] ?? 0 }))
    .filter((entry) => entry.value > 0 || entry.key !== "none");

  const paidUsers =
    (planDistribution.pathfinder ?? 0) + (planDistribution.voyager ?? 0) + (planDistribution.pioneer ?? 0);

  const totalUsers = summary?.user_growth?.total_users ?? 0;
  const paidShare = totalUsers > 0 ? paidUsers / totalUsers : 0;

  const engagementEntries = [
    { label: "DAU", value: summary?.engagement?.dau ?? 0 },
    { label: "WAU", value: summary?.engagement?.wau ?? 0 },
    { label: "MAU", value: summary?.engagement?.mau ?? 0 },
  ];

  const statusEntries = Object.entries(summary?.revenue?.by_status ?? {}).map(([key, value]) => ({
    key,
    value: value ?? 0,
  }));

  const revenuePlanEntries = Object.entries(summary?.revenue?.by_plan ?? {}).map(([key, value]) => ({
    key,
    value: value ?? 0,
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

  const affiliateTimeline = affiliateSummary?.timeline ?? [];
  const affiliateMonths = affiliateTimeline.map((entry) => formatMonthLabel(entry.month));
  const affiliateSignupsEntries = affiliateTimeline.map((entry) => ({
    label: formatMonthLabel(entry.month),
    value: entry.signups,
  }));
  const affiliateConversionEntries = affiliateTimeline.map((entry) => ({
    label: formatMonthLabel(entry.month),
    value: entry.conversions,
  }));

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

  const affiliateCurrencyEntries = Object.entries(
    affiliateSummary?.summary?.currency_breakdown ?? {}
  ).map(([currency, values]) => ({
    currency,
    grossRevenue: values.gross_revenue,
    commissionOwed: values.commission_owed,
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

  const generatedAtLabel = formatDateTime(summary?.generated_at ?? affiliateSummary?.generated_at);
  const showAdminAnalytics = Boolean(summary);

  return (
    <div className={styles.analyticsView}>
      <div className={styles.analyticsHeader}>
        <p className={styles.analyticsEyebrow}>Private</p>
        <h1 className={styles.analyticsTitle}>Analytics</h1>
        <p className={styles.analyticsSubtitle}>
          Generated {generatedAtLabel}
        </p>
      </div>

      <div className={styles.analyticsGrid}>
        {showAdminAnalytics ? (
          <>
            <AnalyticsCard title="User growth">
              <div className={styles.analyticsStatList}>
                <AnalyticsStat label="Total users" value={formatCount(summary?.user_growth?.total_users)} />
                <AnalyticsStat label="Paid users" value={formatCount(paidUsers)} />
                <AnalyticsStat label="New (7d)" value={formatCount(summary?.user_growth?.new_7d)} />
                <AnalyticsStat label="New (30d)" value={formatCount(summary?.user_growth?.new_30d)} />
              </div>
              <AnalyticsMeter label="Paid share" value={paidShare} />
            </AnalyticsCard>

            {showAdminChart ? (
              <AnalyticsCard title="Trends (6 mo)">
                <LineChart xLabels={adminMonths} series={adminSeries} />
              </AnalyticsCard>
            ) : null}

            <AnalyticsCard title="Engagement">
              <div className={styles.analyticsStatList}>
                <AnalyticsStat label="DAU" value={formatCount(summary?.engagement?.dau)} />
                <AnalyticsStat label="WAU" value={formatCount(summary?.engagement?.wau)} />
                <AnalyticsStat label="MAU" value={formatCount(summary?.engagement?.mau)} />
                <AnalyticsStat label="Avg msgs / user" value={formatCount(summary?.engagement?.avg_messages_per_user)} />
              </div>
              <AnalyticsBarList
                entries={engagementEntries.map((entry) => ({
                  label: entry.label,
                  value: entry.value,
                }))}
              />
            </AnalyticsCard>

            <AnalyticsCard title="Churn (30d)">
              <div className={styles.analyticsStatList}>
                <AnalyticsStat label="Eligible users" value={formatCount(summary?.churn?.eligible_30d)} />
                <AnalyticsStat label="Active users" value={formatCount(summary?.churn?.active_30d)} />
                <AnalyticsStat label="Inactive users" value={formatCount(summary?.churn?.inactive_30d)} />
                <AnalyticsStat label="Churn rate" value={formatPercent(summary?.churn?.churn_rate_30d)} />
              </div>
              <AnalyticsMeter label="Churn rate" value={summary?.churn?.churn_rate_30d} />
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
              <AnalyticsBarList
                entries={planEntries.map((entry) => ({
                  label: entry.key,
                  value: entry.value,
                }))}
                emptyLabel="No plans"
              />
            </AnalyticsCard>

            <AnalyticsCard title="Revenue">
              <div className={styles.analyticsStatList}>
                <AnalyticsStat label="Conversion" value={formatPercent(summary?.revenue?.conversion_rate)} />
              </div>
              <div className={styles.analyticsSplit}>
                <div>
                  <p className={styles.analyticsSectionLabel}>By status</p>
                  <AnalyticsBarList
                    entries={statusEntries.map((entry) => ({
                      label: entry.key,
                      value: entry.value,
                    }))}
                    emptyLabel="No transactions"
                  />
                </div>
                <div>
                  <p className={styles.analyticsSectionLabel}>By plan (settled)</p>
                  <AnalyticsBarList
                    entries={revenuePlanEntries.map((entry) => ({
                      label: entry.key,
                      value: entry.value,
                    }))}
                    emptyLabel="No revenue"
                  />
                </div>
              </div>
            </AnalyticsCard>
          </>
        ) : null}

        {affiliateSummary ? (
          <>
            <AnalyticsCard title="Affiliate performance">
              <div className={styles.analyticsStatList}>
                <AnalyticsStat label="Affiliate code" value={affiliateSummary.affiliate.code} />
                <AnalyticsStat
                  label="Commission rate"
                  value={formatPercent(affiliateSummary.affiliate.commission_rate)}
                />
                <AnalyticsStat
                  label="Discount rate"
                  value={formatPercent(affiliateSummary.affiliate.discount_rate)}
                />
                <AnalyticsStat label="Signups" value={formatCount(affiliateSummary.summary.signups)} />
                <AnalyticsStat label="Conversions" value={formatCount(affiliateSummary.summary.conversions)} />
                <AnalyticsStat
                  label="Active (6 mo)"
                  value={formatCount(affiliateSummary.summary.active_conversions)}
                />
              </div>
              <div className={styles.analyticsLinkRow}>
                <span className={styles.analyticsStatLabel}>Share link</span>
                <a
                  className={styles.analyticsLink}
                  href={affiliateSummary.affiliate.share_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {affiliateSummary.affiliate.share_url}
                </a>
              </div>
              {affiliateCurrencyEntries.length ? (
                <div className={styles.analyticsSplit}>
                  {affiliateCurrencyEntries.map((entry) => (
                    <div key={entry.currency}>
                      <p className={styles.analyticsSectionLabel}>{entry.currency} totals</p>
                      <div className={styles.analyticsStatList}>
                        <AnalyticsStat
                          label="Gross revenue"
                          value={formatCurrencyAmount(entry.grossRevenue, entry.currency)}
                        />
                        <AnalyticsStat
                          label="Commission owed"
                          value={formatCurrencyAmount(entry.commissionOwed, entry.currency)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </AnalyticsCard>

            {showAffiliateChart ? (
              <AnalyticsCard title="Affiliate growth (6 mo)">
                <LineChart xLabels={affiliateMonths} series={affiliateSeries} />
              </AnalyticsCard>
            ) : null}

            <AnalyticsCard title="Affiliate pipeline (6 mo)">
              <div className={styles.analyticsSplit}>
                <div>
                  <p className={styles.analyticsSectionLabel}>Signups</p>
                  <AnalyticsBarList entries={affiliateSignupsEntries} emptyLabel="No signups yet" />
                </div>
                <div>
                  <p className={styles.analyticsSectionLabel}>Conversions</p>
                  <AnalyticsBarList entries={affiliateConversionEntries} emptyLabel="No conversions yet" />
                </div>
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Affiliate revenue (6 mo)">
              {showAffiliateRevenueChart ? (
                <LineChart
                  xLabels={affiliateMonths}
                  series={affiliateRevenueSeries}
                  formatTick={(value) =>
                    affiliateRevenueCurrency ? formatCurrencyAmount(value, affiliateRevenueCurrency) : formatCount(value)
                  }
                />
              ) : (
                <p className={styles.analyticsListEmpty}>
                  Revenue charts show when a single billing currency is used.
                </p>
              )}
            </AnalyticsCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
