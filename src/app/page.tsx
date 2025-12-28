import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";
import { resolveTryGrayUrl } from "@/lib/grayCta";
import MarketingLanding from "./components/MarketingLanding";
import MarketingStyles from "./components/MarketingStyles";

const marketingMetadata: Metadata = {
  title: "Alignment",
  description:
    "Your personal accelerator. An AI mentor that checks in throughout the day, remembers your goals, and helps you maximize your potential.",
  alternates: {
    canonical: "/",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (isGrayWorkspaceHost(host)) {
    return {
      title: "Gray",
    };
  }
  return marketingMetadata;
}

export default async function HomePage() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  const tryGrayUrl = resolveTryGrayUrl(host);

  if (isGrayWorkspaceHost(host)) {
    const session = await (await import("@/lib/auth/server")).readServerSession();
    if (!session) {
      redirect(`/login?redirect=${encodeURIComponent("/")}`);
    }

    const initialTimestamp = Date.now();
    return (
      <GrayPageClient
        initialTimestamp={initialTimestamp}
        activeNav="threads"
        variant="general"
      />
    );
  }

  return (
    <>
      <MarketingStyles />
      <MarketingLanding tryGrayUrl={tryGrayUrl} />
    </>
  );
}
