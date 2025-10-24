import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in environment.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
}

let cached: SupabaseClient | undefined;

export const getSupabaseClient = (): SupabaseClient => {
  if (!cached) {
    cached = createClient(supabaseUrl, supabaseAnonKey);
  }

  return cached;
};
