import { headers } from "next/headers";
import { hostFromHeaders } from "@/lib/grayRouting";
import { resolveTryGrayUrl } from "@/lib/grayCta";
import MarketingStyles from "@/app/components/MarketingStyles";
import GrayMarketingClient from "./GrayMarketingClient";

export default async function GrayMarketingEntry() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  const tryGrayUrl = resolveTryGrayUrl(host);
  return (
    <>
      <MarketingStyles />
      <GrayMarketingClient
        tryGrayUrl={tryGrayUrl}
      />
    </>
  );
}
