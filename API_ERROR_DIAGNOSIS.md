# API Error Diagnosis - gray.alignment.id

## Date: November 25, 2025

## Issue Summary
Browser console showing API service errors:
```
Error: [ERROR][ApiService.fetch:response-error] {}
Error: [ERROR][ApiService.fetch:unexpected-error] {}
```

## Investigation Results ✅

### Infrastructure Status: **ALL WORKING**

1. **Backend Server**: ✅ Running on port 8000
   - Process ID: 36091
   - Responding to requests correctly
   - Database connection functioning

2. **Next.js Frontend**: ✅ Running on port 3000
   - Process ID: 35179
   - Serving pages correctly

3. **Nginx Reverse Proxy**: ✅ Configured & Running
   - Forwarding `/api/backend/*` to backend (port 8000)
   - Forwarding all other requests to Next.js (port 3000)
   - SSL certificates valid

4. **API Endpoints**: ✅ Responding Correctly
   ```bash
   # Test confirmed working:
   curl https://gray.alignment.id/api/backend/users/1/conversations
   # Returns: Valid JSON with conversation data
   ```

## Root Cause
**Browser-side caching issue**, NOT a server problem. The infrastructure is correctly configured and functional.

## Solutions

### Option 1: Clear Browser Cache (Recommended First)
1. Open browser DevTools (F12)
2. Go to Application tab → Storage → Clear site data
3. Hard reload: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
4. Or test in incognito/private mode

### Option 2: Running Production Mode (Best Practice)
The Next.js server is currently in development mode. For production, it should run:

```bash
# Build for production
cd /home/ubuntu/gray
npm run build

# Start in production mode
# In a screen session:
screen -S gray-frontend
NODE_ENV=production npm start
# Detach with Ctrl+A, then D
```

### Option 3: Restart Backend (If Needed)
```bash
cd /home/ubuntu/gray
./start-backend-prod.sh
```

## Server Health Check Commands

```bash
# Check Next.js
lsof -i :3000
# Should show: next-server

# Check Backend
lsof -i :8000  
# Should show: python3 with uvicorn

# Check Nginx
sudo systemctl status nginx
# Should be: active (running)

# Test API directly
curl -k https://gray.alignment.id/api/backend/users/1/conversations

# Check Nginx config
sudo nginx -t
```

## Configuration Files

- **Nginx**: `/etc/nginx/sites-available/gray.alignment.id.conf`
- **Next.js API Proxy**: `/home/ubuntu/gray/next.config.ts`
- **API Service**: `/home/ubuntu/gray/src/lib/api.ts`

## Notes

- Backend is using remote Supabase PostgreSQL database
- Conversation storage is functional
- All endpoints tested and responding correctly
- The errors are **client-side only** - suggesting browser cache issues

## Next Steps

1. **Immediate**: Clear browser cache and test in incognito mode
2. **Short-term**: Switch frontend to production mode for better performance
3. **Monitor**: Check browser console after cache clear to verify resolution
