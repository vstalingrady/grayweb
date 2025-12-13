import { NextResponse, type NextRequest } from "next/server";
import { hostFromHeaders, isLocalHostname } from "@/lib/grayRouting";

const noStoreHeaders = { "cache-control": "no-store" };

const resolveProdAnalyticsConfig = () => {
  const baseUrl = (process.env.DEV_ANALYTICS_PROD_URL ?? "").trim().replace(/\/+$/, "");
  const token = (process.env.DEV_ANALYTICS_TOKEN ?? "").trim();
  return { baseUrl, token };
};

const isAllowedRequest = (request: NextRequest) => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const host = hostFromHeaders(request.headers);
  return isLocalHostname(host);
};

export async function GET(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404, headers: noStoreHeaders });
  }

  const { baseUrl, token } = resolveProdAnalyticsConfig();
  if (!baseUrl || !token) {
    return NextResponse.json(
      { detail: "Missing DEV_ANALYTICS_PROD_URL or DEV_ANALYTICS_TOKEN" },
      { status: 400, headers: noStoreHeaders }
    );
  }

  const target = `${baseUrl}/dev/analytics/summary`;

  try {
    const response = await fetch(target, {
      headers: {
        "x-dev-analytics-token": token,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        ...noStoreHeaders,
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { detail: "Failed to reach production analytics", error: String(error) },
      { status: 502, headers: noStoreHeaders }
    );
  }
}

