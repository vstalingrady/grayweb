import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const session = await readServerSession();
  if (!session) {
    redirect("/login?redirect=/analytics");
  }

  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (!isGrayWorkspaceHost(host)) {
    notFound();
  }

  const email = (session.email ?? "").trim().toLowerCase();
  if (email !== "vstalingrady@gmail.com") {
    notFound();
  }

  // Seed the client clock from the request time so hydration matches.
  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      activeNav="analytics"
      variant="general"
    />
  );
}
