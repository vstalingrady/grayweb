-- Cache pg_timezone_names so repeated lookups don't block migrations or UI dropdowns.
-- Populates once, then serves reads from a small table that can be refreshed on demand.

create table if not exists public.timezone_names_cache (
  name text primary key,
  abbrev text,
  utc_offset interval,
  is_dst boolean,
  cached_at timestamptz not null default now()
);

-- Seed the cache once; avoid re-running expensive catalog scans if it is already filled.
insert into public.timezone_names_cache (name, abbrev, utc_offset, is_dst)
select name, abbrev, utc_offset, is_dst
from pg_timezone_names
where not exists (select 1 from public.timezone_names_cache limit 1);

create or replace function public.refresh_timezone_names_cache()
returns void
language plpgsql
as $$
begin
  truncate table public.timezone_names_cache;
  insert into public.timezone_names_cache (name, abbrev, utc_offset, is_dst)
  select name, abbrev, utc_offset, is_dst from pg_timezone_names;
end;
$$;

create or replace function public.get_cached_timezone_names()
returns table(name text, abbrev text, utc_offset interval, is_dst boolean)
stable
language sql
as $$
  select name, abbrev, utc_offset, is_dst
  from public.timezone_names_cache
  order by name;
$$;

-- Allow reads for clients; keep refresh limited to the service role.
grant select on public.timezone_names_cache to anon, authenticated, service_role;
grant execute on function public.get_cached_timezone_names to anon, authenticated, service_role;
grant execute on function public.refresh_timezone_names_cache to service_role;
