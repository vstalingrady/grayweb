import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://localhost:8000";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

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

const toProxyHeaders = (requestHeaders: Headers) => {
  const headers = new Headers(requestHeaders);
  headers.delete("host");
  headers.delete("content-length");

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  return headers;
};

const proxyRequest = async (request: NextRequest, pathSegments: string[] = []) => {
  const targetUrl = buildTargetUrl(request, pathSegments);
  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const init: RequestInit = {
    method,
    headers: toProxyHeaders(request.headers),
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

export const runtime = "nodejs";

// Align with Next 16 route handler typing where `context.params` may be a Promise
// in the type definition. We defensively support both sync and async params.
type RouteParams = { path?: string[] } | Promise<{ path?: string[] }>;
type RouteContext = { params: RouteParams };

const getPathSegments = async (context: RouteContext) => {
  const params = (typeof (context as any).params?.then === "function")
    ? await (context.params as Promise<{ path?: string[] }>)
    : (context.params as { path?: string[] } | undefined);
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
