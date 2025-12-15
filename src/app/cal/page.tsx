import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { GrayPageClient } from "@/app/gray/GrayPageClient";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";
import { readServerSession } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
  const session = await readServerSession();

  if (!session) {
    redirect("/login?redirect=/cal");
  }

  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (!isGrayWorkspaceHost(host)) {
    notFound();
  }

  // Seed the client clock from the request time so hydration matches.
  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      activeNav="calendar"
      variant="dashboard"
      initialDashboardTab="calendar"
      defaultSidebarExpandedDesktop={false}
      sidebarPreferenceKey="gray:calendar:sidebarExpanded"
    />
  );
}
