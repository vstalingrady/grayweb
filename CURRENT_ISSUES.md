# Fixes for Backend Issues

## Issue 1: Datetime Serialization Error

**Error**: `invalid input for query argument $3: datetime.datetime(2025, 11, 30, 0, 8, 49...) (expected str, got datetime)`

**Root Cause**: Line 2091 in `backend/main.py` passes `datetime.utcnow()` directly to a database query. This works for SQLite but fails for PostgreSQL/Supabase.

**Fix Applied**: Need to convert to ISO string format.

## Issue 2: Missing Starting Message for New Users

**Status**: ✅  The frontend logic is correct - it sends an empty message to trigger onboarding.

**Root Cause**: The backend is likely crashing due to Issue 1 before it can respond with the starter message.

## Implementation Steps

1. Fix the datetime serialization in the _insert_general_conversation_message function
2. Check DATABASE_URL to see if it's pointing to PostgreSQL instead of SQLite
3. Verify the backend can handle empty messages for onboarding

