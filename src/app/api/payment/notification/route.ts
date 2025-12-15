import { NextResponse } from 'next/server';

const isProxyDebugEnabled = process.env.NODE_ENV !== "production";

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

    if (isProxyDebugEnabled) {
        console.log(`[Payment Notification] Forwarding request`);
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

        const body = await request.blob();

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body,
            cache: "no-store",
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
