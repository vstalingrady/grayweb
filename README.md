# gray_hackathon

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the noir-themed sign-in experience. The interface uses Supabase auth to support Google, Discord, and email/password flows out of the box.

## Auth experience

- OAuth buttons call `supabase.auth.signInWithOAuth` for Google and Discord.
- Email/password form is backed by `supabase.auth.signInWithPassword`, with inline validation and status messages.
- Fonts: Plus Jakarta Sans for primary typography and IBM Plex Mono for supporting details.
- Styling lives in `src/components/LoginForm.module.css` and `src/app/page.module.css`.

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
