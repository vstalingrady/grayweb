# Repository Guidelines

This document is for contributors (including AI agents) working in this repository. Follow these guidelines to keep the codebase consistent and easy to maintain.

## Project Structure & Module Organization

- Backend services live under `backend/` (FastAPI app, auth, database, Supabase utilities, tests).
- Frontend (Next.js/React) lives under `src/` and `public/` (components, pages, styles, assets).
- End-to-end and integration tests live under `tests/` and `backend/tests/`.
- Static assets (images, SVGs, logos) live under `public/` and `public/logos/`.

## Build, Test, and Development Commands

- `npm install` – Install frontend dependencies.
- `npm run dev` – Run the Next.js dev server.
- `npm run build` – Build the frontend for production.
- `npm test` – Run frontend tests (if present).
- `python -m backend.start` or equivalent script – Run the backend API (see `backend/README` or `backend/start.py`).

## Coding Style & Naming Conventions

- Use TypeScript for frontend (`.tsx`, `.ts`) and Python 3 for backend.
- Prefer descriptive names over abbreviations; avoid single-letter variables.
- Follow existing patterns in each directory; keep functions small and focused.
- Use the configured ESLint/Tailwind/Prettier settings for frontend and Black/ruff-like conventions for Python when applicable.

## Testing Guidelines

- Mirror existing test structure (e.g., `backend/tests/test_*.py`, `*.test.tsx`).
- Add tests for new features and bug fixes where practical.
- Ensure tests are deterministic and avoid network access when possible.

## Commit & Pull Request Guidelines

- Write clear, imperative commit messages (e.g., `Fix reminder auth fallback`).
- For PRs, include: summary, motivation, key changes, and any breaking behavior.
- Link related issues and add screenshots or logs for user-facing or UI changes.

