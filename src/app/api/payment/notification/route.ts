import { NextResponse } from 'next/server';

const resolveProxyTarget = () => {
    const envTarget =
        process.env.BACKEND_URL ||
        process.env.BACKEND_API_URL ||
        process.env.NEXT_PUBLIC_API_URL;

    return envTarget || 'http://localhost:8000';
};

const PROXY_TARGET = resolveProxyTarget();

export async function POST(request: Request) {
    const targetUrl = `${PROXY_TARGET}/api/payment/notification`;

    console.log(`[Payment Notification] Forwarding to ${targetUrl}`);

    try {
        const headers = new Headers(request.headers);
        headers.set('x-forwarded-host', new URL(request.url).host);
        headers.set('x-forwarded-proto', 'https');
        headers.delete('host');
        headers.delete('connection');
        headers.delete('content-length');

        const body = await request.blob();

        const response = await fetch(targetUrl, {
            method: 'POST',
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
        console.error(`[Payment Notification] Error:`, error);
        return NextResponse.json(
            { detail: 'Internal Proxy Error', error: String(error) },
            { status: 500 }
        );
    }
}
