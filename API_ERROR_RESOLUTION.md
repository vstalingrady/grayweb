# API Error Resolution - gray.alignment.id

## Date: November 25, 2025

## Problem
Browser console showing repeated API errors:
```
Error: [ERROR][ApiService.fetch:response-error] {}
Error: [ERROR][ApiService.fetch:unexpected-error] {}
```

## Root Cause  **FOUND & FIXED** ✅

**Missing Python dependency: `python-dateutil`**

### Investigation Trail
1. Initial suspicion: Browser caching or infrastructure issues
2. Tested backend directly: Working ✅
3. Tested Nginx proxy: Working ✅  
4. Checked Nginx access logs: **Found HTTP 500 errors**
5. Discovered actual error in stack trace:
   ```
   ApiError: Error fetching conversation: No module named 'dateutil'
   ```

### Affected Endpoints
- `GET /api/backend/api/conversation/general:1` → HTTP 500
- `GET /api/backend/api/conversation/general:1/usage` → HTTP 500
- Any endpoint using conversation history with timestamps

## Solution Applied

### 1. Installed Missing Dependency
```bash
.venv/bin/pip install python-dateutil
```

### 2. Updated requirements.txt
Added: `python-dateutil==2.9.0.post0`

### 3. Restarted Backend Server
```bash
./start-backend-prod.sh
```

## Verification

### Before Fix
```bash
curl https://gray.alignment.id/api/backend/api/conversation/general:1
# Result: HTTP 500 Internal Server Error
```

### After Fix ✅
```bash
curl https://gray.alignment.id/api/backend/api/conversation/general:1
# Result: HTTP 200 with conversation data:
[
  {"role":"user","text":"","timestamp":1764012024124},
  {"role":"user","text":"hello","timestamp":1764012027525},
  {"role":"model","text":"Hello. How can I help you focus or plan today?","timestamp":1764012029862}
]
```

```bash
curl https://gray.alignment.id/api/backend/api/conversation/general:1/usage
# Result: HTTP 200 with usage stats:
{
  "conversation_id": "general:1",
  "message_count": 3,
  "conversation_tokens": 15,
  "limit": 65536,
  "provider": "gemini",
  "model_name": "gemini-flash-latest",
  "model_label": "gemini-flash-latest",
  "user_tier": "scout"
}
```

## Additional Improvements Made

### Enhanced Error Logging
Modified `/home/ubuntu/gray/src/lib/api.ts` to provide better error details:
- Added human-readable error messages
- Improved error serialization in console output
- Now shows actual HTTP status codes and error messages

## Current Status

### ✅ RESOLVED
- All conversation API endpoints now working
- HTTP 500 errors eliminated
- Timestamps properly parsed and returned
- Frontend can load conversation history without errors

## Files Modified

1. **requirements.txt** - Added python-dateutil dependency
2. **src/lib/api.ts** - Enhanced error logging (better diagnostics for future)

## Server Status

- **Backend**: Running on port 8000 (PID: 40738)
- **Frontend**: Running on port 3000
- **Nginx**: Active, properly proxying requests
- **SSL**: Valid certificates

## Testing Checklist

- [x] Backend responds to health checks
- [x] Conversation endpoint returns data
- [x] Conversation usage endpoint works
- [x] Timestamps properly formatted
- [x] No more HTTP 500 errors in logs
- [x] Frontend errors should resolve on next page load

## Next Steps

1. **Refresh the browser** - Hard reload (Ctrl+Shift+R) or visit https://gray.alignment.id/g in incognito
2. **Verify**: The API errors should no longer appear in browser console
3. **Monitor**: Check for any remaining issues

## Prevention

- All Python dependencies now documented in `requirements.txt`
- Enhanced error logging will catch similar issues faster
- Regular dependency audits recommended

## Notes

- The error was hidden because error objects were being logged as empty `{}`
- Nginx logs were crucial in identifying the actual HTTP 500 responses
- The `python-dateutil` library is used by the conversation history code to parse ISO timestamps
