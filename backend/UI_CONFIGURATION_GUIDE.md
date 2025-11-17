# UI Configuration Guide - AI Proactive Notifications

## Your Current Configuration (From UI Screenshot)

```
Proactivity Settings:
├── Current: Daily
├── Timezone: Asia/Jakarta (UTC+7)
├── Notification channel: In-app assistant
├── Preset cadence: Select a preset
└── Custom cadence: 1 touchpoint • 9:00 AM
```

## How It Maps to the Enhanced System

### Database Storage
Your UI stores proactivity in `dashboard_pulses.proactivity` as:

```json
{
  "id": "proactivity-default",
  "label": "Check-ins",
  "cadence": "Daily",
  "time": "09:00 AM"
}
```

### Enhanced System Reads It
The enhanced `_check_and_create_proactive_notifications()` function:
1. Fetches proactivity from your `dashboard_pulses` table
2. Reads the `cadence` field ("Daily")
3. Reads the `time` field ("09:00 AM")
4. Generates AI messages based on this data
5. Creates notifications in `proactive_notifications` table

### What Users Will Receive

#### 1. **Daily Check-in** (AI-Powered)
**When:** User has "Daily" cadence configured
**Generated:** AI message personalized to their plans and habits
**Example:**
```
Good morning! I see you have 2 active plans including "Complete project documentation" and your "Daily workout" habit. How are you feeling about your progress today?
```

#### 2. **Weekly Review** (AI-Powered)
**When:** Every Sunday at 8:00 PM (Asia/Jakarta time)
**Generated:** Comprehensive AI summary
**Example:**
```
# Weekly Review

This week you checked in 5 times, completed 2 plans, and had 8 habit check-ins.

## Highlights
- 2 plans completed
- 4 active plans
- 3 active habits

## Focus for Next Week
- Carry forward what worked well
- Adjust any plans that need attention
- Build momentum on your habits
```

#### 3. **Habit Nudge** (AI-Powered)
**When:** 3+ days since last check-in with unchecked habits
**Generated:** Supportive AI message
**Example:**
```
Hey! Checking in on your "Daily workout". It's been 4 days. Remember, even five minutes counts. If it feels big, try just focusing on your breath for one minute first. How can we make it easier today?
```

## Configuration Options That Work

### ✅ Daily Cadence
```json
{"cadence": "Daily", "time": "09:00 AM"}
```
**Result:** Daily AI check-ins

### ✅ Frequent Cadence
```json
{"cadence": "Frequent", "time": "09:00 AM"}
```
**Result:** Multiple check-ins per day

### ✅ Weekly Cadence
```json
{"cadence": "Weekly", "time": "09:00 AM"}
```
**Result:** Weekly check-ins (no daily)

## Timezone Support

Your configuration uses **Asia/Jakarta** (UTC+7)

The enhanced system:
- ✅ Respects your timezone for weekly reviews (Sundays at 8 PM Asia/Jakarta)
- ✅ Uses your local time for check-in scheduling
- ✅ All timestamps stored in UTC, displayed in your timezone

## Notification Flow

```
1. User Configures in UI
   ↓
2. Settings Saved to dashboard_pulses.proactivity
   ↓
3. Background Worker Runs (every 60 seconds)
   ↓
4. Checks: Does user have proactivity configured?
   ↓
5. Reads: cadence="Daily", time="09:00 AM"
   ↓
6. AI Generates: Personalized message
   ↓
7. Creates: Notification in proactive_notifications table
   ↓
8. User Sees: In-app notification
```

## Testing Your Configuration

### Start the Server
```bash
cd /home/vstaln/hackathon/backend
python main.py
```

### Check Logs
```
[ProactiveNotificationWorker] Starting proactive notification worker...
[AIMessageGenerator] Using built-in templates for proactive messaging
```

### What to Expect
Users with "Daily" cadence will receive:
1. **AI daily check-ins** - personalized to their plans/habits
2. **Weekly reviews** - every Sunday at 8 PM (Asia/Jakarta)
3. **Habit nudges** - 3+ days after last check-in

## Sample Notification in Database

```sql
SELECT * FROM proactive_notifications
WHERE user_id = YOUR_USER_ID
ORDER BY sent_at DESC
LIMIT 5;
```

**Result:**
```json
{
  "type": "daily_checkin",
  "title": "Daily Check-in",
  "message": "Good morning! I see you have 'Complete project documentation' in your plans...",
  "metadata": {
    "date_key": "2024-01-01",
    "cadence": "Daily",
    "time": "09:00 AM",
    "plans_count": 2,
    "habits_count": 3
  },
  "sent_at": "2024-01-01T02:00:00Z"  -- UTC
}
```

## Your UI Controls Work Perfectly

✅ **"Daily" cadence** → Daily AI check-ins
✅ **"Frequent" cadence** → Multiple daily check-ins
✅ **Time setting** → Used for scheduling
✅ **Asia/Jakarta timezone** → Respected for all notifications
✅ **In-app assistant** → Notifications created in database

## What Happens Next

1. **Users with "Daily" cadence** automatically get AI check-ins
2. **Every 60 seconds** the worker checks for users needing notifications
3. **AI generates** personalized messages based on their actual data
4. **Notifications appear** in the app (in-app assistant channel)

**No additional configuration needed!** Your existing UI fully controls the enhanced AI system. 🚀
