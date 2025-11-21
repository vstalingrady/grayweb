import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseStorageKey } from "./supabaseStorage";

let cached: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!cached) {
    const storageKey = getSupabaseStorageKey() ?? undefined;
    cached = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey,
        // Enable session persistence to maintain authentication state
        persistSession: true,
        autoRefreshToken: true,
        // Enable URL session detection for OAuth callback handling
        detectSessionInUrl: true,
      },
    });
  }

  return cached;
};
