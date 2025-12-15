# User Profile Management System with AI Chat

This project integrates a FastAPI backend with a Next.js frontend to replace placeholder data with real user profiles, AI-powered chat sessions, and calendar events from a database.

## Features

- **Real User Profiles**: Fetches user data from database instead of hardcoded names
- **Profile Pictures**: Supports real profile images with fallback to avatars
- **Dynamic Roles**: User roles retrieved from database
- **AI-Powered Chat**: Real chat with Google Gemini AI integration
- **Conversation Persistence**: Chat history saved to the local database (SQLite by default)
- **Markdown Support**: AI responses render with rich formatting
- **Calendar Events**: User-specific calendar events from database
- **Automatic User Creation**: Creates new users automatically when they first visit
- **Profile Pictures**: Supports real profile images with fallback to avatars
- **Dynamic Roles**: User roles retrieved from database
- **Chat Sessions**: Real chat history stored in database
- **Calendar Events**: User-specific calendar events from database
- **Automatic User Creation**: Creates new users automatically when they first visit
- **Gemini Multimodal**: Supports image and PDF inputs so Gray can caption media or summarize documents using the same Flash models (see `docs/gemini-multimodal.md` for details)
- **Function Calling & Structured Output**: Gemini can invoke retrievers or tools and return schema-guaranteed JSON, so you can expose precise, parsable RAG results and actions (details in `docs/gemini-multimodal.md`).
- **Grounding with Google Maps**: Enable Gemini’s Maps grounding tool to inject accurate location-aware context, citations, and optional widgets whenever the user asks about places (also covered in `docs/gemini-multimodal.md`).
- **Long Context**: Gemini’s 1M+ token context window lets Gray keep entire project histories, documents, and media in a single prompt, avoiding clever truncation or RAG tricks for many workflows (see `docs/gemini-long-context.md` for details).

## Getting Started

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..
```

### 2. Environment Setup

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=sqlite:///./users.db
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
# Optional: Google Calendar integration
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
# Random string >=16 chars for signing OAuth state
GOOGLE_STATE_SECRET=change_me_to_a_long_random_value
# Fernet key for encrypting refresh tokens (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
GOOGLE_TOKEN_ENCRYPTION_KEY=your_fernet_key
# Optional override (defaults to localhost in dev, gray.alignment.id in prod)
# GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google-calendar/callback
# Optional: comma separated list of frontend origins allowed to call the API
# CORS_ALLOW_ORIGINS=https://your-frontend-domain.com,https://app.example.com
# By default the API allows every origin for local development.
# Set this flag to false if you want to fall back to the curated localhost list.
# CORS_ALLOW_ALL_ORIGINS=false
# Switch providers by setting AI_PROVIDER=anthropic and providing ANTHROPIC_API_KEY
```

By default responses now stream as quickly as Gemini returns them. If you ever need to
slow the token firehose (for example to match a UI animation), set
`GRAY_STREAMING_TOKEN_DELAY_SECONDS` in your `.env` to the number of seconds to wait
between streamed chunks (e.g. `0.02` for ~50 tokens/second).

Thread titles are generated from the same Gemini call that produces the reply, so there is
no extra round trip when a conversation starts. You can opt out by setting
`GEMINI_AUTO_THREAD_TITLES=false` if you prefer manual naming.

#### Getting API Keys

**Google Gemini API:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Replace `your_gemini_api_key_here` with your key

> **Tip:** The backend will look for the first non-placeholder value in
> `GEMINI_API_KEY`, `GEMINI_API_KEY_SECONDARY`, `GEMINI_API_KEY_TERTIARY`, or `GOOGLE_API_KEY`
> and keeps that secret synchronized on both variables so either name can hold the active key.

**Anthropic Claude (optional):**
1. Create an API key at [console.anthropic.com](https://console.anthropic.com/)
2. Add `ANTHROPIC_API_KEY` to your `.env`
3. Set `AI_PROVIDER=anthropic` to route chat and streaming requests through Claude instead of Gemini.
   (Leave it unset or `gemini` to keep using Gemini.)

Both the backend and frontend now read exclusively from the repo root `.env`, and the loader forces those values to override any pre-existing environment variables, so update the Gemini key (and other secrets) in that single file and restart the processes to pick up the change.

The backend now validates that key on startup by issuing a brief prompt through `GeminiService`. Set `VALIDATE_GEMINI_ON_STARTUP=false` in `.env` if you need to skip the validation call (e.g., to avoid extra quota while iterating locally).

**Supabase (Auth):**
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API to get your URL and anon key
4. Replace the placeholder values in your `.env` file

> **Note:** Supabase is used for authentication only. All application data (settings, conversations, plans, reminders, etc.)
> is stored in the service database (SQLite by default), not in Supabase tables.

### 3. Run the Application

You have two options:

#### Option 1: Run Frontend and Backend Separately

```bash
# Terminal 1: Start the backend
npm run backend

# Terminal 2: Start the frontend
npm run dev
```

#### Option 2: Run Both Together

```bash
# This will start both the backend and frontend concurrently
npm run dev:full
```

### 4. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Deployment (Dev + Prod on one server)

- Production (ports `3000/8000`):
  ```bash
  cd /home/ubuntu/gray
  git checkout prod   # or main, if you don't use a prod branch
  git pull
  docker compose -f docker-compose.yml up -d --build --remove-orphans
  ```
- Optional staging/dev stack on the same server (default ports `3000/8000`, separate SQLite in `data-dev/`):
  ```bash
  cd /home/ubuntu/gray
  git checkout main
  git pull
  docker compose -p gray-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build --remove-orphans
  ```
- Captcha (Turnstile) is automatically disabled on localhost and port `3000`.

## Auth experience

- OAuth buttons call `supabase.auth.signInWithOAuth` for Google and Discord.
- Email/password form is backed by `supabase.auth.signInWithPassword`, with inline validation and status messages.
- Fonts: Plus Jakarta Sans for primary typography and IBM Plex Mono for supporting details.
- Styling lives in `src/components/LoginForm.module.css` and `src/app/login/page.module.css`.

## Python API

Install the FastAPI backend dependencies and start the server:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Create a `.env` file in the repository root and set the following variables so the API can connect to PostgreSQL:

```
user=<db user>
password=<db password>
host=<db host>
port=<db port>
dbname=<db name>
SUPABASE_URL=<https://your-project.supabase.co>
SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SUPABASE_URL=<https://your-project.supabase.co>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
# Optional overrides for auth redirect targets (defaults to /alignmentid/gray)
# NEXT_PUBLIC_AUTH_REDIRECT=<https://gray.alignment.id>
# NEXT_PUBLIC_SITE_URL=<https://gray.alignment.id>
```

Visit [http://localhost:8000/docs](http://localhost:8000/docs) for the automatically generated FastAPI docs once the server is running.

- `GET /time` hits `SELECT NOW()` using the direct PostgreSQL connection.

## Supabase quick start

- Configure your Supabase project OAuth providers for Google and Discord to match the login buttons.
- For local development add `http://gray.localhost:3000/callback` to the Supabase **Redirect URLs** list (`http://localhost:3000/callback` is optional if you also sign in from plain `localhost`).
- The Next.js login form uses the helper in `src/lib/supabaseClient.ts` to create a browser client.
- The FastAPI service uses Supabase for authentication only (token validation fallback + account deletion in Supabase Auth).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

https://github.com/vladyslav-soltanovskyi/react-calendar.git
https://github.com/assistant-ui/assistant-ui.git
