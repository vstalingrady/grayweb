"use client";

import { useEffect, useMemo, useState } from "react";

type PlanDistribution = {
  scout: number;
  voyager: number;
  pioneer: number;
  none: number;
};

type UserGrowth = {
  total_users: number;
  plan_distribution: PlanDistribution;
  new_7d: number;
  new_30d: number;
};

type Engagement = {
  dau: number;
  wau: number;
  mau: number;
  total_general_messages: number;
  total_thread_messages: number;
  avg_messages_per_user: number;
};

type FeatureAdoption = {
  users_with_plans: number;
  users_with_habits: number;
  active_reminders: number;
  calendar_events: number;
  push_subscriptions: number;
};

type Retention = {
  avg_streak: number;
  max_streak: number;
  active_today: number;
};

type Revenue = {
  by_status: Record<string, number>;
  by_plan: Record<string, number>;
  conversion_rate: number;
};

type AnalyticsSummary = {
  generated_at: string;
  database_url: string;
  sqlite_path: string | null;
  sqlite_size_bytes: number | null;
  counts: Record<string, number | null>;
  user_growth?: UserGrowth;
  engagement?: Engagement;
  feature_adoption?: FeatureAdoption;
  retention?: Retention;
  revenue?: Revenue;
};

const formatBytes = (bytes: number | null): string => {
  if (!bytes || !Number.isFinite(bytes)) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

// Metric Card Component
const MetricCard = ({
  label,
  value,
  sublabel,
  color = "#111827",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
}) => (
  <div
    style={{
      padding: "1rem",
      background: "white",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      minWidth: 140,
    }}
  >
    <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
    {sublabel && (
      <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 2 }}>{sublabel}</div>
    )}
  </div>
);

