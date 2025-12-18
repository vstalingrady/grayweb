# Production: Keep SQLite DB outside the git repo

Goal: keep runtime state (SQLite DB + WAL/SHM) out of the repository working tree while still having a predictable location on the server.

## Recommended layout

- Parent folder: `/gray`
- Repo checkout: `/gray/repo` (the git repository)
- Runtime data: `/gray/data/users.db` (NOT inside the repo)
- Optional uploads: `/gray/uploads` (NOT inside the repo)

## One-time setup steps

1) Create a persistent data directory (outside the repo):

- `mkdir -p /gray/data`

2) Move any existing DB file that currently lives inside the repo:

- If the DB is at `/gray/repo/backend/users.db`, move it to `/gray/data/users.db`:
  - `mv /gray/repo/backend/users.db /gray/data/users.db`
  - Also move any sidecars if they exist:
    - `mv /gray/repo/backend/users.db-wal /gray/data/users.db-wal`
    - `mv /gray/repo/backend/users.db-shm /gray/data/users.db-shm`

3) Point the backend at the new DB location via env vars.

Pick ONE approach:

- `SQLITE_DB_PATH=/gray/data/users.db`
- OR `DATABASE_URL=sqlite:////gray/data/users.db`

4) Restart the backend service and confirm it’s using the expected DB file path.

## Notes

- The repo already ignores `*.db`, `*.db-wal`, `*.db-shm`, etc., but the safest approach is still “DB outside repo”.
- Avoid symlinking the DB back into the repo; it makes backups and accidental commits more likely.
- If you’re using `docker compose`, prefer binding `/gray/data` into the container and setting `SQLITE_DB_PATH` to that mount (e.g. `/app/data/users.db`).

