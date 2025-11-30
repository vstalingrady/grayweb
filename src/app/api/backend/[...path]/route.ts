import { NextRequest, NextResponse } from "next/server";
import { readServerSession, type ServerSession } from "@/lib/auth/server";

const DEFAULT_BACKEND_URL = "http://localhost:8000";

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const resolveBackendBaseUrl = () => {
  const envCandidates = [
    process.env.BACKEND_API_URL,
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_ORIGIN,
    process.env.API_PROXY_TARGET,
  ];

  for (const candidate of envCandidates) {
    if (candidate && candidate.trim().length > 0) {
      const normalized = candidate.startsWith("http")
        ? candidate
        : `https://${candidate}`;
      return stripTrailingSlashes(normalized);
    }
  }

  return stripTrailingSlashes(DEFAULT_BACKEND_URL);
};

const backendBaseUrl = resolveBackendBaseUrl();

const buildTargetUrl = (request: NextRequest, pathSegments: string[] = []) => {
  const pathname = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "/";
  const target = new URL(pathname, `${backendBaseUrl}/`);
  target.search = request.nextUrl.search;
  return target;
};

const FORWARDED_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "authorization",
  "content-type",
  "x-request-id",
  "x-trace-id",
  "x-client-trace-id",
]);

const toProxyHeaders = (requestHeaders: Headers, session: ServerSession) => {
  const headers = new Headers();

  for (const header of FORWARDED_HEADERS) {
    const value = requestHeaders.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  const authorization = requestHeaders.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    headers.set("authorization", authorization);
  }

  headers.set("x-gray-user-email", session.email ?? "");

  return headers;
};

const unauthorizedResponse = () =>
  NextResponse.json(
    { detail: "Unauthorized" },
    {
      status: 401,
      headers: {
        "cache-control": "no-store",
      },
    },
  );

const proxyRequest = async (request: NextRequest, pathSegments: string[] = []) => {
  const session = await readServerSession();
  if (!session) {
    return unauthorizedResponse();
  }

  const targetUrl = buildTargetUrl(request, pathSegments);
  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const init: RequestInit = {
    method,
    headers: toProxyHeaders(request.headers, session),
    redirect: "manual",
  };

  if (hasBody) {
    init.body = request.body;
    // @ts-expect-error: duplex is required when passing a readable stream to fetch
    init.duplex = "half";
  }

  try {
    const response = await fetch(targetUrl, init);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("set-cookie");
    responseHeaders.set("cache-control", responseHeaders.get("cache-control") ?? "no-store");

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`API proxy request failed: ${method} ${targetUrl}`, error);
    return NextResponse.json(
      {
        detail: `Unable to reach backend service at ${backendBaseUrl}`,
      },
      {
        status: 502,
      },
    );
  }
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const runtime = "nodejs";

// In Next.js 15, route params are always async and must be awaited
type RouteParams = { path?: string[] };
type RouteContext = { params: Promise<RouteParams> };

const getPathSegments = async (context: RouteContext) => {
  const params = await context.params;
  return params?.path ?? [];
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}
