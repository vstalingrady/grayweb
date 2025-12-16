# Supabase → SQLite migration (production)

Supabase should be used for **authentication only**. All application data lives in the service database (SQLite by default).

If you previously stored app data in Supabase **public** tables (chat history, settings, reminders, etc.), migrate it into SQLite before deploying the auth-only change and/or applying `supabase/migrations/20251206050000_cleanup_unused_tables.sql`.

## Prereqs

- A persistent SQLite file for the backend (Docker default: `./data/users.db` mounted to `/app/data/users.db`).
- Supabase credentials with access to read the old public tables (recommended: `SUPABASE_SERVICE_ROLE_KEY`).
  - Set `SUPABASE_URL` and one of: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SECRET_KEY` (or `SUPABASE_KEY` if it contains the service role).

## Migration steps

1. **Dry-run (no writes):**
   - Host: `python scripts/migrate_supabase_to_sqlite.py --dry-run --sqlite-path ./data/users.db`
   - Docker: `docker compose exec backend python scripts/migrate_supabase_to_sqlite.py --dry-run --sqlite-path /app/data/users.db`

2. **Run the migration (writes + auto-backup):**
   - Host: `python scripts/migrate_supabase_to_sqlite.py --sqlite-path ./data/users.db`
   - Docker: `docker compose exec backend python scripts/migrate_supabase_to_sqlite.py --sqlite-path /app/data/users.db`
   - The script creates a backup next to your SQLite file (suffix: `.bak_migration_YYYYMMDD_HHMMSS`) unless `--no-backup` is passed.

3. **Optional: drop Supabase data tables after verifying**
   - Apply `supabase/migrations/20251206050000_cleanup_unused_tables.sql`.
   - This is destructive to Supabase public tables; it does not touch `auth.users`.

