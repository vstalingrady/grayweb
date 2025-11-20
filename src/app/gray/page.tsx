import { headers } from "next/headers";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";
import GrayMarketingEntry from "./MarketingEntry";
import GrayWorkspaceEntry from "./WorkspaceEntry";

export default async function GrayLandingPage() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (isGrayWorkspaceHost(host)) {
    return <GrayWorkspaceEntry />;
  }
  return <GrayMarketingEntry />;
}
