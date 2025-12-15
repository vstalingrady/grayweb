import { NextResponse } from 'next/server';

const isProxyDebugEnabled = process.env.NODE_ENV !== "production";

const resolveProxyTarget = () => {
    const envTarget =
        process.env.BACKEND_URL ||
        process.env.BACKEND_API_URL ||
        process.env.NEXT_PUBLIC_API_URL;

    return envTarget || 'http://localhost:8000';
};

// Use BACKEND_URL (Docker), BACKEND_API_URL (prod), or fallback to localhost (local dev)
const PROXY_TARGET = resolveProxyTarget();

async function handleProxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const normalizedProxyTarget = PROXY_TARGET.replace(/\/+$/, "");
    const forwardPathname = url.pathname.replace(/^\/api\/p/, "") || "/";
    const targetUrl = `${normalizedProxyTarget}${forwardPathname}${searchParams ? `?${searchParams}` : ''}`;

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

export async function GET(request: Request, props: { params: Promise<{ path: string[] }> }) { return handleProxy(request, props); }
export async function POST(request: Request, props: { params: Promise<{ path: string[] }> }) { return handleProxy(request, props); }
export async function PUT(request: Request, props: { params: Promise<{ path: string[] }> }) { return handleProxy(request, props); }
export async function PATCH(request: Request, props: { params: Promise<{ path: string[] }> }) { return handleProxy(request, props); }
export async function DELETE(request: Request, props: { params: Promise<{ path: string[] }> }) { return handleProxy(request, props); }
export async function HEAD(request: Request, props: { params: Promise<{ path: string[] }> }) { return handleProxy(request, props); }
export async function OPTIONS(request: Request, props: { params: Promise<{ path: string[] }> }) { return handleProxy(request, props); }
