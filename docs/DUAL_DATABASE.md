# Dual Database Architecture

## Overview

Gray uses a **hybrid database approach** to optimize for both reliability and performance:

- **Remote Database (Supabase PostgreSQL)**: Critical auth and user data with automatic backups
- **Local Database (SQLite)**: Fast local storage for chat messages and user activity data

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Gray Application                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │   Remote (Supabase)  │      │   Local (SQLite)     │    │
│  │   PostgreSQL         │      │                       │    │
│  ├──────────────────────┤      ├──────────────────────┤    │
│  │ • users              │      │ • chat_sessions      │    │
│  │ • user_streaks       │      │ • general_chat_msgs  │    │
│  │ • push_subscriptions │      │ • plans              │    │
│  │ • google_credentials │      │ • habits             │    │
│  │                      │      │ • reminders          │    │
│  │ ✓ Backed up          │      │ • calendar_events    │    │
│  │ ✓ Accessible remote  │      │ • dashboard_pulses   │    │
│  │ ✗ Network latency    │      │ • media_uploads      │    │
│  └──────────────────────┘      │                       │    │
│                                 │ ✓ Fast (no network)  │    │
│                                 │ ✓ Works offline      │    │
│                                 │ ✗ Local only         │    │
│                                 └──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Table Distribution

### Remote Tables (Supabase)
**Critical data that needs backup and remote access:**
- `users` - User accounts and profiles
- `user_streaks` - User activity streaks
- `proactivity_push_subscriptions` - Web push notification subscriptions
- `google_calendar_credentials` - OAuth tokens for Google Calendar

### Local Tables (SQLite)
**High-frequency data that benefits from local speed:**
- `chat_sessions` - Chat conversation metadata
- `general_chat_messages` - General chat history
- `plans` - User plans and tasks
- `habits` - User habits tracking
- `reminders` - Reminder notifications
- `calendars` - Calendar metadata
- `calendar_events` - Calendar events
- `dashboard_pulses` - Dashboard activity snapshots
- `proactivity_settings` - Proactivity configuration
- `proactivity_logs` - Proactivity activity logs
- `file_search_stores` - File search indexes
- `media_uploads` - Media file metadata
- `context_cache` - AI context caching
- `proactive_notifications` - Proactive notification queue

## Setup

### 1. Configure Environment Variables

Add to your `.env` file:

```bash
# Remote database (Supabase)
REMOTE_DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Or auto-construct from Supabase credentials:
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_DB_PASSWORD=your-database-password

# Local database (SQLite)
LOCAL_DATABASE_URL=sqlite:///./backend/users.db
```

### 2. Run Migrations

**Remote (Supabase):**
```bash
# Apply the remote tables migration in Supabase dashboard
# Or use the Supabase CLI:
supabase db push
```

**Local (SQLite):**
```bash
# Local tables are auto-created on first run
python backend/ensure_db.py
```

### 3. Migrate Existing Data (Optional)

If you have existing local user data you want to move to Supabase:

```bash
python scripts/migrate_users_to_remote.py
```

## Usage in Code

The `db_config.py` module automatically routes queries to the correct database:

```python
from backend.db_config import get_db_for_table, db_config

# Automatically uses remote DB for users table
user_db = get_db_for_table("users")
await user_db.execute(users.insert().values(**user_data))

# Automatically uses local DB for chat messages
chat_db = get_db_for_table("general_chat_messages")
await chat_db.execute(messages.insert().values(**message_data))
```

## Benefits

### 🔒 Security & Reliability
- Critical auth data is backed up automatically by Supabase
- User accounts survive local machine failures
- Professional-grade PostgreSQL for production data

### ⚡ Performance
- Chat messages and user activity stored locally (no network latency)
- Instant responses for frequent operations
- Works offline for local data

### 💰 Cost Efficiency
- Only critical data uses paid remote storage
- Bulk data (chat history, events) stays local and free
- Reduced database costs at scale

### 🔄 Best of Both Worlds
- Remote access to user profiles from any device
- Fast local access to chat and activity data
- Flexible architecture that can evolve

## Backup Strategy

### Remote Data (Automatic)
Supabase automatically backs up:
- Daily backups (retained for 7 days on free tier)
- Point-in-time recovery available on paid tiers

### Local Data (Manual)
Recommended backup approach:
```bash
# Backup local database
cp backend/users.db backend/backups/users_$(date +%Y%m%d).db

# Or use automated backup script
python scripts/backup_local_db.py
```

## Migration Path

### Current: All Local
```
DATABASE_URL=sqlite:///./backend/users.db
```

### Hybrid: Dual Database (Recommended)
```
REMOTE_DATABASE_URL=postgresql://...
LOCAL_DATABASE_URL=sqlite:///./backend/users.db
```

### Future: All Remote (Optional)
```
DATABASE_URL=postgresql://...
# (Keep LOCAL_DATABASE_URL for caching)
```

## Troubleshooting

### Remote connection fails
- Check `REMOTE_DATABASE_URL` or `SUPABASE_DB_PASSWORD`
- Verify Supabase project is active
- Check network connectivity

### Local database locked
- Close other processes accessing the SQLite file
- Check file permissions on `backend/users.db`

### Table not found
- Verify table is in correct database (see table distribution above)
- Run migrations for both databases

## Development vs Production

### Development
- Use local SQLite for both (fast iteration)
- Set `REMOTE_DATABASE_URL=""` to disable remote

### Production
- Use Supabase for remote tables (reliability)
- Use local SQLite or remote PostgreSQL for data tables

---

**Questions?** Check the [main README](../README.md) or open an issue.
