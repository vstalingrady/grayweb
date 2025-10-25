# User Profile Management System with AI Chat

This project integrates a FastAPI backend with a Next.js frontend to replace placeholder data with real user profiles, AI-powered chat sessions, and calendar events from a database.

## Features

- **Real User Profiles**: Fetches user data from database instead of hardcoded names
- **Profile Pictures**: Supports real profile images with fallback to avatars
- **Dynamic Roles**: User roles retrieved from database
- **AI-Powered Chat**: Real chat with Google Gemini AI integration
- **Conversation Persistence**: Chat history saved to Supabase
- **Markdown Support**: AI responses render with rich formatting
- **Calendar Events**: User-specific calendar events from database
- **Automatic User Creation**: Creates new users automatically when they first visit
- **Profile Pictures**: Supports real profile images with fallback to avatars
- **Dynamic Roles**: User roles retrieved from database
- **Chat Sessions**: Real chat history stored in database
- **Calendar Events**: User-specific calendar events from database
- **Automatic User Creation**: Creates new users automatically when they first visit

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
```

#### Getting API Keys

**Google Gemini API:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Replace `your_gemini_api_key_here` with your key

**Supabase (Optional - for chat persistence):**
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API to get your URL and anon key
4. Replace the placeholder values in your `.env` file

**Set up Supabase Table:**
In your Supabase project, go to the SQL Editor and run:

```sql
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NULL,
  history JSONB NULL,
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);
```

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
- `GET /supabase/health` verifies the Supabase client can be instantiated.
- `GET /supabase/table/{table_name}?limit=5` previews rows from a Supabase table (RLS must allow anon access).

## Supabase quick start

- Configure your Supabase project OAuth providers for Google and Discord to match the login buttons.
- The Next.js login form uses the helper in `src/lib/supabaseClient.ts` to create a browser client.
- The FastAPI service uses `supabase-py` to expose lightweight data previews without shipping database credentials to the client.

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
