# Dual Database Quick Start

## What You Get

✅ **Remote (Supabase)**: User accounts, auth, credentials → **Backed up automatically**  
✅ **Local (SQLite)**: Chat messages, plans, habits → **Lightning fast, no network lag**

## Setup (5 minutes)

### 1. Get Your Supabase Database Password

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Copy your database password (or reset it if you forgot)

### 2. Update Your `.env`

Add these lines to your `.env` file:

```bash
# Your Supabase database password
SUPABASE_DB_PASSWORD=your_actual_password_here

# Local database (already set, just verify)
LOCAL_DATABASE_URL=sqlite:///./backend/users.db
```

The `REMOTE_DATABASE_URL` will be auto-constructed from your existing `SUPABASE_URL` + `SUPABASE_DB_PASSWORD`.

### 3. Install asyncpg (if needed)

```bash
pip install asyncpg
```

### 4. Run the Migration

```bash
python scripts/apply_remote_migration.py
```

You should see:
```
✅ Connected successfully!
✅ Migration applied successfully!
📊 Created 3 remote tables:
   ✓ google_calendar_credentials
   ✓ proactivity_push_subscriptions
   ✓ users
🎉 Remote database setup complete!
```

### 5. Restart Your Backend

```bash
# Stop your current backend (Ctrl+C)
# Then restart:
python backend/start.py
```

## That's It! 🎉

Your setup is now:
- **User accounts** → Supabase (backed up, accessible anywhere)
- **Chat & activity** → Local SQLite (fast, no latency)

## Verify It's Working

Check your backend logs on startup. You should see:
```
Connected to remote database (Supabase)
Connected to local database (SQLite)
```

## Troubleshooting

### "Cannot connect to remote database"
- Check your `SUPABASE_DB_PASSWORD` is correct
- Verify your Supabase project is active
- Check your internet connection

### "asyncpg not installed"
```bash
pip install asyncpg
```

### "Migration file not found"
Make sure you're running from the project root:
```bash
cd /home/ubuntu/gray
python scripts/apply_remote_migration.py
```

## What Changed?

**Before:**
```
All data → Local SQLite
```

**After:**
```
User accounts → Remote Supabase (backed up)
Chat & data  → Local SQLite (fast)
```

## Rollback (if needed)

To go back to all-local:

1. Comment out in `.env`:
   ```bash
   # REMOTE_DATABASE_URL=...
   # SUPABASE_DB_PASSWORD=...
   ```

2. Restart backend

The system will fall back to local-only mode.

---

**Need help?** Check [DUAL_DATABASE.md](./DUAL_DATABASE.md) for full documentation.
