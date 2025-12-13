import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hostFromHeaders, isLocalHostname } from "@/lib/grayRouting";
import AnalyticsClient from "./AnalyticsClient";

const isDevAnalyticsAllowed = async () => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  return isLocalHostname(host);
};

export default async function DevAnalyticsPage() {
  const allowed = await isDevAnalyticsAllowed();
  if (!allowed) {
    notFound();
  }

  return <AnalyticsClient />;
}

