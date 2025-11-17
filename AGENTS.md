# Repository Guidelines

## Project Structure & Module Organization
The Next.js 16 app lives in `src/app`; shared UI and hooks stay in `src/components` and `src/lib`, and workspace routes such as `src/app/gray` own Gray-specific logic. FastAPI code, reminder schedulers, and Supabase adapters live in `backend/`, with async fixtures in `backend/tests`. Assets live in `public/`, docs in `docs/`, the MCP worker in `plans-habits-server/`, migrations in `supabase/migrations/`, and helper scripts like `scripts/dev-full.js` coordinate multi-service workflows.

## Build, Test, and Development Commands
- `npm run dev` – run the Next.js dev server with hot reload.
- `npm run backend` – start FastAPI through `backend/start.py` using the default SQLite DSN.
- `npm run backend:with-mcp` – run the API plus the MCP worker for plan testing.
- `npm run dev:full` – orchestrate frontend + backend concurrently for end-to-end smoke tests.
- `npm run build && npm run start` – create and serve a production bundle.
- `cd backend && pytest` – execute the async reminder suite inside `backend/tests/test_reminders.py`.
- `python test_google_calendar.py` – manually confirm Google Calendar OAuth configuration.

## Coding Style & Naming Conventions
Use 2-space indentation. Components stay `PascalCase` (`GrayPageClient.tsx`), hooks/utilities `camelCase`, and CSS Modules or Tailwind classes sit beside their components. Favor async server components for data fetches and gate browser-only logic with `"use client"`. Backend modules remain `snake_case`, typed, and broken into helpers (e.g., `reminder_time_parser.py`). Run `npm run lint` before pushing and match the Python formatting you see nearby.

## Testing Guidelines
Backend changes ship with pytest coverage like `backend/tests/test_reminders.py`, using per-test SQLite DBs and `pytest_asyncio` fixtures. Frontend work must pass `npm run lint` and `npm run build`; outline manual steps or add a `src/app/workshop` demo when automation is impractical. Integration helpers should echo required env vars, mirroring `test_google_calendar.py`, so teammates can replay the flow.

## Commit & Pull Request Guidelines
Keep commits short and imperative, optionally scoped (`chore(pricing): track pricing page`). PRs should state intent, highlight user-visible changes, attach screenshots or logs when relevant, and mention migrations or new env vars so reviewers can reproduce the setup.

## Security & Configuration Tips
All services pull from the repo-root `.env`; never commit keys or personal SQLite files (`users.db`, `backend/tests/reminders_test.db`). Keep Supabase DDL in `supabase/migrations/` and stash temporary uploads inside ignored folders such as `backend/media_uploads/`. Prompt or safety edits in `public/system-prompt.txt` or `docs/gemini-*.md` should include a brief note on how they preserve Alignment Labs’ culturally adaptive mission.
