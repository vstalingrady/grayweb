# Proactivity Engine - Next Steps for New Session

## Current Status

✅ **Completed:**
- Proactivity settings are now saved to database correctly with logging
- Chat title auto-generation working (AI extracts titles from responses)
- Proactivity scheduler created with smart message generation based on presets (Frequent, Daily, Weekly, Custom, Manual)
- Messages send to general chat (`/g`) and create browser notifications
- Settings structure supports multiple times per day (e.g., 09:00, 12:00, 18:00 for "Frequent" preset)
- All Discord rate-limiting logic removed (not needed for web)

❌ **Problem Identified:**
The current scheduler runs every 10 minutes checking all users - this is inefficient and not intuitive for a web app.

## What Needs to Happen

**Remove the inefficient 10-minute polling scheduler and replace with one of these approaches:**

### Option 1: On-Demand via WebSocket/SSE (RECOMMENDED)
- When user connects to `/g` (opens general chat), backend checks if it's time for a proactivity message
- If yes, send message immediately through WebSocket/SSE connection
- Only evaluates when user is actively using the app
- **Pros:** Real-time, efficient, no wasted checks
- **Cons:** Only works when user is online

### Option 2: Cron Job with APScheduler
- Use Python's APScheduler to run actual scheduled jobs at exact times (9:00 AM UTC for all users, 12:00 PM UTC, etc.)
- Convert each user's local time to when it should trigger
- Jobs run once per configured time slot per day
- **Pros:** Predictable, runs at exact times
- **Cons:** More complex setup, runs whether user is online or not

### Option 3: Message Queue Approach
- User sets up preferences → message gets queued for specific time
- Background worker processes queue at scheduled times
- **Pros:** Flexible, scalable
- **Cons:** Requires additional infrastructure

### Option 4: Frontend-Triggered
- When user navigates to `/g`, frontend calls backend endpoint to check if message is due
- Backend evaluates and sends if it's within the time window
- **Pros:** Simple, no background job needed
- **Cons:** Only works when user actively navigates

### Option 5: Hybrid (Online + Offline)
- WebSocket check when user is active in app
- Background job for users who are offline at scheduled time (they get message when they next log in)
- **Pros:** Best of both worlds
- **Cons:** Most complex

## Files to Remove/Modify

**Remove entirely:**
- `/home/vstaln/hackathon/backend/proactivity_scheduler.py` - The current 10-minute polling scheduler
- The startup/shutdown events in `main.py` related to scheduler initialization

**Keep and modify:**
- `main.py` - Remove scheduler startup/shutdown, keep the message generation logic and API endpoints
- `PROACTIVITY_CONFIG.md` - Update with new approach

## Key Implementation Details to Remember

1. **Proactivity Settings Structure** (what's in database):
```json
{
  "id": "proactivity-frequent",
  "cadence": "Frequent",
  "times": ["09:00", "12:00", "18:00"],
  "timezone": "Asia/Jakarta",
  "label": "Check-ins"
}
```

2. **Message Generation Logic** - Already implemented in scheduler, needs to be extracted to reusable function:
   - Frequent: Different messages for morning/afternoon/evening
   - Daily: Activity-aware messaging
   - Weekly: Score-based messaging
   - Custom: Generic messaging

3. **Delivery Points:**
   - Save to `general_chat_messages` table (appears in `/g`)
   - Create entry in `proactive_notifications` table (browser notification)

4. **API Endpoints Already Created:**
   - `POST /api/proactivity/evaluate` - Manual trigger all users
   - `POST /users/{user_id}/proactivity/evaluate` - Manual trigger specific user

## Questions to Answer Before Implementation

1. Should messages be sent to users who are offline at scheduled time?
   - If YES → Need background job
   - If NO → Only send when user is active in app

2. Should we support exact time scheduling (9:00 AM sharp) or flexible windows?
   - Current: 5-minute window (8:55-9:05 AM sends the message)

3. Do we need persistence of "already sent" state to prevent accidental duplicates?
   - If using WebSocket: Yes, track per session
   - If using Cron: Cron handles it automatically

4. What's the maximum number of concurrent users we expect?
   - Determines if 10-minute polling would even be a problem

## Recommended Approach

**Suggested: Option 1 (WebSocket/SSE) + Option 2 (APScheduler) Hybrid**

Implement both:
1. When user opens app/connects to `/g` → check if message is due, send immediately
2. For offline users → APScheduler runs at times and stores message in queue
3. When user logs in later → they see queued messages

This way:
- Active users get real-time messages
- Offline users don't miss them
- No wasteful polling
- Predictable scheduling

## Next Session TODO

1. Decide on approach (ask user which option they prefer)
2. Remove the current 10-minute scheduler
3. Implement chosen approach
4. Extract message generation into reusable utility function
5. Test end-to-end with different timezones and presets
6. Frontend: Add notification display UI
7. Frontend: Add WebSocket/SSE subscription to `/g`
