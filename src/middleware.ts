import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
    const host = request.headers.get("host") || "";
    const isPaymentSubdomain = host.startsWith("payment.");
    const { pathname, search } = request.nextUrl;

    const mainSiteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://gray.alignment.id";
    const paymentSiteUrl = process.env.NEXT_PUBLIC_PAYMENT_SITE_URL || "https://payment.alignment.id";

    // 1. Redirect /payment on main domain to payment subdomain
    if (!isPaymentSubdomain && pathname.startsWith("/payment")) {
        try {
            const target = new URL(paymentSiteUrl);
            const redirectUrl = new URL(`${pathname}${search}`, target.origin);
            return NextResponse.redirect(redirectUrl);
        } catch (e) {
            console.error("Middleware redirect error (main -> payment):", e);
        }
    }

    // 2. Redirect non-payment paths on payment subdomain to main domain
    // We exclude paths starting with /payment, /api, /_next, and static assets
    const isAllowedOnPayment =
        pathname.startsWith("/payment") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/_next") ||
        pathname.includes(".");

    if (isPaymentSubdomain && !isAllowedOnPayment) {
        try {
            const target = new URL(mainSiteUrl);
            const redirectUrl = new URL(`${pathname}${search}`, target.origin);
            return NextResponse.redirect(redirectUrl);
        } catch (e) {
            console.error("Middleware redirect error (payment -> main):", e);
        }
    }

    return NextResponse.next();
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
