import { NextRequest, NextResponse } from "next/server";
import { hostFromHeaders, isPayHost } from "@/lib/grayRouting";

export function middleware(request: NextRequest) {
  const host = hostFromHeaders(request.headers);
  const normalizedHost = host ?? "";

  if (isPayHost(host)) {
    return NextResponse.rewrite(new URL("/pricing", request.url));
  }

  if (request.nextUrl.pathname.startsWith("/policies") && normalizedHost.startsWith("gray.")) {
    const destination = request.nextUrl.clone();
    destination.hostname = "localhost";
    destination.protocol = "http:";
    destination.port = "3000";
    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/policies/:path*", "/"],
};
