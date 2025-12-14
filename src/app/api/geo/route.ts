import { NextResponse } from 'next/server';

/**
 * Simple geo-detection API endpoint.
 * Returns the user's detected region based on IP geolocation headers.
 * 
 * For Vercel/Cloudflare: uses x-vercel-ip-country or cf-ipcountry headers
 * Fallback: uses ip-api.com free tier for development
 */
export async function GET(request: Request) {
    const headers = request.headers;

    // Check common geo headers from CDNs/proxies
    let countryCode =
        headers.get('x-vercel-ip-country') ||      // Vercel
        headers.get('cf-ipcountry') ||              // Cloudflare
        headers.get('x-country-code') ||            // Custom proxy
        null;

    // If no header available, try IP-based lookup (for local dev)
    if (!countryCode) {
        const ip =
            headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            headers.get('x-real-ip') ||
            '127.0.0.1';

        // Skip geolocation for localhost
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            // Default to Indonesia for local development
            countryCode = 'ID';
        } else {
            try {
                // Use ip-api.com free tier (limited to 45 req/min)
                const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
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
