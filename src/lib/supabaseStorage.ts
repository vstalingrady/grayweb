const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const deriveStorageBaseKey = (): string | null => {
  if (!supabaseUrl) {
    return null;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0];
    if (!projectRef) {
      return null;
    }
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
};

const STORAGE_BASE_KEY = deriveStorageBaseKey();

export const getSupabaseStorageKey = (): string | null => STORAGE_BASE_KEY;

export const getSupabaseAuthStorageKeys = (): string[] => {
  if (!STORAGE_BASE_KEY) {
    return [];
  }

  return [
    STORAGE_BASE_KEY,
    `${STORAGE_BASE_KEY}-code-verifier`,
    `${STORAGE_BASE_KEY}-user`,
  ];
};

export const clearSupabaseAuthStorage = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const keys = getSupabaseAuthStorageKeys();
  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage exceptions (e.g. disabled localStorage)
    }
  });

  try {
    window.sessionStorage.removeItem("oauth_access_token");
    window.sessionStorage.removeItem("oauth_refresh_token");
    window.sessionStorage.removeItem("auth-callback-processed");
  } catch {
    // Ignore sessionStorage access issues
  }
};
