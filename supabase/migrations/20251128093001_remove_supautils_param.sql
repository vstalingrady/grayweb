-- Remove the deprecated supautils.* custom parameter to silence Postgres warnings.
-- Supabase now reserves the "supautils" prefix; resetting it requires elevated privileges.
-- Wrap in TRY/CATCH so the migration succeeds even if we cannot change GUCs from this role.

do $$
begin
  begin
    execute 'alter database postgres reset "supautils.disable_program"';
  exception
    when insufficient_privilege then
      raise notice 'Skipping reset of supautils.disable_program (insufficient privileges)';
    when sqlstate '55P02' then
      raise notice 'Skipping reset of supautils.disable_program (parameter locked)';
    when others then
      raise notice 'Skipping reset of supautils.disable_program (error: %)', SQLERRM;
  end;

  begin
    execute 'alter database postgres reset "supautils.disable"';
  exception
    when insufficient_privilege then
      raise notice 'Skipping reset of supautils.disable (insufficient privileges)';
    when sqlstate '55P02' then
      raise notice 'Skipping reset of supautils.disable (parameter locked)';
    when others then
      raise notice 'Skipping reset of supautils.disable (error: %)', SQLERRM;
  end;

  begin
    execute 'alter role supabase_admin reset "supautils.disable_program"';
  exception
    when insufficient_privilege then
      raise notice 'Skipping reset of supautils.disable_program for supabase_admin (insufficient privileges)';
    when sqlstate '55P02' then
      raise notice 'Skipping reset of supautils.disable_program for supabase_admin (parameter locked)';
    when others then
      raise notice 'Skipping reset of supautils.disable_program for supabase_admin (error: %)', SQLERRM;
  end;

  begin
    execute 'alter role supabase_admin reset "supautils.disable"';
  exception
    when insufficient_privilege then
      raise notice 'Skipping reset of supautils.disable for supabase_admin (insufficient privileges)';
    when sqlstate '55P02' then
      raise notice 'Skipping reset of supautils.disable for supabase_admin (parameter locked)';
    when others then
      raise notice 'Skipping reset of supautils.disable for supabase_admin (error: %)', SQLERRM;
  end;
end $$;
