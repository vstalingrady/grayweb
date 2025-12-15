import { NextResponse } from 'next/server';

/**
 * Simple geo-detection API endpoint.
 * Returns the user's detected region based on IP geolocation headers.
 * 
 * For Vercel/Cloudflare: uses x-vercel-ip-country or cf-ipcountry headers
 * Fallback: uses ip-api.com free tier for development
 */
const parseIpv4 = (value: string): number[] | null => {
    const parts = value.split(".");
    if (parts.length !== 4) {
        return null;
    }
    const octets = parts.map((part) => Number.parseInt(part, 10));
    if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
        return null;
    }
    return octets;
};

const isPrivateOrLoopbackIpv4 = (octets: number[]): boolean => {
    const [first, second] = octets;
    if (first === 10) return true;
    if (first === 127) return true;
    if (first === 192 && second === 168) return true;
    // 172.16.0.0/12
    if (first === 172 && second !== undefined && second >= 16 && second <= 31) return true;
    return false;
};

export async function GET(request: Request) {
    const headers = request.headers;
    const isProduction = process.env.NODE_ENV === "production";

    // Check common geo headers from CDNs/proxies
    let countryCode =
        headers.get('x-vercel-ip-country') ||      // Vercel
        headers.get('cf-ipcountry') ||              // Cloudflare
        headers.get('x-country-code') ||            // Custom proxy
        null;

    // If no header available, try IP-based lookup (for local dev)
    if (!countryCode) {
        const ipCandidate =
            headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            headers.get('x-real-ip') ||
            '127.0.0.1';

        // Skip geolocation for localhost
        const ipv4 = parseIpv4(ipCandidate);
        if (!ipv4 || isPrivateOrLoopbackIpv4(ipv4) || ipCandidate === "::1") {
            // Default to Indonesia for local development
            countryCode = 'ID';
        } else if (!isProduction) {
            try {
                // Use ip-api.com free tier (limited to 45 req/min)
                const geoRes = await fetch(`http://ip-api.com/json/${ipCandidate}?fields=countryCode`, {
                    next: { revalidate: 3600 } // Cache for 1 hour
                });
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    countryCode = geoData.countryCode || 'US';
                }
            } catch {
                // Fallback to US for international
                countryCode = 'US';
            }
        } else {
            // In production, avoid external geo lookups; rely on CDN headers.
            countryCode = 'US';
        }
    }

    const isIndonesia = countryCode === 'ID';

    return NextResponse.json({
        country: countryCode || 'US',
        region: isIndonesia ? 'ID' : 'INTL',
        currency: isIndonesia ? 'IDR' : 'USD',
        isIndonesia,
    });
}
