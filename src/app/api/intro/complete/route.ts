import { NextResponse } from "next/server";

const COOKIE_NAME = "gray_intro_done";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "1",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
