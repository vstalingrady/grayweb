import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", errorDescription || error);
    return NextResponse.redirect(loginUrl.toString());
  }

  const forwardUrl = new URL("/callback", requestUrl.origin);
  requestUrl.searchParams.forEach((value, key) => {
    forwardUrl.searchParams.set(key, value);
  });

  return NextResponse.redirect(forwardUrl.toString());
}
