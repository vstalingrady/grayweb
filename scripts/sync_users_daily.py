#!/usr/bin/env python3
"""
DEPRECATED: Supabase is auth-only
===============================
This repository no longer syncs application data (including users/settings) into
Supabase public tables. Supabase should be used for authentication only.

If you previously stored app data in Supabase public tables and need to migrate
it into SQLite, use:

  python scripts/migrate_supabase_to_sqlite.py --dry-run --sqlite-path ./data/users.db

For ongoing backups, back up the SQLite file/volume (e.g. `./data/users.db`)
instead of writing into Supabase tables.
"""

import sys
def main():
    print("This script is deprecated: Supabase is auth-only in this repo.", file=sys.stderr)
    print("Back up your SQLite DB file/volume instead.", file=sys.stderr)
    print("See docs/SUPABASE_TO_SQLITE_MIGRATION.md for migration guidance.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
