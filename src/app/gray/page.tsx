import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";
import GrayMarketingEntry from "./MarketingEntry";

export default async function GrayLandingPage() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (isGrayWorkspaceHost(host)) {
    redirect("/g");
  }
  return <GrayMarketingEntry />;
}
