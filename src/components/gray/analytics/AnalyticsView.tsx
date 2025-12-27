"use client";

import { useEffect, useState } from "react";
import {
  analyticsService,
  ApiError,
  type AnalyticsSummary,
  type AffiliateAnalyticsSummary,
  type AffiliateDirectoryResponse,
} from "@/lib/api";
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
  defaultOpen?: boolean;
};

const AnalyticsCard = ({ title, children, defaultOpen = true }: AnalyticsCardProps) => (
  <details className={styles.analyticsCard} open={defaultOpen}>
    <summary className={styles.analyticsCardSummary}>
      <h3 className={styles.analyticsCardTitle}>{title}</h3>
      <span className={styles.analyticsCardChevron} aria-hidden="true" />
    </summary>
    <div className={styles.analyticsCardBody}>{children}</div>
  </details>
);

type AnalyticsTableRow = {
  label: string;
  value: string;
};

const AnalyticsTable = ({ rows, emptyLabel = "No data" }: { rows: AnalyticsTableRow[]; emptyLabel?: string }) => {
  if (!rows.length) {
    return <p className={styles.analyticsListEmpty}>{emptyLabel}</p>;
  }

  return (
    <table className={styles.analyticsTable}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th className={styles.analyticsTableLabel}>{row.label}</th>
            <td className={styles.analyticsTableValue}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

type AnalyticsMatrixColumn = {
  key: string;
  label: string;
};

type AnalyticsMatrixRow = {
  key: string;
  values: Record<string, string>;
};

const AnalyticsMatrix = ({
  columns,
  rows,
  emptyLabel = "No data",
}: {
  columns: AnalyticsMatrixColumn[];
  rows: AnalyticsMatrixRow[];
  emptyLabel?: string;
}) => {
  if (!rows.length) {
    return <p className={styles.analyticsListEmpty}>{emptyLabel}</p>;
  }

  return (
    <table className={styles.analyticsMatrix}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={styles.analyticsMatrixHeader}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {columns.map((column, index) => {
              const value = row.values[column.key] ?? "—";
              return index === 0 ? (
                <th key={`${row.key}-${column.key}`} className={styles.analyticsMatrixRowLabel}>
                  {value}
                </th>
              ) : (
                <td key={`${row.key}-${column.key}`} className={styles.analyticsMatrixCell}>
                  {value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
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
      <div className={styles.analyticsChartCanvas}>
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
              <path
                className={styles.analyticsChartLine}
                d={buildPath(entry.values)}
                stroke={entry.color}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {entry.values.map((value, index) => {
                const point = resolvePoint(value, index);
                return (
                  <circle
                    key={`${entry.label}-${index}`}
                    className={styles.analyticsChartDot}
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill={entry.color}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

export function AnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [affiliateSummary, setAffiliateSummary] = useState<AffiliateAnalyticsSummary | null>(null);
  const [affiliateDirectory, setAffiliateDirectory] = useState<AffiliateDirectoryResponse | null>(null);
  const [selectedAffiliateCode, setSelectedAffiliateCode] = useState<string | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateActionError, setAffiliateActionError] = useState<string | null>(null);
  const [affiliateSeedPending, setAffiliateSeedPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const [summaryResult, affiliateResult, directoryResult] = await Promise.allSettled([
          analyticsService.getAnalyticsSummary(),
          analyticsService.getAffiliateSummary(),
          analyticsService.getAffiliateDirectory(),
        ]);

        if (cancelled) {
          return;
        }

        let initialAffiliateSummary: AffiliateAnalyticsSummary | null = null;
        let initialDirectory: AffiliateDirectoryResponse | null = null;

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
        }

        if (affiliateResult.status === "fulfilled") {
          initialAffiliateSummary = affiliateResult.value;
          setAffiliateSummary(initialAffiliateSummary);
        }

        if (directoryResult.status === "fulfilled") {
          initialDirectory = directoryResult.value;
          setAffiliateDirectory(initialDirectory);
        }

        const initialCode =
          initialAffiliateSummary?.affiliate.code ??
          initialDirectory?.affiliates?.[0]?.code ??
          null;
        if (initialCode) {
          setSelectedAffiliateCode(initialCode);
        }

        const hasSummary = summaryResult.status === "fulfilled";
        const hasAffiliate = affiliateResult.status === "fulfilled";
        const hasDirectory = directoryResult.status === "fulfilled";
        if (!hasSummary && !hasAffiliate && !hasDirectory) {
          const errorCandidate =
            summaryResult.status === "rejected"
              ? summaryResult.reason
              : affiliateResult.status === "rejected"
                ? affiliateResult.reason
                : directoryResult.reason;
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

  useEffect(() => {
    if (!affiliateDirectory || !selectedAffiliateCode) {
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
  }, [affiliateDirectory, selectedAffiliateCode, affiliateSummary?.affiliate.code]);

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
              <AnalyticsTable rows={userGrowthRows} />
              <AnalyticsMeter label="Paid share" value={paidShare} />
            </AnalyticsCard>

            <AnalyticsCard title="Trends (6 mo)">
              {showAdminChart ? <LineChart xLabels={adminMonths} series={adminSeries} /> : null}
              <AnalyticsMatrix
                columns={adminMatrixColumns}
                rows={adminMatrixRows}
                emptyLabel="No trend data yet."
              />
            </AnalyticsCard>

            <AnalyticsCard title="Engagement">
              <AnalyticsTable rows={engagementRows} />
            </AnalyticsCard>

            <AnalyticsCard title="Churn (30d)">
              <AnalyticsTable rows={churnRows} />
              <AnalyticsMeter label="Churn rate" value={summary?.churn?.churn_rate_30d} />
            </AnalyticsCard>

            <AnalyticsCard title="Feature adoption">
              <AnalyticsTable rows={featureRows} />
            </AnalyticsCard>

            <AnalyticsCard title="Plan distribution">
              <AnalyticsTable rows={planRows} emptyLabel="No plans" />
            </AnalyticsCard>

            <AnalyticsCard title="Revenue">
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
            </AnalyticsCard>
          </>
        ) : null}

        {affiliateSummary || hasAffiliateDirectory ? (
          <>
            <AnalyticsCard title="Affiliate performance">
              {hasAffiliateDirectory ? (
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
              ) : null}
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
            </AnalyticsCard>

            <AnalyticsCard title="Affiliate growth (6 mo)">
              {showAffiliateChart ? <LineChart xLabels={affiliateMonths} series={affiliateSeries} /> : null}
              <AnalyticsMatrix
                columns={affiliateMatrixColumns}
                rows={affiliateMatrixRows}
                emptyLabel="No affiliate history yet."
              />
            </AnalyticsCard>

            <AnalyticsCard title="Affiliate pipeline (6 mo)">
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
              <AnalyticsMatrix
                columns={affiliateRevenueColumns}
                rows={affiliateRevenueRows}
                emptyLabel="No affiliate revenue yet."
              />
            </AnalyticsCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
