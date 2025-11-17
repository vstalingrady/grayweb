# Proactivity System Design

Gray’s proactive layer should feel like a person who knows when to reach out, not a bot on a timer. This document captures the experience goals and the guardrails the AI orchestrator needs so check-ins land at the right moment with the right tone.

## Layered Experience

### Layer 1: Smart Default Timing
- **Default ritual:** Morning (8–10 AM), midday (1–3 PM), and evening (8–10 PM) check-ins that set intentions, provide a midday reality check, and close the loop with evening reflection.
- **Frequency adaptation:** Use a rolling engagement score rather than gut feel.
  - Track the last 6 attempted check-ins (or all in the last 7 days, whichever is greater).  
  - `engagement_score = responses / attempts` within that window.
  - ≥ 0.66 → keep current frequency.  
  - 0.33–0.65 → downshift one level (e.g., from 3x to 2x daily).  
  - < 0.33 → morning-only until engagement recovers.  
  - ≥ 0.85 for 10 consecutive days → offer to increase frequency.
- **Spacing guardrails:** prevent back-to-back pings. Minimum time since the last check-in:

| Frequency preset | Min gap between check-ins | Daily windows |
| --- | --- | --- |
| Frequent (3x) | ≥ 3 hours | Morning, midday, evening |
| Daily (1x) | ≥ 20 hours | Morning window |
| Weekly | ≥ 5 days | Friday reflection window |
| Custom | Respect explicit times but still keep ≥ 2 hours between pings |

### Layer 2: Context-Triggered Check-ins
- **Commitment-based:** “Ship by Nov 15” → ping on Nov 14 with a challenging tone.
- **Pattern-based:** If they always stall at 3 PM, send a prompt at 2:45 PM: “You usually hit a wall around now…”
- **Absence-based:** If `engagement_score` drops because they’ve been quiet for 3 days, nudge with concern.
- **Emotion-based:** If the last message was frustrated, follow up ~2 hours later.
- **Progress-based:** If a project is stuck for 2 weeks, push for a meta conversation.

### Layer 3: User-Controlled Preferences
- **Presets:** Frequent (3x daily), Daily (1x morning), Weekly (Friday reflection), Off, Custom.
- **AI nudges:** After two weeks, propose adjustments based on actual engagement (“You haven’t responded to evening check-ins—pause them?” or “You engage most at 9 AM—want me to focus there?”).

### Layer 4: Intelligent Timing Within Windows
- Operate inside windows but avoid robotic precision. Respect calendar availability, observed response times, and upcoming commitments when picking the exact minute.
- Example: Morning window ping shifts to 8:30 AM if a 9 AM meeting is on the calendar; if they consistently reply at 8:45 AM, bias toward that minute.

### Layer 5: Respect Do-Not-Disturb Signals
- Detect when not to interrupt (meetings, focus blocks, sleep hours, or explicit “not now”).  
- When DND triggers, **queue** the check-in instead of skipping forever:
  - Output `should_check_in: false`, `reason: "do_not_disturb"`, and supply a `next_check_time`.
  - Once the window opens, re-run the decision with the queued reason noted so the user still receives the intended follow-up.

## Trigger Priority
When multiple triggers fire simultaneously, keep the behavior deterministic:
1. **Do not disturb / user busy** (never interrupt).  
2. **Commitment deadlines** (most urgent).  
3. **Pattern triggers** (predictable friction).  
4. **Emotional follow-ups** (recent affect).  
5. **Long absences / engagement recovery.**  
6. **Scheduled windows** (default cadence).

Only surface one reason in the payload—the highest-priority active trigger.

## AI Orchestrator Prompt
You are the proactivity orchestrator for Gray, an AI mentor. Decide **when** to check in and **what** to ask so it feels timely, personal, and actionable.

### Context Available
- User goals, commitments, and deadlines.
- Recent messages + inferred emotional tone.
- Engagement score + preferred frequency preset.
- Historical patterns (productive hours, stuck hours, response latencies).
- Calendar + current activity.
- Time since last check-in and queued reminders.

### Decision Process
1. **Should I check in now?**
   - Verify we are inside an eligible window for the user’s preset.
   - Enforce the minimum gap from the table above.
   - Evaluate trigger precedence; if a higher-priority trigger is active, honor it.
   - Respect DND signals; if the user is unavailable, schedule the next attempt and return `should_check_in: false`.
   - Factor engagement score: if they are ignoring recent pings, bias toward reducing frequency or switching tone before reaching out again.
2. **What should I ask?**
   - Anchor on the highest-priority context (e.g., “You said you’d finish the RAG system today…”).
   - Reference current status, emotion, or pattern.
   - Provide a next action (“Want me to help break it down?”).
   - Choose tone: supportive, challenging, celebratory, or concerned.

### Output
- If reaching out:
  ```json
  {
    "should_check_in": true,
    "reason": "commitment_deadline" | "scheduled_morning" | "pattern_trigger" | "long_absence" | "emotional_followup",
    "message": "<personalized prompt>",
    "tone": "supportive" | "challenging" | "celebratory" | "concerned"
  }
  ```
- If holding off:
  ```json
  {
    "should_check_in": false,
    "reason": "too_soon" | "user_busy" | "reducing_frequency" | "do_not_disturb",
    "next_check_time": "<timestamp>"
  }
  ```

### Examples
- **Commitment deadline:** “Tomorrow’s your ship date. Real talk—are you launching or do we need to adjust?”
- **Long absence:** “You’ve been quiet for almost a week. Everything okay?”
- **Do not disturb:** At 2 AM local, respond with `should_check_in: false`, `reason: "do_not_disturb"`, `next_check_time: "08:30 local"`.

## Implementation Priority
- **Phase 1 (MVP – ship in 2 weeks):** Manual presets, baseline morning/midday/evening scheduler, simple commitment tracking.
- **Phase 2 (post-launch):** AI orchestrator, calendar integration, engagement-based frequency tuning backed by the quantitative rules above.
- **Phase 3 (after PMF):** Pattern-triggered nudges, emotional-state tracking, fully context-aware proactivity.

Quality beats volume—one meaningful, context-rich check-in is better than three generic nudges.
