"""Authentication and authorization utilities for Gray backend"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import databases
import sqlalchemy
import os
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timezone

import json
import hmac
import hashlib
import base64
from backend.time_utils import utcnow
import time
from backend.compat_imports import row_get as _row_get

from backend.tier_utils import bootstrap_plan_tier

import jwt  # type: ignore
from jwt import InvalidTokenError  # type: ignore
from jwt import PyJWKClient  # type: ignore

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# Simple in-memory cache for user lookups with TTL
_user_cache: Dict[str, tuple[Dict[str, Any], float]] = {}
_USER_CACHE_TTL = 10.0  # 10 seconds

# Redis cache (L2 - longer TTL, shared across processes)
from backend.redis_client import get_redis_client

_redis_client = get_redis_client()

# Optional, explicitly gated insecure fallback for local development.
# When enabled, the backend may accept JWTs that were NOT validated
# against Supabase or a shared secret, based only on their payload.
_NODE_ENV = os.getenv("NODE_ENV", "").strip().lower()
_ENVIRONMENT = os.getenv("ENVIRONMENT", "").strip().lower()
_IS_PRODUCTION = _NODE_ENV == "production" or _ENVIRONMENT == "production"

_ALLOW_INSECURE_JWT_FALLBACK_FLAG = (
    os.getenv("ALLOW_INSECURE_JWT_FALLBACK", "").strip().lower() in ("1", "true", "yes")
)
_ALLOW_INSECURE_JWT_FALLBACK = _ALLOW_INSECURE_JWT_FALLBACK_FLAG and not _IS_PRODUCTION

if _ALLOW_INSECURE_JWT_FALLBACK_FLAG and _IS_PRODUCTION:
    logger.error(
        "ALLOW_INSECURE_JWT_FALLBACK is enabled in production; ignoring for safety.",
        extra={"event_type": "auth_insecure_fallback_disabled"},
    )

def _normalize_email(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized or None


def _get_cached_user(email: str) -> Optional[Dict[str, Any]]:
    """Get user from L1 (in-memory) cache if valid."""
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None
    if normalized_email in _user_cache:
        user_data, timestamp = _user_cache[normalized_email]
        if time.time() - timestamp < _USER_CACHE_TTL:
            return user_data
        else:
            # Expired, remove from cache
            del _user_cache[normalized_email]
    return None


async def _get_cached_user_redis(email: str) -> Optional[Dict[str, Any]]:
    """Get user from Redis (L2 cache) - 5 minute TTL."""
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None
    if not _redis_client or not _redis_client.available:
        return None
    try:
        await _redis_client.ensure_connected()
        data = await _redis_client.get_session(f"user:{normalized_email}")
        if data:
            logger.debug(f"[REDIS] Cache hit for user {normalized_email}")
            return data
    except Exception as e:
        logger.debug(f"[REDIS] Cache miss or error for user {normalized_email}: {e}")
    return None


def _cache_user(email: str, user_data: Dict[str, Any]):
    """Cache user data in L1 (in-memory)."""
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return
    # Keep cache size reasonable (max 1000 entries)
    if len(_user_cache) > 1000:
        # Remove oldest 20% of entries
        sorted_items = sorted(_user_cache.items(), key=lambda x: x[1][1])
        for key, _ in sorted_items[:200]:
            del _user_cache[key]
    
    _user_cache[normalized_email] = (user_data, time.time())


async def _cache_user_redis(email: str, user_data: Dict[str, Any]):
    """Cache user data in Redis (L2) with 5 minute TTL."""
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return
    if not _redis_client or not _redis_client.available:
        return
    try:
        await _redis_client.ensure_connected()
        await _redis_client.set_session(f"user:{normalized_email}", user_data, ttl=300)
        logger.debug(f"[REDIS] Cached user {normalized_email}")
    except Exception as e:
        logger.debug(f"[REDIS] Failed to cache user {normalized_email}: {e}")


def invalidate_user_cache(email: str):
    """Manually invalidate user cache (e.g. after profile updates)."""
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return
    if normalized_email in _user_cache:
        del _user_cache[normalized_email]


async def invalidate_user_cache_redis(email: str):
    """Invalidate user cache in Redis."""
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return
    if not _redis_client or not _redis_client.available:
        return
    try:
        await _redis_client.ensure_connected()
        await _redis_client.delete_session(f"user:{normalized_email}")
        logger.debug(f"[REDIS] Invalidated cache for user {normalized_email}")
    except Exception as e:
        logger.debug(f"[REDIS] Cache invalidation failed for {normalized_email}: {e}")


def _decode_token_without_signature(token: str) -> Optional[Dict[str, Any]]:
    """Best-effort decode to recover payload when Supabase session lookup fails."""
    try:
        return jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_exp": True,
            },
        )
    except InvalidTokenError:
        return None
    except Exception as e:
        logger.debug(f"JWT decode failed unexpectedly: {e}")
        return None

# Minimal initials helper to avoid circular import
def _initials_from_name(name: Optional[str]) -> str:
    if not name:
        return "U"
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return parts[0][:2].upper()

# Prefer a display name derived from metadata or email
def _derive_full_name(email: Optional[str], metadata: Dict[str, Any]) -> str:
    for key in ("full_name", "name", "display_name"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if email and "@" in email:
        return email.split("@", 1)[0]
    return email or "User"

# Import Supabase client
from backend.supabase_utils import create_supabase_client, resolve_supabase_credentials


# =============================================================================
# JWT VERIFICATION USING JWKS (Public Key Verification)
# =============================================================================
# This is the recommended approach per Supabase docs:
# https://supabase.com/docs/guides/auth/jwts
# 
# Benefits over shared secret:
# - No secret to leak
# - Faster (local verification)
# - Supports key rotation
# =============================================================================

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Legacy, optional

_JWKS_CACHE_TTL_SECONDS = 600  # 10 minutes - aligns with Supabase usage
_jwk_client: Optional[Any] = None
_jwk_client_url: Optional[str] = None

def _get_jwks_url() -> Optional[str]:
    """Get the JWKS URL for the Supabase project."""
    # https://project-id.supabase.co/auth/v1/.well-known/jwks.json
    url, _, _ = resolve_supabase_credentials()
    if not url:
        return None
    base = url.rstrip("/")
    return f"{base}/auth/v1/.well-known/jwks.json"

def _get_jwk_client() -> Optional[Any]:
    """Get a cached PyJWKClient instance for the current Supabase JWKS URL."""
    global _jwk_client, _jwk_client_url
    jwks_url = _get_jwks_url()
    if not jwks_url:
        return None
    if _jwk_client is None or _jwk_client_url != jwks_url:
        _jwk_client = PyJWKClient(
            jwks_url,
            cache_keys=True,
            cache_jwk_set=True,
            lifespan=_JWKS_CACHE_TTL_SECONDS,
            timeout=5,
        )
        _jwk_client_url = jwks_url
    return _jwk_client

def _verify_with_jwks(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT using Supabase's public keys (JWKS)."""
    try:
        # Optimization: If token is HS256, it's not using JWKS (which is for RS256/ES256)
        # Skip JWKS check to avoid "Unable to find signing key" warnings for legacy tokens
        header = jwt.get_unverified_header(token)
        if header.get("alg") == "HS256":
            logger.debug("JWKS: Skipping verification for HS256 token")
            return None

        jwk_client = _get_jwk_client()
        if not jwk_client:
            logger.debug("JWKS: No JWKS URL configured")
            return None
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "EdDSA"],
            options={"verify_exp": True}
        )
        logger.debug(f"JWKS verification succeeded for sub={payload.get('sub')}")
        return payload
    except Exception as e:
        logger.warning(f"JWKS verification failed: {e}")
        return None

