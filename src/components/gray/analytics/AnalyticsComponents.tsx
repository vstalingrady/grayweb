"use client";

import styles from "./AnalyticsView.module.css";

const numberFormatter = new Intl.NumberFormat("en-US");

export const formatCount = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return numberFormatter.format(value);
};

export const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${Math.round(value * 1000) / 10}%`;
};

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const formatMonthLabel = (value: string) => {
  const [year, month] = value.split("-");
  const monthIndex = Number(month) - 1;
  if (!Number.isFinite(monthIndex)) {
    return value;
  }
  const date = new Date(Number(year), monthIndex, 1);
  return date.toLocaleString("en-US", { month: "short" });
};

export const formatCurrencyAmount = (value: number, currency: string) => {
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
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  headerClassName?: string;
};

export const AnalyticsCard = ({ title, children, actions, className, headerClassName }: AnalyticsCardProps) => (
  <section className={[styles.analyticsCard, className].filter(Boolean).join(" ")}>
    {title || actions ? (
      <div className={[styles.analyticsCardHeader, headerClassName].filter(Boolean).join(" ")}>
        {title ? <h3 className={styles.analyticsCardTitle}>{title}</h3> : null}
        {actions ?? null}
      </div>
    ) : null}
    <div className={styles.analyticsCardBody}>{children}</div>
  </section>
);

type AnalyticsTableRow = {
  label: string;
  value: string;
};

export const AnalyticsTable = ({ rows, emptyLabel = "No data" }: { rows: AnalyticsTableRow[]; emptyLabel?: string }) => {
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

export const AnalyticsMatrix = ({
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

export type AnalyticsSection = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type AnalyticsMeterProps = {
  label: string;
  value?: number | null;
  valueLabel?: string;
};

export const AnalyticsMeter = ({ label, value, valueLabel }: AnalyticsMeterProps) => {
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

export const LineChart = ({ xLabels, series, height = 200, formatTick = formatCount }: LineChartProps) => {
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
