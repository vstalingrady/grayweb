"""Authentication and authorization utilities for Gray backend"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import databases
import sqlalchemy
import os
from typing import Optional, Dict, Any, Tuple
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
_LOCAL_ENV_VALUES = {"development", "dev", "local", "test"}
_IS_EXPLICIT_LOCAL_ENV = (
    _NODE_ENV in _LOCAL_ENV_VALUES or _ENVIRONMENT in _LOCAL_ENV_VALUES
)
_IS_PUBLIC_ENV = not _IS_EXPLICIT_LOCAL_ENV

_ENFORCE_SUPABASE_LIVE_VALIDATION_RAW = os.getenv("ENFORCE_SUPABASE_LIVE_VALIDATION", "").strip().lower()
if _ENFORCE_SUPABASE_LIVE_VALIDATION_RAW in ("1", "true", "yes", "on"):
    _ENFORCE_SUPABASE_LIVE_VALIDATION = True
elif _ENFORCE_SUPABASE_LIVE_VALIDATION_RAW in ("0", "false", "no", "off"):
    _ENFORCE_SUPABASE_LIVE_VALIDATION = False
else:
    # Public/non-local environments should attempt live validation to reduce stale-token risk.
    _ENFORCE_SUPABASE_LIVE_VALIDATION = _IS_PUBLIC_ENV

_ALLOW_INSECURE_JWT_FALLBACK_FLAG = (
    os.getenv("ALLOW_INSECURE_JWT_FALLBACK", "").strip().lower() in ("1", "true", "yes")
)
_ALLOW_INSECURE_JWT_FALLBACK = _ALLOW_INSECURE_JWT_FALLBACK_FLAG and _IS_EXPLICIT_LOCAL_ENV

if _ALLOW_INSECURE_JWT_FALLBACK_FLAG and not _IS_EXPLICIT_LOCAL_ENV:
    logger.error(
        "ALLOW_INSECURE_JWT_FALLBACK is enabled outside explicit local dev/test; ignoring for safety.",
        extra={"event_type": "auth_insecure_fallback_disabled"},
    )

_AUTH_COOKIE_SECRET_ENV_KEYS: tuple[str, ...] = (
    "AUTH_COOKIE_SECRET",
    "COOKIE_SECRET",
    "NEXTAUTH_SECRET",
)
_AUTH_COOKIE_LOCAL_FALLBACK_ENV_KEYS: tuple[str, ...] = (
    "AUTH_COOKIE_LOCAL_SECRET",
    "AUTH_COOKIE_DEV_SECRET",
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


def _build_auth_payload(
    sub: Optional[Any],
    email: Optional[Any],
    user_metadata: Optional[Any],
) -> Dict[str, Any]:
    return {
        "sub": str(sub) if sub is not None else None,
        "email": _normalize_email(email) if isinstance(email, str) else None,
        "user_metadata": user_metadata if isinstance(user_metadata, dict) else {},
    }


def _validate_token_with_supabase(token: str) -> Tuple[Optional[Dict[str, Any]], bool, Optional[str]]:
    """
    Validate token against Supabase Auth.

    This live check acts as a revocation/session-invalidated token check.
    Returns (payload, validation_attempted, error_message).
    """
    supabase = create_supabase_client()
    if not supabase:
        logger.warning("Supabase client not initialized (missing credentials?), cannot verify token via API")
        return None, False, "supabase_client_unavailable"

    try:
        response = supabase.auth.get_user(token)
    except Exception as supabase_exc:
        supabase_error = str(supabase_exc)
        logger.debug(f"Supabase token validation failed: {supabase_error}")
        if "Invalid API key" in supabase_error:
            logger.error("CRITICAL: Supabase API rejected the configured SUPABASE_KEY. Please check your .env file.")
        return None, False, supabase_error

    if response and response.user:
        return (
            _build_auth_payload(
                response.user.id,
                response.user.email,
                response.user.user_metadata,
            ),
            True,
            None,
        )

    # Request completed but no active user/session was found for this token.
    return None, True, None


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
_SUPABASE_URL_FOR_JWT, _, _ = resolve_supabase_credentials()
_SUPABASE_EXPECTED_ISSUER = (
    f"{_SUPABASE_URL_FOR_JWT.rstrip('/')}/auth/v1"
    if _SUPABASE_URL_FOR_JWT
    else None
)
_SUPABASE_JWT_AUDIENCE_RAW = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip()
_SUPABASE_EXPECTED_AUDIENCES = tuple(
    value.strip()
    for value in _SUPABASE_JWT_AUDIENCE_RAW.split(",")
    if value.strip()
)

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


def _jwt_decode_kwargs(algorithms: list[str]) -> Dict[str, Any]:
    """Build consistent JWT decode requirements for user access tokens."""
    options: Dict[str, Any] = {
        "verify_exp": True,
        "verify_signature": True,
        "require": ["exp", "sub"],
    }
    kwargs: Dict[str, Any] = {
        "algorithms": algorithms,
        "options": options,
    }
    if _SUPABASE_EXPECTED_ISSUER:
        options["verify_iss"] = True
        kwargs["issuer"] = _SUPABASE_EXPECTED_ISSUER
    if _SUPABASE_EXPECTED_AUDIENCES:
        options["verify_aud"] = True
        kwargs["audience"] = list(_SUPABASE_EXPECTED_AUDIENCES)
    else:
        # Allow explicit audience opt-out only when SUPABASE_JWT_AUDIENCE is unset/empty.
        options["verify_aud"] = False
    return kwargs

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
            **_jwt_decode_kwargs(["ES256", "RS256", "EdDSA"]),
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


def _resolve_auth_cookie_secret(*, is_local_env: Optional[bool] = None) -> Optional[str]:
    for env_name in _AUTH_COOKIE_SECRET_ENV_KEYS:
        value = (os.getenv(env_name) or "").strip()
        if value:
            return value

    local_env = _IS_EXPLICIT_LOCAL_ENV if is_local_env is None else is_local_env
    if not local_env:
        return None

    for env_name in _AUTH_COOKIE_LOCAL_FALLBACK_ENV_KEYS:
        value = (os.getenv(env_name) or "").strip()
        if value:
            return value
    return None

def _verify_session_cookie(cookie_value: str) -> Optional[Dict[str, Any]]:
    """Decode and verify HMAC-signed session cookie (gray-auth-session)."""
    if not cookie_value or "." not in cookie_value:
        return None
    
    parts = cookie_value.split(".")
    if len(parts) != 2:
        return None
        
    body_b64, signature_b64 = parts
    
    # Resolve secret
    secret = _resolve_auth_cookie_secret()
    if not secret:
        log = logger.warning if _IS_EXPLICIT_LOCAL_ENV else logger.error
        log(
            "Missing auth cookie secret; cookie auth disabled.",
            extra={
                "event_type": "auth_cookie_secret_missing",
                "local_env": _IS_EXPLICIT_LOCAL_ENV,
            },
        )
        return None
        
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
_TOKEN_CACHE_TTL = 5.0 if _ENFORCE_SUPABASE_LIVE_VALIDATION else 60.0

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
    3. Supabase Auth API call (live validation / revocation check)
    
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

    locally_verified_payload: Optional[Dict[str, Any]] = None
    local_verification_source: Optional[str] = None

    # PRIORITY 1: Try JWKS verification (modern, recommended)
    jwks_payload = _verify_with_jwks(token)
    if jwks_payload:
        locally_verified_payload = _build_auth_payload(
            jwks_payload.get("sub"),
            jwks_payload.get("email"),
            jwks_payload.get("user_metadata"),
        )
        local_verification_source = "jwks"

    # PRIORITY 2: Try legacy JWT secret (if configured)
    if not locally_verified_payload and hasattr(jwt, "decode"):
        if SUPABASE_JWT_SECRET:
            try:
                decoded_payload = jwt.decode(
                    token, 
                    SUPABASE_JWT_SECRET, 
                    **_jwt_decode_kwargs(["HS256"]),
                )
                if decoded_payload:
                    locally_verified_payload = _build_auth_payload(
                        decoded_payload.get("sub"),
                        decoded_payload.get("email"),
                        decoded_payload.get("user_metadata"),
                    )
                    local_verification_source = "legacy_jwt_secret"
            except InvalidTokenError as e:
                logger.warning(f"Legacy JWT verification failed: {e}")
            except Exception as e:
                logger.debug(f"Legacy JWT verification error: {e}")
        else:
            logger.debug("Skipping legacy JWT verification: SUPABASE_JWT_SECRET not configured")

    # PRIORITY 3: Supabase Auth API call (live validation / revocation check)
    try:
        supabase_payload, supabase_validation_attempted, supabase_error = _validate_token_with_supabase(token)

        if supabase_payload:
            if locally_verified_payload:
                local_sub = locally_verified_payload.get("sub")
                live_sub = supabase_payload.get("sub")
                if local_sub and live_sub and str(local_sub) != str(live_sub):
                    logger.warning(
                        "Rejected token: local signature sub mismatch with Supabase live validation",
                        extra={
                            "event_type": "auth_token_sub_mismatch",
                            "local_sub": local_sub,
                            "live_sub": live_sub,
                            "local_source": local_verification_source,
                        },
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid authentication token",
                    )
            _cache_token_payload(token, supabase_payload)
            return supabase_payload

        if locally_verified_payload:
            local_sub = locally_verified_payload.get("sub")
            if not local_sub:
                logger.warning(
                    "Rejected locally verified token missing sub claim",
                    extra={
                        "event_type": "auth_token_missing_sub",
                        "local_source": local_verification_source,
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token",
                )

            if _ENFORCE_SUPABASE_LIVE_VALIDATION and supabase_validation_attempted:
                logger.warning(
                    "Rejected locally verified token because live Supabase validation returned no active user",
                    extra={
                        "event_type": "auth_token_live_validation_rejected",
                        "sub": local_sub,
                        "local_source": local_verification_source,
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token",
                )

            if _ENFORCE_SUPABASE_LIVE_VALIDATION and not supabase_validation_attempted and _IS_PUBLIC_ENV:
                logger.warning(
                    "Live Supabase validation unavailable; accepting locally verified token",
                    extra={
                        "event_type": "auth_live_validation_unavailable",
                        "sub": local_sub,
                        "local_source": local_verification_source,
                        "supabase_error": supabase_error,
                    },
                )

            _cache_token_payload(token, locally_verified_payload)
            logger.debug("Token verified via %s", local_verification_source)
            return locally_verified_payload

        # Fallback #2 (opt‑in, insecure): recover payload without signature if Supabase session lookup failed.
        # This is intentionally gated behind an env flag for local development only.
        if _ALLOW_INSECURE_JWT_FALLBACK:
            decoded_fallback = _decode_token_without_signature(token)
            if decoded_fallback and decoded_fallback.get("sub"):
                logger.warning(
                    "Supabase validation failed; using decoded JWT payload via insecure fallback "
                    "(ALLOW_INSECURE_JWT_FALLBACK enabled for explicit local development only).",
                    extra={"event_type": "auth_insecure_fallback_used", "error": supabase_error},
                )
                payload = _build_auth_payload(
                    decoded_fallback.get("sub"),
                    decoded_fallback.get("email"),
                    decoded_fallback.get("user_metadata"),
                )
                _cache_token_payload(token, payload)
                return payload

        logger.warning(
            "Rejected token: no cryptographic verification path succeeded",
            extra={"event_type": "auth_token_rejected_no_valid_path"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    except HTTPException:
        raise
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
        auth_user_id = str(payload.get("sub")) if payload.get("sub") is not None else None
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

    if not email and not auth_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check L1 (in-memory) cache first when we have an email key.
    if email:
        cached_user = _get_cached_user(email)
        if cached_user:
            cached_auth_user_id = _row_get(cached_user, "auth_user_id")
            if auth_user_id and cached_auth_user_id and str(cached_auth_user_id) != str(auth_user_id):
                logger.warning(
                    "Rejected cached auth identity mismatch",
                    extra={
                        "event_type": "auth_identity_mismatch_cached",
                        "email": email,
                        "token_sub": auth_user_id,
                        "cached_auth_user_id": str(cached_auth_user_id),
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token",
                )

            # If auth_user_id is present but cache has no binding yet, force DB lookup to bind safely.
            if not auth_user_id or cached_auth_user_id:
                logger.debug(
                    f"[AUTH PERF] L1 cache hit for user {email}, took {(time.time() - perf_start) * 1000:.2f}ms"
                )
                return cached_user
    
    # Check L2 (Redis) cache
    if email:
        redis_cached_user = await _get_cached_user_redis(email)
        if redis_cached_user:
            redis_auth_user_id = _row_get(redis_cached_user, "auth_user_id")
            if auth_user_id and redis_auth_user_id and str(redis_auth_user_id) != str(auth_user_id):
                logger.warning(
                    "Rejected Redis-cached auth identity mismatch",
                    extra={
                        "event_type": "auth_identity_mismatch_redis_cache",
                        "email": email,
                        "token_sub": auth_user_id,
                        "cached_auth_user_id": str(redis_auth_user_id),
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token",
                )

            # If auth_user_id is present but cache has no binding yet, force DB lookup to bind safely.
            if not auth_user_id or redis_auth_user_id:
                _cache_user(email, redis_cached_user)
                logger.debug(
                    f"[AUTH PERF] L2 (Redis) cache hit for user {email}, took {(time.time() - perf_start) * 1000:.2f}ms"
                )
                return redis_cached_user
    
    # Fetch user from database with stable identity preference:
    # 1) auth_user_id/sub
    # 2) email
    user = None
    user_by_auth_user_id = None
    user_by_email = None

    if auth_user_id:
        user_by_auth_user_id = await database.fetch_one(
            users.select().where(users.c.auth_user_id == auth_user_id)
        )

    if email:
        user_by_email = await database.fetch_one(
            users.select().where(sqlalchemy.func.lower(users.c.email) == email)
        )

    if auth_user_id and user_by_email:
        existing_auth_user_id = _row_get(user_by_email, "auth_user_id")
        if existing_auth_user_id and str(existing_auth_user_id) != str(auth_user_id):
            logger.warning(
                "Rejected auth identity rebind attempt: email already bound to different sub",
                extra={
                    "event_type": "auth_identity_rebind_rejected",
                    "email": email,
                    "token_sub": auth_user_id,
                    "existing_auth_user_id": str(existing_auth_user_id),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

    if auth_user_id and user_by_auth_user_id and user_by_email and str(user_by_auth_user_id["id"]) != str(user_by_email["id"]):
        logger.warning(
            "Rejected auth identity mismatch: sub and email map to different users",
            extra={
                "event_type": "auth_identity_cross_account_mismatch",
                "token_sub": auth_user_id,
                "email": email,
                "sub_user_id": user_by_auth_user_id["id"],
                "email_user_id": user_by_email["id"],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    if user_by_auth_user_id:
        user = user_by_auth_user_id
    elif user_by_email:
        user = user_by_email
        existing_auth_user_id = _row_get(user, "auth_user_id")
        if auth_user_id and not existing_auth_user_id:
            await database.execute(
                users.update()
                .where(users.c.id == user["id"])
                .values(auth_user_id=auth_user_id, updated_at=utcnow())
            )
            user = await database.fetch_one(users.select().where(users.c.id == user["id"]))
            logger.info(
                "Bound auth_user_id to previously unbound user",
                extra={"auth_user_id": auth_user_id, "user_id": user["id"] if user else None},
            )

    # Create new user if still not found
    if not user:
        if not email:
            logger.warning(
                "User not found for sub without email claim",
                extra={"event_type": "auth_user_not_found_without_email", "token_sub": auth_user_id},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

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
        except Exception as creation_error:
            logger.error(
                "Failed to auto-provision user for auth_user_id",
                extra={"auth_user_id": auth_user_id, "error": str(creation_error)},
            )

    if not user:
        logger.warning(
            "User not found after auth identity resolution",
            extra={"event_type": "auth_user_not_found", "email": email, "token_sub": auth_user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    user_dict = dict(user)
    cache_email = _normalize_email(_row_get(user_dict, "email")) or email

    # Cache the user in L1 (in-memory) and L2 (Redis)
    if cache_email:
        _cache_user(cache_email, user_dict)
        await _cache_user_redis(cache_email, user_dict)
    
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
