#!/bin/bash
# DEPRECATED: Supabase is auth-only in this repo.
# This job previously synced local app data into Supabase public tables.
# Back up the SQLite file/volume instead (e.g. ./data/users.db).

echo "Deprecated: daily Supabase data sync is disabled (Supabase is auth-only)." >&2
echo "Back up the SQLite DB file instead. See docs/SUPABASE_TO_SQLITE_MIGRATION.md." >&2
exit 0
