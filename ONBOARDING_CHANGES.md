# Onboarding Flow - AI-Driven vs Hard-Coded

## ✅ CHANGES MADE

### 1. Updated Onboarding Prompt (`backend/prompts/onboarding.txt`)
- Replaced brief 2-question onboarding with comprehensive AI-guided flow
- AI now introduces itself warmly with clear value proposition
- Structured 9-stage conversation flow with detailed instructions
- AI asks questions naturally and conversationally, not robotically

### 2. Disabled Hard-Coded Questionnaire (`src/components/gray/ChatProvider.tsx`)
**Before:**
```typescript
if (isNotPersonalized && (isChatEmpty || !user.has_seen_general_chat)) {
  console.log('[ChatProvider] Triggering questionnaire (quick mode)');
  startQuestionnaire('quick');  // ❌ Hard-coded questions
}
```

**After:**
```typescript
if (isNotPersonalized && (isChatEmpty || !user.has_seen_general_chat)) {
  console.log('[ChatProvider] Triggering AI-driven onboarding');
  void sendGeneralMessage('');  // ✅ AI-driven conversation
}
```

### 3. Backend Already Configured! (`backend/main.py` lines 4181-4196)
The backend automatically:
- Detects new users via `has_seen_general_chat` flag
- Applies `ONBOARDING_SYSTEM_PROMPT` for first-time users
- Marks user as seen after first interaction

## HOW IT WORKS NOW

### First-Time User Flow:
1. **User visits `/g`** → Frontend checks if `personalization_nickname` exists
2. **No nickname found** → `sendGeneralMessage('')` is called (empty message)
3. **Backend receives request** → Sees `has_seen_general_chat = false`
4. **Backend applies onboarding prompt** → AI follows the comprehensive guide
5. **AI intro appears:**
   ```
   👋 Hey, I'm Gray.
   
   I'm your AI accountability partner—think of me as the mentor/coach 
   you wish you had, always in your pocket, always honest.
   
   Here's what I do:
   • Check in with you regularly (you decide when)
   • Remember everything about your goals, habits, patterns
   ...
   
   Ready to get started?
   ```
6. **Natural conversation begins** → AI asks questions one at a time
7. **User completes onboarding** → AI guides through all 9 stages naturally

## ONBOARDING STAGES (AI-GUIDED)

The AI now guides users through:
1. **Introduction** - Warm greeting, value prop, ask if ready
2. **Name** - "What should I call you?"
3. **Reason/Motivation** - Why are you here? What's on your mind?
4. **Obstacle** - What's stopping you? The real blocker?
5. **Goal (30-day)** - ONE thing to make progress on
6. **Success Vision** - What does success look like in 30 days?
7. **Check-in Cadence** - How often? (Frequent/Daily/Weekly/Custom)
8. **Set Expectations** - How I work, what to expect
9. **First Action** - Smallest thing you can do TODAY
10. **Close** - Welcome message, when I'll check back

## NO MORE HARD-CODED QUESTIONS

**Before (BAD):**
```
What name should I use when I hype you up?
Drop the first name or nickname you want to hear in check-ins.
```
→ Too robotic, no context, Gray hasn't even introduced itself

**After (GOOD):**
The AI naturally introduces itself first, then asks questions conversationally based on the context of the conversation. Much more human and engaging.

## FILES MODIFIED

1. ✅ `/home/ubuntu/gray/backend/prompts/onboarding.txt` - New AI instructions
2. ✅ `/home/ubuntu/gray/src/components/gray/ChatProvider.tsx` - Trigger AI onboarding
3. ℹ️ `/home/ubuntu/gray/backend/main.py` - Already configured (no changes needed)

## LEGACY CODE (Can be removed later)

The following files contain the old questionnaire system but are no longer used:
- `/home/ubuntu/gray/src/lib/questionnaire.ts` - Hard-coded questions
- `startQuestionnaire()`, `handleQuestionnaireResponse()` in ChatProvider

These can be safely removed in a future cleanup, but leaving them for now won't cause issues.

## TESTING

To test the new flow:
1. Create a new user account (or clear `personalization_nickname` field)
2. Visit `/g`
3. You should see AI's natural introduction instead of hard-coded question
4. Have a natural conversation through onboarding
5. AI will guide you through all stages conversationally

## BENEFITS

✅ More natural, conversational onboarding
✅ AI can adapt questions based on user responses
✅ Proper introduction before asking questions
✅ Maintains context throughout the conversation
✅ Single source of truth (backend prompt)
✅ Easy to iterate on the flow (just edit the prompt file)