def _base64url_decode(payload: str) -> bytes:
    """Decode base64url string to bytes."""
    rem = len(payload) % 4
    if rem > 0:
        payload += "=" * (4 - rem)
    # base64url uses '-' instead of '+' and '_' instead of '/'
    return base64.urlsafe_b64decode(payload)

def _verify_session_cookie(cookie_value: str) -> Optional[Dict[str, Any]]:
    """Decode and verify HMAC-signed session cookie (gray-auth-session)."""
    if not cookie_value or "." not in cookie_value:
        return None
    
    parts = cookie_value.split(".")
    if len(parts) != 2:
        return None
        
    body_b64, signature_b64 = parts
    
    # Resolve secret
    secret = (
        os.getenv("AUTH_COOKIE_SECRET") or 
        os.getenv("COOKIE_SECRET") or 
        os.getenv("NEXTAUTH_SECRET") or 
        ""
    )
    if not secret:
        if _IS_PRODUCTION:
            logger.error("Missing AUTH_COOKIE_SECRET in production; cookie auth disabled.")
            return None
        secret = "development-gray-session-secret"
        
    # Verify signature
    try:
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            body_b64.encode("utf-8"),
            hashlib.sha256
        ).digest()
        
        # Base64url decode signature
        try:
            provided_sig = _base64url_decode(signature_b64)
        except Exception:
            return None
            
        if not hmac.compare_digest(provided_sig, expected_sig):
            return None
            
        # Decode body
        body_json = _base64url_decode(body_b64).decode("utf-8")
        payload = json.loads(body_json)
        
        # Check expiration
        exp = payload.get("exp")
        if not isinstance(exp, (int, float)) or exp < time.time():
            return None
            
        return payload
    except Exception as e:
        logger.debug(f"Session cookie verification failed: {e}")
        return None


