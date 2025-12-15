import { NextResponse } from 'next/server';

const isProxyDebugEnabled = process.env.NODE_ENV !== "production";

const resolveProxyTarget = () => {
    // Highest priority: explicit server-side proxy target (Docker/local override).
    if (process.env.BACKEND_URL) {
        return process.env.BACKEND_URL;
    }
    if (process.env.API_PROXY_TARGET) {
        return process.env.API_PROXY_TARGET;
    }

    // Local dev default: prefer the local backend even if prod URLs exist in env.
    if (process.env.NODE_ENV !== "production") {
        return process.env.BACKEND_DEV_URL || "http://localhost:8000";
    }

    // Production: use configured public/backend API URL.
    return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

// Use BACKEND_URL (Docker), BACKEND_API_URL (prod), or fallback to localhost (local dev)
const PROXY_TARGET = resolveProxyTarget();

const buildTargetUrl = (options: { proxyTarget: string; pathname: string; searchParams: string }) => {
    const normalizedProxyTarget = options.proxyTarget.replace(/\/+$/, "");

    try {
        const baseUrl = new URL(normalizedProxyTarget);
        const basePath = baseUrl.pathname.replace(/\/+$/, "");
        const forwardPath = options.pathname.startsWith("/") ? options.pathname : `/${options.pathname}`;

        const targetPath =
            basePath && basePath !== "/"
                ? (
                    forwardPath === basePath || forwardPath.startsWith(`${basePath}/`)
                        ? forwardPath
                        : `${basePath}${forwardPath}`
                )
                : forwardPath;

        return `${baseUrl.origin}${targetPath}${options.searchParams ? `?${options.searchParams}` : ""}`;
    } catch {
        return `${normalizedProxyTarget}${options.pathname}${options.searchParams ? `?${options.searchParams}` : ""}`;
    }
};

async function handleProxy(request: Request) {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const forwardPathname = url.pathname.replace(/^\/api\/p/, "") || "/";
    const targetUrl = buildTargetUrl({ proxyTarget: PROXY_TARGET, pathname: forwardPathname, searchParams });

    if (isProxyDebugEnabled) {
        console.log(`[Proxy] Forwarding ${request.method} ${url.pathname}`);
    }

    try {
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.delete('connection');
        headers.delete('content-length');
        headers.delete('keep-alive');
        headers.delete('proxy-connection');
        headers.delete('transfer-encoding');
        headers.delete('upgrade');
        headers.delete('te');
        headers.delete('trailer');

        let body: BodyInit | null | undefined;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            body = await request.blob();
        }

        const response = await fetch(targetUrl, {
            method: request.method,
            headers,
            body,
            cache: "no-store",
        });

        const responseHeaders = new Headers(response.headers);
        const location = responseHeaders.get("location");
        if (location && location.startsWith("/")) {
            responseHeaders.set("location", `/api/p${location}`);
        }

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });

    } catch (error) {
        console.error(`[Proxy] Error forwarding to ${targetUrl}:`, error);
        return NextResponse.json(
            { detail: 'Internal Proxy Error', error: String(error) },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) { return handleProxy(request); }
export async function POST(request: Request) { return handleProxy(request); }
export async function PUT(request: Request) { return handleProxy(request); }
export async function PATCH(request: Request) { return handleProxy(request); }
export async function DELETE(request: Request) { return handleProxy(request); }
export async function HEAD(request: Request) { return handleProxy(request); }
export async function OPTIONS(request: Request) { return handleProxy(request); }
