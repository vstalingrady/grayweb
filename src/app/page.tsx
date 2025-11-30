import { headers } from "next/headers";
import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";
import { resolveTryGrayUrl } from "@/lib/grayCta";
import MarketingLanding from "./components/MarketingLanding";

export default async function HomePage() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  const tryGrayUrl = resolveTryGrayUrl(host);

  if (isGrayWorkspaceHost(host)) {
    const session = await (await import("@/lib/auth/server")).readServerSession();
    if (!session) {
      redirect(`/login?redirect=${encodeURIComponent("/")}`);
    }

    // eslint-disable-next-line react-hooks/purity
    const initialTimestamp = Date.now();
    return (
      <GrayPageClient
        initialTimestamp={initialTimestamp}
        activeNav="threads"
        variant="general"
      />
    );
  }

  return <MarketingLanding tryGrayUrl={tryGrayUrl} />;
}
