import { NextResponse } from 'next/server';

// Use BACKEND_URL env var for Docker (http://backend:8000) or fallback to localhost for local dev
const PROXY_TARGET = process.env.BACKEND_URL || 'http://localhost:8000';

async function handleProxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const pathString = path.join('/');
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const targetUrl = `${PROXY_TARGET}/${pathString}${searchParams ? `?${searchParams}` : ''}`;

    console.log(`[Proxy] Forwarding ${request.method} ${url.pathname} to ${targetUrl}`);

    try {
        const headers = new Headers(request.headers);
        // Preserve the original host for downstream localhost-only/dev-only gating.
        // (We still remove the Host header since it must match the target origin.)
        headers.set('x-forwarded-host', url.host);
        headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
        headers.delete('host');
        headers.delete('connection');
        headers.delete('content-length');

        let body: BodyInit | null | undefined;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            body = await request.blob();
        }

        const response = await fetch(targetUrl, {
            method: request.method,
            headers,
            body,
        });

        const responseHeaders = new Headers(response.headers);

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });

    } catch (error) {
        console.error(`[Proxy] Error forwarding to ${targetUrl}:`, error);
        return NextResponse.json(
            { error: 'Internal Proxy Error', details: String(error) },
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
