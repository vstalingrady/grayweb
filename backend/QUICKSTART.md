# Backend Quickstart

This backend ships with deterministic proactive templates, but the chat endpoints will call the Gemini API when `GEMINI_API_KEY` is configured. Without a key the same local fallbacks used in `ai_message_generator.py` will continue to power every response.

## 1. Install dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Configure environment

Create a `.env` file (or copy `.env.example`) with your database URL, Gemini key, and any optional integrations such as Supabase or Google Calendar.

```
DATABASE_URL=sqlite:///./users.db
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_LIGHT_MODEL=gemini-2.5-flash-lite
GEMINI_MAX_HISTORY_MESSAGES=20
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
```

If you omit the `GEMINI_API_KEY`, the backend will still boot and fall back to the template-based generator; however chat responses will no longer stream or reason like an LLM. The extra `GEMINI_*` knobs give you fine control over thinking budgets, temperature, and how much history to include.

Some useful overrides:

```
GEMINI_THINKING_BUDGET=0
GEMINI_TEMPERATURE=0.5
GEMINI_TOP_P=0.85
GEMINI_RESPONSE_MIME_TYPE=text/plain
```

## 3. Run the API

```bash
uvicorn main:app --reload --port 8000
```

The API exposes the same chat and dashboard endpoints, but responses are generated with the structured fallback logic baked into `backend/main.py`.

## 4. Frontend proxy

When running the Next.js frontend from the repository root, requests to `/api/backend` proxy to the FastAPI server above. Update `NEXT_PUBLIC_API_URL` if you deploy the backend separately.

## 5. Optional integrations

- **Supabase**: configure `SUPABASE_URL` and `SUPABASE_KEY` to persist chat history.
- **Google Calendar**: keep the existing Google OAuth credentials if you still want calendar sync.

With these steps you can develop against the backend that now streams from Gemini whenever a key is supplied.