# Token cache to avoid hitting Supabase Auth on every request
_token_cache: Dict[str, tuple[Dict[str, Any], float]] = {}
_TOKEN_CACHE_TTL = 60.0  # 60 seconds

def _get_cached_token_payload(token: str) -> Optional[Dict[str, Any]]:
    if token in _token_cache:
        payload, timestamp = _token_cache[token]
        if time.time() - timestamp < _TOKEN_CACHE_TTL:
            return payload
        else:
            del _token_cache[token]
    return None

def _cache_token_payload(token: str, payload: Dict[str, Any]):
    # Prune old entries if cache gets too big
    if len(_token_cache) > 1000:
        # Remove oldest 20%
        sorted_items = sorted(_token_cache.items(), key=lambda x: x[1][1])
        for key, _ in sorted_items[:200]:
            del _token_cache[key]
    _token_cache[token] = (payload, time.time())

async def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verify Supabase JWT token and return user payload.
    
    Verification order (fastest to slowest):
    1. JWKS (public key verification) - recommended
    2. Legacy JWT secret (HS256) - if configured
    3. Supabase Auth API call - fallback
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        User payload from token
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    # Check cache first
    cached_payload = _get_cached_token_payload(token)
    if cached_payload:
        return cached_payload

    decoded_payload: Optional[Dict[str, Any]] = None

    # PRIORITY 1: Try JWKS verification (modern, recommended)
    jwks_payload = _verify_with_jwks(token)
    if jwks_payload:
        payload = {
            "sub": jwks_payload.get("sub"),
            "email": jwks_payload.get("email"),
            "user_metadata": jwks_payload.get("user_metadata") or {}
        }
        _cache_token_payload(token, payload)
        logger.debug("Token verified via JWKS")
        return payload

    decoded_payload = None

    # PRIORITY 2: Try legacy JWT secret (if configured)
    if hasattr(jwt, "decode"):
        if SUPABASE_JWT_SECRET:
            try:
                decoded_payload = jwt.decode(
                    token, 
                    SUPABASE_JWT_SECRET, 
                    algorithms=["HS256"], 
                    options={"verify_exp": True}
                )
                if decoded_payload:
                    payload = {
                        "sub": decoded_payload.get("sub"),
                        "email": decoded_payload.get("email"),
                        "user_metadata": decoded_payload.get("user_metadata") or {}
                    }
                    _cache_token_payload(token, payload)
                    logger.debug("Token verified via legacy JWT secret")
                    return payload
            except InvalidTokenError as e:
                logger.warning(f"Legacy JWT verification failed: {e}")
            except Exception as e:
                logger.debug(f"Legacy JWT verification error: {e}")
        else:
            logger.debug("Skipping legacy JWT verification: SUPABASE_JWT_SECRET not configured")

    # PRIORITY 3: Fall back to Supabase Auth API call
    try:
        supabase = create_supabase_client()
        supabase_error: Optional[str] = None

        # Verify token with Supabase
        if supabase:
            try:
                response = supabase.auth.get_user(token)
            except Exception as supabase_exc:
                supabase_error = str(supabase_exc)
                response = None
                logger.debug(f"Supabase token validation failed: {supabase_error}")
                if "Invalid API key" in supabase_error:
                    logger.error("CRITICAL: Supabase API rejected the configured SUPABASE_KEY. Please check your .env file.")
        else:
            response = None
            logger.warning("Supabase client not initialized (missing credentials?), cannot verify token via API")

        if response and response.user:
            payload = {
                "sub": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata or {}
            }
            _cache_token_payload(token, payload)
            return payload
        
        # Fallback: if we already validated the signature locally, trust the decoded payload
        if decoded_payload and SUPABASE_JWT_SECRET:
            sub = decoded_payload.get("sub")
            if not sub:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token"
                )
            logger.warning("Supabase validation failed; falling back to local JWT verification")
            payload = {
                "sub": sub,
                "email": decoded_payload.get("email"),
                "user_metadata": decoded_payload.get("user_metadata") or {}
            }
            _cache_token_payload(token, payload)
            return payload

        # Fallback #2 (opt‑in, insecure): recover payload without signature if Supabase session lookup failed.
        # This is intentionally gated behind an env flag for local development only.
        if _ALLOW_INSECURE_JWT_FALLBACK:
            decoded_fallback = decoded_payload or _decode_token_without_signature(token)
            if decoded_fallback and decoded_fallback.get("sub"):
                logger.warning(
                    "Supabase validation failed; using decoded JWT payload via insecure fallback "
                    "(ALLOW_INSECURE_JWT_FALLBACK enabled). Do NOT use this mode in production.",
                    extra={"error": supabase_error},
                )
                payload = {
                    "sub": decoded_fallback.get("sub"),
                    "email": decoded_fallback.get("email"),
                    "user_metadata": decoded_fallback.get("user_metadata") or {},
                }
                _cache_token_payload(token, payload)
                return payload

        logger.debug("Invalid token: user not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
        
    except Exception as e:
        logger.debug(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Get current authenticated user from JWT token or session cookie.
    
    Verifies the token or cookie and fetches the user from the database.
    Uses in-memory cache to reduce database queries.
    
    Args:
        request: FastAPI request object (for cookies)
        credentials: Optional Bearer token credentials
        
    Returns:
        User record from database
        
    Raises:
        HTTPException: If authentication fails or user not found
    """
    # Import here to avoid circular dependency
    from backend.database import users, database
    
    perf_start = time.time()
    
    email = None
    auth_user_id = None
    payload = None

    # Try Bearer token first
    token = credentials.credentials if credentials else None
    if token:
        payload = await verify_supabase_token(token)
        auth_user_id = payload.get("sub")
        email = _normalize_email(payload.get("email"))
    else:
        # Fallback to session cookie
        # We look for 'gray-auth-session'
        session_cookie = request.cookies.get("gray-auth-session")
        if session_cookie:
            payload = _verify_session_cookie(session_cookie)
            if payload:
                email = _normalize_email(payload.get("email"))
                # auth_user_id might not be in the session cookie, 
                # but we'll lookup by email in the DB.

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check L1 (in-memory) cache first
    cached_user = _get_cached_user(email)
    if cached_user:
        logger.debug(f"[AUTH PERF] L1 cache hit for user {email}, took {(time.time() - perf_start) * 1000:.2f}ms")
        return cached_user
    
    # Check L2 (Redis) cache
    redis_cached_user = await _get_cached_user_redis(email)
    if redis_cached_user:
        # Promote to L1 cache
        _cache_user(email, redis_cached_user)
        logger.debug(f"[AUTH PERF] L2 (Redis) cache hit for user {email}, took {(time.time() - perf_start) * 1000:.2f}ms")
        return redis_cached_user
    
    # Fetch user from database by email (single source of truth).
    user = await database.fetch_one(
        users.select().where(sqlalchemy.func.lower(users.c.email) == email)
    )

    if user and auth_user_id:
        existing_auth_user_id = _row_get(user, "auth_user_id")
        if not existing_auth_user_id or str(existing_auth_user_id) != str(auth_user_id):
            await database.execute(
                users.update()
                .where(users.c.id == user["id"])
                .values(auth_user_id=auth_user_id, updated_at=utcnow())
            )
            user = await database.fetch_one(
                users.select().where(sqlalchemy.func.lower(users.c.email) == email)
            )
            logger.info(
                "Synced auth_user_id to existing user",
                extra={"auth_user_id": auth_user_id, "user_id": user["id"] if user else None},
            )

    # Create new user if still not found
    if not user:
        full_name = _derive_full_name(email, payload.get("user_metadata") or {})
        try:
            now = utcnow()
            
            assigned_plan_tier = bootstrap_plan_tier(email)
                
            insert_values = {
                "email": email,
                "full_name": full_name,
                "role": "user",
                "plan_tier": assigned_plan_tier,
                "initials": _initials_from_name(full_name),
                "auth_user_id": auth_user_id,
                "created_at": now,
                "updated_at": now,
            }
            new_id = await database.execute(users.insert().values(insert_values))
            user = await database.fetch_one(users.select().where(users.c.id == new_id))
            logger.info(
                "Auto-provisioned user for auth_user_id",
                extra={"auth_user_id": auth_user_id, "email": email, "plan_tier": assigned_plan_tier},
            )
            try:
                from backend.affiliate_utils import attach_affiliate_referral

                await attach_affiliate_referral(database, dict(user), request)
            except Exception as exc:
                logger.warning(
                    "Failed to attach affiliate referral",
                    extra={"error": str(exc), "user_id": user["id"] if user else None},
                )
        except Exception as creation_error:
            logger.error(
                "Failed to auto-provision user for auth_user_id",
                extra={"auth_user_id": auth_user_id, "error": str(creation_error)},
            )

    if not user:
        logger.warning(f"User not found for email: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    user_dict = dict(user)

    try:
        from backend.affiliate_utils import assign_affiliate_owner_if_needed

        await assign_affiliate_owner_if_needed(database, user_dict)
    except Exception as exc:
        logger.warning("Failed to sync affiliate owner", extra={"error": str(exc), "user_id": user_dict.get("id")})
    
    # Cache the user in L1 (in-memory) and L2 (Redis)
    _cache_user(email, user_dict)
    await _cache_user_redis(email, user_dict)
    
    perf_duration = (time.time() - perf_start) * 1000
    logger.debug(f"[AUTH PERF] get_current_user took {perf_duration:.2f}ms (DB fetch)")

    return user_dict





async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[Dict[str, Any]]:
    """
    Get current user if authenticated, None otherwise.
    
    Used for endpoints that can work with or without authentication.
    
    Args:
        request: FastAPI request object (for cookies)
        credentials: Optional bearer token credentials
        
    Returns:
        User record if authenticated, None otherwise
    """
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None



def require_same_user(user_id: int, current_user: Dict[str, Any]):
    """
    Verify that the current user can only access their own data.
    
    Args:
        user_id: The user ID being accessed
        current_user: The authenticated user
        
    Raises:
        HTTPException: If user attempts to access another user's data
    """
    if str(current_user["id"]) != str(user_id):
        logger.warning(
            f"User {current_user['id']} attempted to access user {user_id}'s data"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own data"
        )


def require_admin(current_user: Dict[str, Any]):
    """
    Verify that the current user has admin privileges.
    
    Args:
        current_user: The authenticated user
        
    Raises:
        HTTPException: If user is not an admin
    """
    user_role = _row_get(current_user, "role") or "user"
    if user_role != "admin":
        logger.warning(
            f"User {current_user['id']} attempted admin action without privileges"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
