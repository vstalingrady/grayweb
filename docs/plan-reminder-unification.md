# Plan / Reminder Unification Spec

## 1. Goal
Collapse Gray’s “plan” and “reminder” experiences into a single canonical entity so that MCP actions, backend storage, and UI chips all flow through one reminder pipeline. Users can opt to treat a reminder as a persistent “plan” via a toggle rather than writing to a separate plans table.

## 2. Current State
| Area | Details | References |
| --- | --- | --- |
| Tables | `plans`, `habits`, `reminders` are distinct. Reminders already carry `entity_type`, `entity_id`, metadata. | `backend/main.py`: plans table ~558; reminders table ~585 |
| MCP actions | `_create_plan_entry_from_action` writes to `plans`; `_create_reminder_entry_from_action` stores the actual reminder. UI chips stitch together the `record` (plan or habit) & reminder entry. | `backend/main.py` lines 3360–3480 |
| API | `/users/:id/plans` CRUD, `/users/:id/reminders` CRUD. Frontend reminder panel uses `/reminders`. | `backend/main.py` ~5540 & ~5690 |
| UI | `ChatView` renders chips from `GrayReminderCreatedPayload` (type `gray.reminder`). `ReminderPanel` lists reminders; plans UI reads separate payload. | `src/components/gray/ChatView.tsx`, `src/components/gray/ReminderPanel.tsx` |

## 3. Proposed Unified Model
1. **Single storage**: use `reminders` as source of truth; every MCP action creates one reminder row.
2. **Mode flag**: add `delivery_mode` (`"plan"` or `"reminder"`) to `reminders`. Replace the existing `entity_type` usage (still keep `plan` vs `habit` semantics) but use `delivery_mode` to drive UX (plan view vs typical reminder list).
3. **Legacy plans**: backfill `plans` rows into `reminders` with `delivery_mode = "plan"` and metadata copied from schedule/deadline; once verified, deprecate `plans` table or keep as historical log.
4. **Toggle**: when creating a reminder, user can select plan/reminder mode; MCP defaults to plan mode for plan actions, habit mode for habit actions.

## 4. Backend Changes
### 4.1 Schema / Data Migration
- Add nullable `delivery_mode` (text) and `summary` columns to `reminders`.
- Create migration script to:
  1. Insert each `plans` row into `reminders` with `entity_type="plan"`, `delivery_mode="plan"`, `remind_at` parsed from `deadline`/`schedule_slot`.
  2. Link new reminder row back to plan `id` via `entity_id`.
  3. Optionally mark legacy plan rows as migrated (extra column or delete after verification).
- Update ORM definitions (or raw SQL metadata in `backend/main.py`) to include the new columns.

### 4.2 API Surface
- `/users/:id/reminders`:
  - Accept query params `delivery_mode` and `entity_type`.
  - Response includes new fields (`delivery_mode`, `summary`).
- `/users/:id/plans`:
  - Temporarily proxy to `/reminders?delivery_mode=plan`.
  - Mark as deprecated and remove once clients migrate.
- Ensure reminder worker (`_reminder_dispatch_loop`) respects `delivery_mode`: plan reminders may not require push notifications, but they should still emit context if `remind_at` is set.

### 4.3 MCP Emission
- `_create_reminders_from_actions` should skip `_create_plan_entry_from_action`; instead, persist a reminder row with `delivery_mode = "plan"` and include any plan-specific metadata inside `metadata`.
- `_build_gray_reminder_block`:
  - Emit `delivery_mode`.
  - Include `data.mode_label` for UI (“Plan reminder”, “Habit reminder”).
- `_augment_final_response`: update confirmation copy to mention “plan reminder” vs “habit reminder”.

## 5. Frontend Changes
### 5.1 Data layer
- Update `Reminder` type in `src/lib/api.ts` with `delivery_mode` & `summary`.
- Ensure `apiService.getUserReminders` accepts filters.

### 5.2 Chat reminder chips
- `ChatProvider` / `ChatView` should read `delivery_mode` from `GrayReminderCreatedPayload`. If absent, fall back to `entity`.
- Title text becomes:
  - `Plan reminder saved` for `delivery_mode === "plan"`.
  - `Habit reminder logged` for habits.
  - `Reminder scheduled` for plain reminders.

### 5.3 Reminder Panel & Dashboard
- Render filters or tabs (Plan / Reminder).
- “Add Reminder” modal obtains toggle value and submits `delivery_mode`.
- Current plan UI (if any) should consume reminders filtered by `delivery_mode=plan`.

### 5.4 Settings Toggle
- Add a preference (per user) stored either client-side or via `proactivity settings` to choose default delivery mode.
- When user changes toggle near composer, include that in the next MCP request metadata so the assistant knows whether to store as plan vs reminder.

## 6. Migration / Rollout Plan
1. **Phase 1 (this doc)**: finalize spec, confirm naming (`delivery_mode`, `summary`, etc.).
2. **Phase 2**: add columns + backfill job. Keep both plan/reminder APIs functional but mark plan API as deprecated.
3. **Phase 3**: update MCP pipeline and reminder chips (UI still works, showing new titles but same data).
4. **Phase 4**: release reminder panel toggle + composer setting. After adoption, remove legacy `plans` endpoints.

## 7. Risks & Considerations
- **Migration safety**: need a reversible script in case `plans` data fails to map to `reminders` (some rows may lack schedule/deadline).
- **Notification semantics**: plan reminders might not require notifications; decide whether to skip worker dispatch when `delivery_mode="plan"` and `remind_at` is null.
- **API consumers**: ensure any external integrations using `/plans` are informed.
- **UI states**: remind to update tests/storybook for new reminder metadata.

---
Next action: implement Phase 2 (schema migration + API changes) per this spec once approved. 
