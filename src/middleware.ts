import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
    const host = request.headers.get("host") || "";
    const hostLower = host.toLowerCase();
    const isPaymentSubdomain = hostLower.startsWith("payment.");
    const isGraySubdomain = hostLower.startsWith("gray.");
    const { pathname, search } = request.nextUrl;

    const isLocal = hostLower.includes("localhost") || hostLower.includes("127.0.0.1");
    const port = host.split(":")[1] || "";
    const portSuffix = port ? `:${port}` : "";

    const defaultMain = isLocal ? `http://localhost${portSuffix}` : "https://gray.alignment.id";
    const defaultPayment = isLocal ? `http://gray.localhost${portSuffix}` : "https://payment.alignment.id";

    const mainSiteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL || defaultMain;
    const paymentSiteUrl = process.env.NEXT_PUBLIC_PAYMENT_SITE_URL || defaultPayment;

    const noIndexPathPrefixes = [
        "/api",
        "/c",
        "/g",
        "/gray",
        "/login",
        "/signup",
        "/reset-password",
        "/callback",
        "/confirm-delete",
        "/delete-account",
        "/admin",
        "/threads",
        "/pulse",
        "/grove",
        "/cal",
        "/reference",
        "/payment",
    ];
    const isAppPath = noIndexPathPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    const isMainHost = !isPaymentSubdomain && !isGraySubdomain;
    const shouldNoIndex = !isLocal && (isPaymentSubdomain || isGraySubdomain || (isMainHost && isAppPath));
    const applyRobotsHeader = (response: NextResponse) => {
        if (shouldNoIndex) {
            response.headers.set("X-Robots-Tag", "noindex, nofollow");
        }
        return response;
    };

    // 1. Redirect /payment on main domain to payment subdomain (skip for local dev)
    if (!isLocal && !isPaymentSubdomain && pathname.startsWith("/payment")) {
        try {
            const target = new URL(paymentSiteUrl);
            const redirectUrl = new URL(`${pathname}${search}`, target.origin);
            return applyRobotsHeader(NextResponse.redirect(redirectUrl));
        } catch (e) {
            console.error("Middleware redirect error (main -> payment):", e);
        }
    }

    // 2. Redirect non-payment paths on payment subdomain to main domain
    // We exclude paths starting with /payment, /api, /_next, and static assets
    const isAllowedOnPayment =
        pathname.startsWith("/payment") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/callback") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/_next") ||
        pathname.includes(".");

    if (isPaymentSubdomain && !isAllowedOnPayment) {
        try {
            const target = new URL(mainSiteUrl);
            const redirectUrl = new URL(`${pathname}${search}`, target.origin);
            return applyRobotsHeader(NextResponse.redirect(redirectUrl));
        } catch (e) {
            console.error("Middleware redirect error (payment -> main):", e);
        }
    }

    return applyRobotsHeader(NextResponse.next());
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
