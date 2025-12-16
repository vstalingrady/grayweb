/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@supabase/ssr' {
  import type { SupabaseClient } from '@supabase/supabase-js';

  export type CookieToSet = { name: string; value: string; options?: any };
  export type CookieMethods = {
    getAll(): Array<{ name: string; value: string }>;
    setAll(cookiesToSet: CookieToSet[]): void;
  };

  export function createBrowserClient<Database = any>(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): SupabaseClient<Database>;

  export function createServerClient<Database = any>(
    supabaseUrl: string,
    supabaseKey: string,
    options: { cookies: CookieMethods } & any
  ): SupabaseClient<Database>;
}