// Section Component
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginTop: "1.5rem" }}>
    <h2 style={{ fontSize: "1.1rem", fontWeight: 650, marginBottom: "0.75rem" }}>{title}</h2>
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>{children}</div>
  </div>
);

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"local" | "prod">("local");
  const [showCounts, setShowCounts] = useState(false);

  const fetchSummary = async (nextSource = source) => {
    setLoading(true);
    setError(null);
    try {
      const url =
        nextSource === "prod"
          ? "/api/dev/analytics/prod"
          : "/api/p/dev/analytics/summary";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = (await response.json()) as AnalyticsSummary;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
    const interval = window.setInterval(() => {
      void fetchSummary();
    }, 10_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const sortedCounts = useMemo(() => {
    if (!data) {
      return [];
    }
    return Object.entries(data.counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <main
      style={{
        padding: "1.5rem",
        maxWidth: 1100,
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>📊 Dev Analytics</h1>
      <p style={{ marginTop: "0.35rem", color: "#6b7280" }}>
        {source === "prod" ? "Production database" : "Local database"} • Refreshes every 10s
      </p>

      {/* Controls */}
      <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setSource("local");
            void fetchSummary("local");
          }}
          disabled={loading || source === "local"}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: source === "local" ? "#111827" : "white",
            color: source === "local" ? "white" : "inherit",
            cursor: loading || source === "local" ? "not-allowed" : "pointer",
          }}
        >
          Local
        </button>
        <button
          onClick={() => {
            setSource("prod");
            void fetchSummary("prod");
          }}
          disabled={loading || source === "prod"}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: source === "prod" ? "#111827" : "white",
            color: source === "prod" ? "white" : "inherit",
            cursor: loading || source === "prod" ? "not-allowed" : "pointer",
          }}
        >
          Prod
        </button>
        <button
          onClick={() => void fetchSummary()}
          disabled={loading}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: loading ? "#f3f4f6" : "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        {error ? (
          <span style={{ color: "#b91c1c", alignSelf: "center" }}>{error}</span>
        ) : null}
      </div>

      {data ? (
        <>
          {/* Database Info */}
          <div
            style={{
              marginTop: "1.25rem",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "0.9rem",
              background: "white",
            }}
          >
            <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem" }}>
              <div>
                <strong>Generated:</strong> {new Date(data.generated_at).toLocaleString()}
              </div>
              <div>
                <strong>Database:</strong>{" "}
                <code style={{ fontSize: "0.85rem", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                  {data.database_url.length > 60 ? "..." + data.database_url.slice(-50) : data.database_url}
                </code>
              </div>
              {data.sqlite_path && (
                <div>
                  <strong>SQLite size:</strong> {formatBytes(data.sqlite_size_bytes)}
                </div>
              )}
            </div>
          </div>

          {/* User Growth */}
          {data.user_growth && (
            <Section title="👥 User Growth">
              <MetricCard label="Total Users" value={data.user_growth.total_users.toLocaleString()} />
              <MetricCard
                label="New (7 days)"
                value={data.user_growth.new_7d.toLocaleString()}
                color="#059669"
              />
              <MetricCard
                label="New (30 days)"
                value={data.user_growth.new_30d.toLocaleString()}
                color="#0284c7"
              />
              <MetricCard
                label="Scout"
                value={data.user_growth.plan_distribution.scout}
                sublabel="Free tier"
              />
              <MetricCard
                label="Voyager"
                value={data.user_growth.plan_distribution.voyager}
                sublabel="Mid tier"
                color="#7c3aed"
              />
              <MetricCard
                label="Pioneer"
                value={data.user_growth.plan_distribution.pioneer}
                sublabel="Top tier"
                color="#c026d3"
              />
            </Section>
          )}

          {/* Engagement */}
          {data.engagement && (
            <Section title="💬 Engagement">
              <MetricCard label="DAU" value={data.engagement.dau} sublabel="Today" color="#dc2626" />
              <MetricCard label="WAU" value={data.engagement.wau} sublabel="7 days" color="#ea580c" />
              <MetricCard label="MAU" value={data.engagement.mau} sublabel="30 days" color="#d97706" />
              <MetricCard
                label="Avg Msgs/User"
                value={data.engagement.avg_messages_per_user.toFixed(1)}
              />
              <MetricCard
                label="General Chat"
                value={data.engagement.total_general_messages.toLocaleString()}
                sublabel="messages"
              />
              <MetricCard
                label="Thread Chat"
                value={data.engagement.total_thread_messages.toLocaleString()}
                sublabel="messages"
              />
            </Section>
          )}

          {/* Feature Adoption */}
          {data.feature_adoption && (
            <Section title="🎯 Feature Adoption">
              <MetricCard
                label="Using Plans"
                value={data.feature_adoption.users_with_plans}
                sublabel="users"
              />
              <MetricCard
                label="Using Habits"
                value={data.feature_adoption.users_with_habits}
                sublabel="users"
              />
              <MetricCard
                label="Active Reminders"
                value={data.feature_adoption.active_reminders}
                sublabel="pending"
              />
              <MetricCard
                label="Calendar Events"
                value={data.feature_adoption.calendar_events}
              />
              <MetricCard
                label="Push Subscriptions"
                value={data.feature_adoption.push_subscriptions}
                sublabel="users"
              />
            </Section>
          )}

          {/* Retention */}
          {data.retention && (
            <Section title="🔥 Retention">
              <MetricCard
                label="Avg Streak"
                value={data.retention.avg_streak.toFixed(1)}
                sublabel="days"
              />
              <MetricCard
                label="Max Streak"
                value={data.retention.max_streak}
                sublabel="days"
                color="#059669"
              />
              <MetricCard
                label="Active Today"
                value={data.retention.active_today}
                sublabel="users"
              />
            </Section>
          )}

          {/* Revenue */}
          {data.revenue && Object.keys(data.revenue.by_status).length > 0 && (
            <Section title="💰 Revenue">
              <MetricCard
                label="Conversion Rate"
                value={`${(data.revenue.conversion_rate * 100).toFixed(1)}%`}
                color={data.revenue.conversion_rate > 0.1 ? "#059669" : "#dc2626"}
              />
              {Object.entries(data.revenue.by_status).map(([status, count]) => (
                <MetricCard
                  key={status}
                  label={status.charAt(0).toUpperCase() + status.slice(1)}
                  value={count}
                  sublabel="transactions"
                />
              ))}
              {Object.entries(data.revenue.by_plan).map(([plan, amount]) => (
                <MetricCard
                  key={plan}
                  label={`${plan.charAt(0).toUpperCase() + plan.slice(1)} Revenue`}
                  value={formatCurrency(amount)}
                  color="#059669"
                />
              ))}
            </Section>
          )}

          {/* Table Counts (Collapsible) */}
          <div style={{ marginTop: "1.5rem" }}>
            <button
              onClick={() => setShowCounts(!showCounts)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "1.1rem",
                fontWeight: 650,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span style={{ transform: showCounts ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                ▶
              </span>
              Table Counts
            </button>
            {showCounts && (
              <div
                style={{
                  marginTop: "0.5rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "white",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={{ textAlign: "left", padding: "0.6rem 0.75rem" }}>Table</th>
                      <th style={{ textAlign: "right", padding: "0.6rem 0.75rem" }}>Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCounts.map(([name, count]) => (
                      <tr key={name} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "0.6rem 0.75rem" }}>
                          <code>{name}</code>
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                          {typeof count === "number" ? count.toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}
