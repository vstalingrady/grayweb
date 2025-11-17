# Proactivity Configuration Guide

The proactivity engine now fully respects the UI presets shown in the DashboardView modal:

## Presets Available

### 1. **Frequent** - "Built for launch mode"
- **Times**: 09:00, 12:00, 18:00 (three touchpoints)
- **Messages**: Different at each time of day
  - **Morning (9 AM)**: "🌅 Good morning! Quick check-in time. What's your top priority today? (First touchpoint)"
  - **Afternoon (12 PM)**: "☀️ Midday momentum check! How's progress? Any blockers? (Second touchpoint)"
  - **Evening (6 PM)**: "🌙 Evening wrap-up! Reflect on today's wins and plan tomorrow. (Third touchpoint)"
- **Use Case**: Teams sprinting toward release, coordinating across time zones
- **Notification**: "🔔 Frequent Check-in"

### 2. **Daily** (Stay Close) - "One guided check-in every morning"
- **Times**: 09:00 (once daily, typically morning)
- **Messages**: Context-aware
  - If user has recent activity: "🌅 Good morning! Yesterday you completed {X} tasks. Let's keep that momentum going today. What's on your plate?"
  - Default: "🌅 Good morning! Time for your daily check-in. How are your plans and habits coming along? Any updates on your goals?"
- **Use Case**: Founders or leads wanting steady async cadence
- **Notification**: "🔔 Daily Check-in"

### 3. **Weekly** (Light Touch) - "End-of-week recap"
- **Times**: 16:30 (once per week, Friday end of day)
- **Messages**: Retrospective focus
  - If user has activity score: "📅 Weekly Review Time! Last week you scored {X}% completion. Let's look at highlights, gaps, and what's next for this week."
  - Default: "📅 It's time for your weekly review! Let's recap what you accomplished this week and plan next week's priorities."
- **Use Case**: Calmer seasons, teams that sync live daily
- **Notification**: "🔔 Weekly Check-in"

### 4. **Manual Only** - "Gray stays quiet"
- **Times**: None (disabled)
- **Messages**: None sent automatically
- **Use Case**: Exploration phases, temporary quiet periods
- **Notification**: None

### 5. **Custom** - User-defined
- **Times**: User can select any times they want
- **Messages**: Generic contextual
  - "👋 {Label}! How are your plans and habits progressing? Let's check in on your goals."
- **Use Case**: Teams with unique requirements
- **Notification**: "🔔 Custom Check-in"

## How The Engine Works

### Hybrid Scheduling (Real-time + Cron)

1. **Active sessions** subscribe to `GET /users/{user_id}/proactivity/stream` (SSE from `/g`). When a browser connects, the backend immediately evaluates that user. Any dispatched message is streamed back as `event: proactivity_message`.
2. **Offline coverage** is handled by APScheduler (see `backend/proactivity_engine.py`). Each user/time pair is registered as its own cron trigger in the user's timezone, so the message fires exactly at 09:00, 12:00, etc., without the old 10-minute polling loop.
3. **Duplicate guard** – the engine checks the latest `proactive_notifications` row and skips new sends if one already landed within the last 5 minutes. Manual triggers (`force=True`) bypass the time-window check but still respect the 5-minute duplicate guard.

This hybrid flow means:
- No wasted polling when nobody is online.
- Predictable cron-based delivery for offline users.
- Connected users get messages instantly as soon as they open `/g`.

### Message Generation

Messages are automatically generated based on:
- **Cadence preset** (Frequent, Daily, Weekly, Custom)
- **Time of day** (Morning 🌅, Afternoon ☀️, Evening 🌙)
- **User activity** (tasks completed, completion score)
- **User timezone** (for time period detection)

### Delivery

When triggered, the engine:

1. **Generates the message** - Context-aware, preset-specific
2. **Saves to general chat** - Appears in `/g` as assistant message
3. **Creates notification** - Browser notification in `proactive_notifications` table

## Configuration

### Environment Variables

No dedicated knob is required for the scheduler anymore. APScheduler runs in-process using the timezone information stored inside each user's settings. Keep `TZ` or host clock accurate so cron triggers stay aligned.

### Database Tables

**proactivity_settings**: User's chosen preset
```sql
user_id | payload (JSON)
--------|-----------------------------------------------------
1       | {"cadence": "Frequent", "times": ["09:00", "12:00", "18:00"], ...}
2       | {"cadence": "Daily", "times": ["09:00"], ...}
3       | {"cadence": "Weekly", "times": ["16:30"], ...}
4       | {"cadence": "Manual", "times": [], ...}
```

