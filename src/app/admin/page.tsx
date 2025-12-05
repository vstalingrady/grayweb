import type { Metadata } from "next";
import { resolveApiBaseUrl } from "@/lib/api";

type AdminMetrics = {
  generated_at?: string;
  totals?: { users?: number };
  messages?: { today?: number };
  errors?: {
    since?: string | null;
    error_log_entries?: number;
    client_server_like_errors?: number;
    http_error_entries?: number;
    app_log_path?: string;
    error_log_path?: string;
  };
  latency?: {
    count?: number;
    p50_ms?: number | null;
    p95_ms?: number | null;
    under_5s_ratio?: number | null;
    log_path?: string;
    sample_since?: string | null;
  };
  manual_checks?: Record<string, string>;
};

const numberFormatter = new Intl.NumberFormat("en-US");

const formatCount = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return numberFormatter.format(value);
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 1000) / 10}%`;
};

const formatMs = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)} ms`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

async function loadMetrics(): Promise<AdminMetrics | null> {
  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/admin/metrics`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AdminMetrics;
  } catch (error) {
    console.error("[admin] Failed to load metrics", error);
    return null;
  }
}

async function checkAdminAccess(): Promise<boolean> {
  try {
    const { readServerSession } = await import("@/lib/auth/server");
    const { cookies } = await import("next/headers");

    const session = await readServerSession();
    if (!session?.email) {
      return false;
    }

    // Check if user has admin role by fetching from API
    const cookieStore = await cookies();
    const authToken = cookieStore.get("gray-auth-token")?.value;

    if (!authToken) {
      return false;
    }

    const baseUrl = resolveApiBaseUrl();
    const response = await fetch(`${baseUrl}/admin/metrics`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

type MetricCardProps = {
  title: string;
  value: string;
  caption?: string;
  accent?: string;
};

const MetricCard = ({ title, value, caption, accent }: MetricCardProps) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30 backdrop-blur">
    <p className="text-sm text-gray-400">{title}</p>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-3xl font-semibold text-white">{value}</span>
      {accent ? <span className="text-xs uppercase tracking-wide text-gray-400">{accent}</span> : null}
    </div>
    {caption ? <p className="mt-2 text-xs text-gray-400">{caption}</p> : null}
  </div>
);

export const metadata: Metadata = {
  title: "Admin Snapshot",
};

// This page depends on live backend data; keep it dynamic.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  // Import notFound here to avoid issues with metadata export
  const { notFound } = await import("next/navigation");

  // Check admin access first - return 404 for unauthorized users
  const hasAccess = await checkAdminAccess();
  if (!hasAccess) {
    notFound();
  }

  const metrics = await loadMetrics();
  const backendHealthy = Boolean(metrics);

  const totalUsers = metrics?.totals?.users ?? null;
  const messagesToday = metrics?.messages?.today ?? null;
  const errorTotal = metrics?.errors?.client_server_like_errors ?? metrics?.errors?.error_log_entries ?? null;
  const latencyRatio = metrics?.latency?.under_5s_ratio ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-gray-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Local-only</p>
            <h1 className="text-3xl font-semibold text-white">Admin Snapshot</h1>
            <p className="text-sm text-gray-400">
              Generated {metrics?.generated_at ? formatDateTime(metrics.generated_at) : "just now"}
            </p>
          </div>
          <div
            className={`rounded-full px-4 py-2 text-xs font-medium ${backendHealthy ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"
              }`}
          >
            {backendHealthy ? "Backend reachable" : "Backend offline"}
          </div>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Total Users"
            value={totalUsers === null ? "—" : numberFormatter.format(totalUsers)}
            caption="Row count in users table"
          />
          <MetricCard
            title="Messages Sent Today"
            value={messagesToday === null ? "—" : numberFormatter.format(messagesToday)}
            caption="general_chat_messages since local midnight"
          />
          <MetricCard
            title="Error Rate"
            value={formatCount(errorTotal)}
            caption="4xx/5xx-like entries seen in logs today"
            accent={metrics?.errors?.since ? `Since ${formatDateTime(metrics.errors.since)}` : undefined}
          />
          <MetricCard
            title="Latency < 5s"
            value={formatPercent(latencyRatio)}
            caption={`Samples: ${metrics?.latency?.count ?? 0}, p95 ${formatMs(metrics?.latency?.p95_ms)}`}
            accent={metrics?.latency?.sample_since ? `Since ${formatDateTime(metrics.latency.sample_since)}` : undefined}
          />
          <MetricCard
            title="Stability"
            value="Manual check"
            caption="Open on mobile and confirm the keyboard does not cover the input box."
          />
          <MetricCard
            title="Onboarding Speed"
            value="Manual check"
            caption="Start from /signup and ensure account creation completes in under 60 seconds."
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Logs</h2>
              <span className="text-xs text-gray-400">Today&apos;s window</span>
            </div>
            <dl className="mt-4 space-y-2 text-sm text-gray-200">
              <div className="flex justify-between">
                <dt className="text-gray-400">Error entries</dt>
                <dd>{formatCount(metrics?.errors?.error_log_entries)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">HTTP 4xx/5xx</dt>
                <dd>{formatCount(metrics?.errors?.http_error_entries)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Log paths</dt>
                <dd className="text-right text-xs text-gray-400">
                  {metrics?.errors?.error_log_path ?? "backend/logs/error.log"}
                  <br />
                  {metrics?.errors?.app_log_path ?? "backend/logs/app.log"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Next manual checks</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-200">
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                <div>
                  <p className="font-medium text-white">Stability</p>
                  <p className="text-gray-400">
                    Open the chat on a mobile viewport and confirm the keyboard keeps the input visible.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                <div>
                  <p className="font-medium text-white">Onboarding</p>
                  <p className="text-gray-400">
                    Time a fresh signup flow; target is under one minute from landing to first message.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {!backendHealthy ? (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Backend could not be reached. Start it with <code className="text-amber-200">npm run backend</code> and refresh.
          </div>
        ) : null}
      </div>
    </div>
  );
}
