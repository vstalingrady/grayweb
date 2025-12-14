"""Authentication and authorization utilities for Gray backend"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import databases
import os
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timezone

try:
    from backend.time_utils import utcnow
except Exception:  # pragma: no cover
    from time_utils import utcnow  # type: ignore
import time

try:
    import jwt  # type: ignore
    from jwt import InvalidTokenError  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    jwt = None
    InvalidTokenError = Exception

logger = logging.getLogger(__name__)

security = HTTPBearer()

# Simple in-memory cache for user lookups with TTL
_user_cache: Dict[str, tuple[Dict[str, Any], float]] = {}
_USER_CACHE_TTL = 10.0  # 10 seconds

# Redis cache (L2 - longer TTL, shared across processes)
try:
    from redis_client import get_redis_client
    _redis_client = get_redis_client()
except ImportError:
    _redis_client = None

# Optional, explicitly gated insecure fallback for local development.
# When enabled, the backend may accept JWTs that were NOT validated
# against Supabase or a shared secret, based only on their payload.
_ALLOW_INSECURE_JWT_FALLBACK = (
    os.getenv("ALLOW_INSECURE_JWT_FALLBACK", "").strip().lower() in ("1", "true", "yes")
)

def _get_cached_user(auth_user_id: str) -> Optional[Dict[str, Any]]:
    """Get user from L1 (in-memory) cache if valid"""
    if auth_user_id in _user_cache:
        user_data, timestamp = _user_cache[auth_user_id]
        if time.time() - timestamp < _USER_CACHE_TTL:
            return user_data
        else:
            # Expired, remove from cache
            del _user_cache[auth_user_id]
    return None


async def _get_cached_user_redis(auth_user_id: str) -> Optional[Dict[str, Any]]:
    """Get user from Redis (L2 cache) - 5 minute TTL"""
    if not _redis_client or not _redis_client.available:
        return None
    try:
        import asyncio
        # Connect if not already connected
        if not _redis_client._client:
            await _redis_client.connect()
        data = await _redis_client.get_session(f"user:{auth_user_id}")
        if data:
            logger.debug(f"[REDIS] Cache hit for user {auth_user_id}")
            return data
    except Exception as e:
        logger.debug(f"[REDIS] Cache miss or error for user {auth_user_id}: {e}")
    return None


def _cache_user(auth_user_id: str, user_data: Dict[str, Any]):
    """Cache user data in L1 (in-memory)"""
    # Keep cache size reasonable (max 1000 entries)
    if len(_user_cache) > 1000:
        # Remove oldest 20% of entries
        sorted_items = sorted(_user_cache.items(), key=lambda x: x[1][1])
        for key, _ in sorted_items[:200]:
            del _user_cache[key]
    
    _user_cache[auth_user_id] = (user_data, time.time())


async def _cache_user_redis(auth_user_id: str, user_data: Dict[str, Any]):
    """Cache user data in Redis (L2) with 5 minute TTL"""
    if not _redis_client or not _redis_client.available:
        return
    try:
        if not _redis_client._client:
            await _redis_client.connect()
        await _redis_client.set_session(f"user:{auth_user_id}", user_data, ttl=300)
        logger.debug(f"[REDIS] Cached user {auth_user_id}")
    except Exception as e:
        logger.debug(f"[REDIS] Failed to cache user {auth_user_id}: {e}")


def invalidate_user_cache(auth_user_id: str):
    """Manually invalidate user cache (e.g. after profile updates)"""
    if auth_user_id in _user_cache:
        del _user_cache[auth_user_id]


async def invalidate_user_cache_redis(auth_user_id: str):
    """Invalidate user cache in Redis"""
    if not _redis_client or not _redis_client.available:
        return
    try:
        if not _redis_client._client:
            await _redis_client.connect()
        await _redis_client.delete_session(f"user:{auth_user_id}")
        logger.debug(f"[REDIS] Invalidated cache for user {auth_user_id}")
    except Exception:
        pass


def _decode_token_without_signature(token: str) -> Optional[Dict[str, Any]]:
    """Best-effort decode to recover payload when Supabase session lookup fails."""
    if not jwt:
        return None
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
    except Exception:
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
try:
    from backend.supabase_utils import create_supabase_client
except ImportError:
    from supabase_utils import create_supabase_client


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

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Legacy, optional

# JWKS cache (public keys from Supabase)
_jwks_cache: Optional[Dict[str, Any]] = None
_jwks_cache_time: float = 0
_JWKS_CACHE_TTL = 600.0  # 10 minutes - aligns with Supabase usage

def _get_jwks_url() -> Optional[str]:
    """Get the JWKS URL for the Supabase project."""
    if not SUPABASE_URL:
        return None
    # https://project-id.supabase.co/auth/v1/.well-known/jwks.json
    base = SUPABASE_URL.rstrip("/")
    return f"{base}/auth/v1/.well-known/jwks.json"

def _fetch_jwks() -> Optional[Dict[str, Any]]:
    """Fetch JWKS from Supabase (cached for 1 hour)."""
    global _jwks_cache, _jwks_cache_time
    
    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < _JWKS_CACHE_TTL:
        return _jwks_cache
    
    jwks_url = _get_jwks_url()
    if not jwks_url:
        return None
    
    try:
        import urllib.request
        with urllib.request.urlopen(jwks_url, timeout=5) as response:
            import json
            _jwks_cache = json.loads(response.read().decode())
            _jwks_cache_time = now
            return _jwks_cache
    except Exception as e:
        logger.debug(f"Failed to fetch JWKS: {e}")
        return _jwks_cache  # Return stale cache if available

def _verify_with_jwks(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT using Supabase's public keys (JWKS)."""
    if not jwt:
        logger.debug("JWKS: jwt library not available")
        return None
    
    jwks = _fetch_jwks()
    if not jwks or "keys" not in jwks or not jwks["keys"]:
        logger.debug("JWKS: No keys available")
        return None
    
    try:
        # Optimization: If token is HS256, it's not using JWKS (which is for RS256/ES256)
        # Skip JWKS check to avoid "Unable to find signing key" warnings for legacy tokens
        header = jwt.get_unverified_header(token)
        if header.get("alg") == "HS256":
            logger.debug("JWKS: Skipping verification for HS256 token")
            return None

        # PyJWKClient can be used for asymmetric keys
        from jwt import PyJWKClient
        
        jwks_url = _get_jwks_url()
        if not jwks_url:
            logger.debug("JWKS: No JWKS URL configured")
            return None
        
        # PyJWKClient caches keys internally
        jwk_client = PyJWKClient(jwks_url)
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
            except Exception:
                pass
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
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Get current authenticated user from JWT token.
    
    Verifies the token and fetches the user from the database.
    Uses in-memory cache to reduce database queries.
    
    Args:
        credentials: Bearer token credentials
        
    Returns:
        User record from database
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    # Import here to avoid circular dependency
    try:
        from backend.database import users, database
    except ImportError:
        from database import users, database
    
    perf_start = time.time()
    token = credentials.credentials
    payload = await verify_supabase_token(token)
    
    auth_user_id = payload.get("sub")
    if not auth_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    # Check L1 (in-memory) cache first
    cached_user = _get_cached_user(auth_user_id)
    if cached_user:
        logger.debug(f"[AUTH PERF] L1 cache hit for user {auth_user_id}, took {(time.time() - perf_start) * 1000:.2f}ms")
        return cached_user
    
    # Check L2 (Redis) cache
    redis_cached_user = await _get_cached_user_redis(auth_user_id)
    if redis_cached_user:
        # Promote to L1 cache
        _cache_user(auth_user_id, redis_cached_user)
        logger.debug(f"[AUTH PERF] L2 (Redis) cache hit for user {auth_user_id}, took {(time.time() - perf_start) * 1000:.2f}ms")
        return redis_cached_user
    
    # Fetch user from database by auth_user_id
    user = await database.fetch_one(users.select().where(users.c.auth_user_id == auth_user_id))
    email = payload.get("email")

    # If no user row is linked, try to attach by email or create a new one.
    if not user and email:
        # Optimize: Try to find and link user by email in one go
        linked_user = await database.fetch_one(users.select().where(users.c.email == email))
        if linked_user:
            # Link the auth_user_id to existing user
            await database.execute(
                users.update()
                .where(users.c.id == linked_user["id"])
                .values(auth_user_id=auth_user_id, updated_at=utcnow())
            )
            user = await database.fetch_one(users.select().where(users.c.id == linked_user["id"]))
            logger.info(f"Linked auth_user_id {auth_user_id} to existing user {linked_user['id']}")

    # Create new user if still not found
    if not user:
        full_name = _derive_full_name(email, payload.get("user_metadata") or {})
        try:
            now = utcnow()
            
            # Enforce plan tier logic
            assigned_plan_tier = "scout"
            if email and email.lower().strip() == "vstalingrady@gmail.com":
                assigned_plan_tier = "pioneer"
                
            insert_values = {
                "email": email or f"missing-email-{auth_user_id}@example.com",
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
        except Exception as creation_error:
            logger.error(
                "Failed to auto-provision user for auth_user_id",
                extra={"auth_user_id": auth_user_id, "error": str(creation_error)},
            )

    if not user:
        logger.warning(f"User not found for auth_user_id: {auth_user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    user_dict = dict(user)
    
    # Cache the user in L1 (in-memory) and L2 (Redis)
    _cache_user(auth_user_id, user_dict)
    await _cache_user_redis(auth_user_id, user_dict)
    
    perf_duration = (time.time() - perf_start) * 1000
    logger.debug(f"[AUTH PERF] get_current_user took {perf_duration:.2f}ms (DB fetch)")

    return user_dict





async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[Dict[str, Any]]:
    """
    Get current user if authenticated, None otherwise.
    
    Used for endpoints that can work with or without authentication.
    
    Args:
        credentials: Optional bearer token credentials
        
    Returns:
        User record if authenticated, None otherwise
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
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
    user_role = current_user.get("role", "user")
    if user_role != "admin":
        logger.warning(
            f"User {current_user['id']} attempted admin action without privileges"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
