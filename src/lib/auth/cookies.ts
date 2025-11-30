import { getSupabaseClient } from "@/lib/supabaseClient";

const expireLegacyCookie = (name: string) => {
  if (typeof document === "undefined") {
    return;
  }
  const expiry = new Date(0);
  const attributes = ["path=/", "sameSite=Lax", `expires=${expiry.toUTCString()}`, "max-age=0"];
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    attributes.push("secure");
  }
  document.cookie = [`${name}=`, ...attributes].join("; ");
};

const syncServerSession = async (accessToken?: string | null): Promise<boolean> => {
  if (typeof window === "undefined") {
    return false;
  }

  let token = accessToken?.trim() || null;

  if (!token) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return false;
    }

    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ accessToken: token }),
      cache: "no-store",
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const persistAuthCookies = async (
  email?: string | null,
  accessToken?: string | null
) => {
  void email;
  await syncServerSession(accessToken);
};

export const clearAuthCookies = () => {
  expireLegacyCookie("gray-auth");
  expireLegacyCookie("gray-auth-email");

  if (typeof window === "undefined") {
    return;
  }

  void fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => undefined);
};
