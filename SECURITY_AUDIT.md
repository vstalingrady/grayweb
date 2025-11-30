# Security Audit Report for Gray Application
**Date:** 2025-11-28  
**Status:** 🔴 CRITICAL SECURITY ISSUES IDENTIFIED

## Executive Summary

This security audit has identified **CRITICAL VULNERABILITIES** in the Gray application that must be addressed immediately. The application currently lacks proper authentication and authorization mechanisms, exposing all user data and API endpoints to unauthorized access.

## 🚨 Critical Security Issues

### 1. **NO AUTHENTICATION/AUTHORIZATION [CRITICAL - P0]**

**Issue:** The backend API has NO authentication or authorization checks on ANY endpoints.

**Evidence:**
- `HTTPBearer` security is imported but **NEVER USED** as a dependency
- No `get_current_user` function exists
- No `Depends(security)` on any endpoint
- All user data endpoints are completely open:
  - `/users/{user_id}` - Anyone can access any user's data
  - `/users/{user_id}/plans` - Anyone can read/modify plans
  - `/users/{user_id}/habits` - Anyone can read/modify habits
  - `/users/{user_id}/reminders` - Anyone can read/modify reminders
  - `/users/{user_id}/calendar-events` - Anyone can access calendar
  - `/api/chat` - Anyone can chat as any user
  - `/api/conversation/{conversation_id}` - Anyone can read any conversation

**Impact:**
- ❌ Any user can access ANY other user's data by changing the `user_id` parameter
- ❌ Anyone can read private conversations, plans, habits, reminders
- ❌ Anyone can modify or delete other users' data
- ❌ No session management or token validation whatsoever
- ❌ Complete breach of user privacy and data integrity

**Recommendation:**
```python
# URGENT: Implement authentication middleware
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: databases.Database = Depends(get_database)
) -> User:
    """Verify JWT token and return current user"""
    try:
        token = credentials.credentials
        # Verify with Supabase AUTH
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        user = await db.fetch_one(
            users.select().where(users.c.auth_user_id == user_id)
        )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Then protect ALL endpoints:
@app.get("/users/{user_id}")
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),  # ADD THIS
    db: databases.Database = Depends(get_database)
):
    # Verify user can only access their own data
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    ...
```

---

### 2. **ENVIRONMENT SECRETS IN GIT [CRITICAL - P0]**

**Issue:** The `.env` file containing API keys and secrets may be committed to git.

**Evidence:**
- `.env` file exists: 4578 bytes
- `.gitignore` has `.env` listed but file exists in repository

**Impact:**
- ❌ API keys exposed in git history
- ❌ Database credentials potentially public
- ❌ Webhook secrets compromised
- ❌ VAPID keys for push notifications exposed

**Recommendation:**
```bash
# 1. Check if .env was ever committed
git log --all --full-history -- .env

# 2. If committed, remove from history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# 3. Rotate ALL secrets immediately:
- Regenerate Supabase API keys
- Rotate Gemini API key
- Rotate OpenRouter API key  
- Rotate Anthropic API key
- Generate new webhook secrets
- Generate new VAPID keys
- Update database passwords
```

---

### 3. **NO RATE LIMITING [HIGH - P1]**

**Issue:** No rate limiting on any endpoints.

**Impact:**
- ❌ API abuse possible (spam requests)
- ❌ DDoS vulnerability
- ❌ AI API cost explosion (Gemini/OpenRouter calls unlimited)
- ❌ No protection against brute force

**Recommendation:**
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to sensitive endpoints
@app.post("/api/chat")
@limiter.limit("20/minute")
async def chat(...):
    ...
```

---

### 4. **CORS MISCONFIGURATION [HIGH - P1]**

**Issue:** CORS is overly permissive in development mode.

**Evidence:**
```python
# Lines 503-525: Automatically adds ALL local network IPs
def _local_network_origins(ports: Iterable[int]) -> Set[str]:
    # Adds all network interfaces to CORS
```

**Impact:**
- ⚠️ Any machine on local network can access API in dev mode
- ⚠️ Opens attack surface for CSRF and XSS

**Recommendation:**
```python
# Be explicit about allowed origins
if os.getenv("ENVIRONMENT") == "production":
    ALLOWED_ORIGINS = ["https://gray.alignment.id"]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]
