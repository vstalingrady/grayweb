-- Enable RLS on timezone_names_cache table
-- This table is read-only public data (timezone names from pg_catalog)
-- but RLS is required by Supabase linter for all public tables.

alter table public.timezone_names_cache enable row level security;

-- Allow anyone to read timezone names (this is non-sensitive reference data)
create policy "Anyone can read timezone names"
  on public.timezone_names_cache
  for select
  using (true);

-- No insert/update/delete policies - only service_role can modify via refresh function
-- The refresh function runs as definer (service_role) so it bypasses RLS
