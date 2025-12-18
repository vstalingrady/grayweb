import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isLocalHostname } from "@/lib/grayRouting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "cache-control": "no-store" } as const;

const resolveSupabaseUrl = (): string | null => {
  const url =
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    "";
  return url.length > 0 ? url : null;
};

const resolveSupabaseServiceKey = (): string | null => {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_KEY?.trim() ??
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    "";
  return key.length > 0 ? key : null;
};

const isDevRuntime = () => process.env.NODE_ENV !== "production";

type PasswordAuthPayload = {
  email?: string;
  password?: string;
  mode?: "signin" | "signup";
};

const resolveRequestHost = (request: NextRequest): string | null => {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) {
    const host = forwarded.split(",")[0]?.trim();
    if (host) {
      return host;
    }
  }

  const hostHeader = request.headers.get("host");
  if (hostHeader) {
    const host = hostHeader.split(",")[0]?.trim();
    if (host) {
      return host;
    }
  }

  return request.nextUrl.host ?? null;
};

const isLocalRequest = (request: NextRequest): boolean => {
  const host = resolveRequestHost(request);
  return isLocalHostname(host);
};

export async function POST(request: NextRequest) {
  if (!isDevRuntime() || !isLocalRequest(request)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404, headers: noStoreHeaders });
  }

  const body = (await request.json().catch(() => null)) as PasswordAuthPayload | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const mode = body?.mode === "signup" ? "signup" : "signin";

  if (!email || !password) {
    return NextResponse.json(
      { detail: "Email and password required" },
      { status: 400, headers: noStoreHeaders }
    );
  }

  const supabaseUrl = resolveSupabaseUrl();
  const serviceKey = resolveSupabaseServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        detail:
          "Supabase service role credentials are not configured (missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL).",
      },
      { status: 500, headers: noStoreHeaders }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  if (mode === "signup") {
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError && !createError.message.toLowerCase().includes("already")) {
      return NextResponse.json(
        { detail: createError.message },
        { status: 400, headers: noStoreHeaders }
      );
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 401, headers: noStoreHeaders });
  }

  const session = data.session;
  if (!session?.access_token || !session.refresh_token) {
    return NextResponse.json(
      { detail: "Supabase did not return a session." },
      { status: 502, headers: noStoreHeaders }
    );
  }

  return NextResponse.json(
    {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      tokenType: session.token_type,
      user: session.user ? { id: session.user.id, email: session.user.email } : null,
    },
    { status: 200, headers: noStoreHeaders }
  );
}

