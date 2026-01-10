import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";
import GrayMarketingEntry from "./MarketingEntry";

export const metadata: Metadata = {
  title: "Gray",
  description:
    "Your personal accelerator. An AI mentor that checks in throughout the day, remembers your goals, and helps you maximize your potential.",
  alternates: {
    canonical: "/gray",
  },
};

export default async function GrayLandingPage() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (isGrayWorkspaceHost(host)) {
    redirect("/");
  }
  return <GrayMarketingEntry />;
}