**general_chat_messages**: Messages in `/g`
```sql
user_id | role      | content                           | created_at
--------|-----------|-----------------------------------|-----------
1       | assistant | "🌅 Good morning! Quick check..." | 2025-11-17...
2       | assistant | "☀️ Midday momentum check!..."   | 2025-11-17...
```

**proactive_notifications**: Browser notifications
```sql
user_id | type     | title                  | message                       | sent_at
--------|----------|------------------------|-------------------------------|----------
1       | check_in | 🔔 Frequent Check-in   | "🌅 Good morning! Quick..." | 2025-11-17...
2       | check_in | 🔔 Daily Check-in      | "☀️ Midday momentum..."     | 2025-11-17...
```

## Testing

### Real-time Stream from `/g`

```bash
curl -N http://localhost:8000/users/1/proactivity/stream
```
You should see an initial `ready` event followed by either `proactivity_message` (if a message was due) or periodic `ping` events while the connection stays open.

### Manual Trigger All Users

```bash
curl -X POST http://localhost:8000/api/proactivity/evaluate
```

Response:
```json
{
  "status": "success",
  "evaluation_results": {
    "users_evaluated": 42,
    "messages_sent": 12,
    "errors": 0,
    "details": [
      {"user_id": 1, "type": "check_in", "status": "sent"},
      {"user_id": 2, "type": "check_in", "status": "sent"}
    ]
  }
}
```

### Manual Trigger Specific User

```bash
curl -X POST http://localhost:8000/users/1/proactivity/evaluate
```

Response:
```json
{
  "status": "success",
  "message": "Proactivity message sent"
}
```

### View User's Proactivity Settings

```bash
# Get user 1's settings
sqlite3 backend/users.db "SELECT payload FROM proactivity_settings WHERE user_id = 1"
```

Output:
```json
{
  "id": "proactivity-frequent",
  "cadence": "Frequent",
  "times": ["09:00", "12:00", "18:00"],
  "timezone": "Asia/Jakarta",
  "label": "Check-ins",
  "description": "Built for launch mode..."
}
```

## Examples

### Example 1: Frequent User at Different Times

User settings:
```json
{
  "cadence": "Frequent",
  "times": ["09:00", "12:00", "18:00"],
  "timezone": "US/Eastern"
}
```

At 9:00 AM Eastern:
- Message: "🌅 Good morning! Quick check-in time. What's your top priority today? (First touchpoint)"
- Appears in: `/g` general chat
- Notification: "🔔 Frequent Check-in"

At 12:00 PM Eastern:
- Message: "☀️ Midday momentum check! How's progress? Any blockers? (Second touchpoint)"
- Appears in: `/g` general chat
- Notification: "🔔 Frequent Check-in"

At 6:00 PM Eastern:
- Message: "🌙 Evening wrap-up! Reflect on today's wins and plan tomorrow. (Third touchpoint)"
- Appears in: `/g` general chat
- Notification: "🔔 Frequent Check-in"

### Example 2: Daily User with Activity

User settings:
```json
{
  "cadence": "Daily",
  "times": ["09:00"],
  "timezone": "Europe/London"
}
```

User's recent activity: 5 tasks completed yesterday

At 9:00 AM London time:
- Message: "🌅 Good morning! Yesterday you completed 5 tasks. Let's keep that momentum going today. What's on your plate?"
- Appears in: `/g` general chat
- Notification: "🔔 Daily Check-in"

### Example 3: Weekly User

User settings:
```json
{
  "cadence": "Weekly",
  "times": ["16:30"],
  "timezone": "Australia/Sydney"
}
```

User's activity score: 87% completion

Every Friday at 4:30 PM Sydney time:
- Message: "📅 Weekly Review Time! Last week you scored 87% completion. Let's look at highlights, gaps, and what's next for this week."
- Appears in: `/g` general chat
- Notification: "🔔 Weekly Check-in"

## Logging

All proactivity events are logged with structured format:

```
event_type: "proactivity_evaluation_start"
event_type: "proactivity_evaluation_complete"
  - users_evaluated: 42
  - messages_sent: 12
  - errors: 0

event_type: "proactivity_message_sent"
  - user_id: 1
  - cadence: "Frequent"
  - message_type: "check_in"

event_type: "proactivity_notification_sent"
  - user_id: 1
  - title: "🔔 Frequent Check-in"
```

Check logs in: `/home/vstaln/hackathon/backend/logs/`