```

---

### 5. **WEAK WEBHOOK VALIDATION [HIGH - P1]**

**Issue:** Webhook validation is optional if secrets not configured.

**Evidence:**
```python
# Line 2260-2263: Gumroad webhook
if configured_secret and incoming_secret != configured_secret:
    raise HTTPException(status_code=401)
# If no secret is configured, webhook is accepted anyway!
```

**Impact:**
- ⚠️ Attackers can forge webhook calls
- ⚠️ User plan tiers can be manipulated
- ⚠️ Unauthorized premium access

**Recommendation:**
```python
# ALWAYS require webhook secrets in production
if os.getenv("ENVIRONMENT") == "production" and not GUMROAD_WEBHOOK_SECRET:
    raise HTTPException(status_code=503, detail="Webhook not configured")
```

---

### 6. **FILE UPLOAD VULNERABILITIES [MEDIUM - P2]**

**Issue:** File uploads lack security validation.

**Evidence:**
```python
@app.post("/api/uploads")
async def upload_media(
    file: UploadFile = File(...),
    user_id: int = Form(...)
):
    # No authentication check!
    # No file size validation
    # No file type validation
```

**Impact:**
- ⚠️ Arbitrary file upload
- ⚠️ Storage exhaustion attacks
- ⚠️ Malware distribution

**Recommendation:**
```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

@app.post("/api/uploads")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
    
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type")
```

---

### 7. **SQL INJECTION RISK [MEDIUM - P2]**

**Issue:** Direct SQL executions in migration functions.

**Evidence:**
```python
# Line 381: Direct SQL query
cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'...")
```

**Impact:**
- ⚠️ Potential SQL injection if user input reaches these queries

**Recommendation:**
- Use parameterized queries for all SQL
- Use SQLAlchemy's query builder exclusively

---

### 8. **NO INPUT VALIDATION [MEDIUM - P2]**

**Issue:** Limited input validation on many endpoints.

**Recommendation:**
```python
from pydantic import validator, constr

class UserCreate(BaseModel):
    email: EmailStr
    full_name: constr(min_length=1, max_length=255)
    
    @validator('full_name')
    def sanitize_name(cls, v):
        return bleach.clean(v, tags=[], strip=True)
```

---

### 9. **MISSING SECURITY HEADERS [LOW - P3]**

**Recommendation:**
```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response
```

---

## Priority Action Items

### ⚠️ Immediate (P0 - Within 24 hours)
1. ✅ Implement authentication/authorization on ALL endpoints
2. ✅ Check if .env was committed to git and rotate ALL secrets if exposed
3. ✅ Block public access to user data endpoints

### 🔴 Urgent (P1 - Within 1 week)
4. Add rate limiting to prevent API abuse
5. Fix CORS configuration for production
6. Enforce webhook signature validation
7. Review and fix SQL injection risks

### 🟡 Important (P2 - Within 2 weeks)
8. Add file upload security validation
9. Implement input sanitization
10. Add log sanitization for sensitive data

### 🟢 Nice to Have (P3 - Within 1 month)
11. Add security headers
12. Implement CSP policy
13. Add request validation middleware

---

## Security Checklist

- [ ] Authentication implemented on all endpoints
- [ ] Authorization checks for user data access
- [ ] Secrets rotated and never committed to git
- [ ] Rate limiting configured
- [ ] CORS properly configured for production
- [ ] Webhook signatures validated
- [ ] File uploads secured and validated
- [ ] SQL injection risks eliminated
- [ ] Input validation and sanitization
- [ ] Security headers configured
- [ ] Logging sanitized
- [ ] HTTPS enforced in production

---

## Conclusion

> [!CAUTION]
> **The Gray application has CRITICAL security vulnerabilities that must be addressed immediately before any production deployment.** The lack of authentication is a showstopper that exposes all user data.

**Estimated time to secure:** 2-3 developer weeks for P0/P1 issues.

**Risk if not fixed:** Complete data breach, unauthorized access, regulatory compliance violations (GDPR, CCPA), reputational damage.

---

*Last Updated: 2025-11-28*  
*Auditor: Antigravity AI Security Review*
