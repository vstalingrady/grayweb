"""Authentication and authorization utilities for Gray backend"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import databases
import os
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timezone
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

def _get_cached_user(auth_user_id: str) -> Optional[Dict[str, Any]]:
    """Get user from cache if valid"""
    if auth_user_id in _user_cache:
        user_data, timestamp = _user_cache[auth_user_id]
        if time.time() - timestamp < _USER_CACHE_TTL:
            return user_data
        else:
            # Expired, remove from cache
            del _user_cache[auth_user_id]
    return None

def _cache_user(auth_user_id: str, user_data: Dict[str, Any]):
    """Cache user data with current timestamp"""
    # Keep cache size reasonable (max 1000 entries)
    if len(_user_cache) > 1000:
        # Remove oldest 20% of entries
        sorted_items = sorted(_user_cache.items(), key=lambda x: x[1][1])
        for key, _ in sorted_items[:200]:
            del _user_cache[key]
    
    _user_cache[auth_user_id] = (user_data, time.time())


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


SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

async def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verify Supabase JWT token and return user payload.
    
    Uses Supabase client to verify the token with Supabase Auth.
    If SUPABASE_JWT_SECRET is set, performs local signature verification first.
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        User payload from token
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    decoded_payload: Optional[Dict[str, Any]] = None

    # Fast path: validate exp to fail closed before hitting Supabase
    if jwt:
        try:
            options = {"verify_exp": True}
            # If we have the secret, verify the signature locally
            if SUPABASE_JWT_SECRET:
                options["verify_signature"] = True
                decoded_payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options=options)
                
                # OPTIMIZATION: If we verified the signature locally, we can trust the token
                # and skip the expensive network call to Supabase Auth.
                if decoded_payload:
                    return {
                        "sub": decoded_payload.get("sub"),
                        "email": decoded_payload.get("email"),
                        "user_metadata": decoded_payload.get("user_metadata") or {}
                    }
            else:
                # Without secret, we can only check expiration (signature check disabled)
                # We rely on the subsequent supabase.auth.get_user call for full verification
                options["verify_signature"] = False
                decoded_payload = jwt.decode(token, options=options)

            exp = decoded_payload.get("exp") if decoded_payload else None
            if exp is not None:
                expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
                if expires_at <= datetime.now(timezone.utc):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token expired",
                    )
        except InvalidTokenError as e:
            logger.warning(f"Local JWT verification failed: {e}. Falling back to Supabase Auth.")
            # Fall through to Supabase validation
            pass
        except HTTPException:
            raise
        except Exception:
            # If decoding fails unexpectedly, fall through to Supabase validation
            pass

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
                logger.warning(
                    "Supabase token validation failed; attempting local decode fallback",
                    extra={"error": supabase_error},
                )
        else:
            response = None

        if response and response.user:
            return {
                "sub": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata or {}
            }
        
        # Fallback: if we already validated the signature locally, trust the decoded payload
        if decoded_payload and SUPABASE_JWT_SECRET:
            sub = decoded_payload.get("sub")
            if not sub:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token"
                )
            logger.warning("Supabase validation failed; falling back to local JWT verification")
            return {
                "sub": sub,
                "email": decoded_payload.get("email"),
                "user_metadata": decoded_payload.get("user_metadata") or {}
            }

        # Fallback #2: recover payload without signature if Supabase session lookup failed
        # DISABLED: This is insecure as it allows any JWT with a sub to pass if Supabase fails.
        # decoded_fallback = decoded_payload or _decode_token_without_signature(token)
        # if decoded_fallback and decoded_fallback.get("sub"):
        #     logger.warning(
        #         "Supabase validation failed; using decoded JWT payload (session missing)",
        #         extra={"error": supabase_error},
        #     )
        #     return {
        #         "sub": decoded_fallback.get("sub"),
        #         "email": decoded_fallback.get("email"),
        #         "user_metadata": decoded_fallback.get("user_metadata") or {},
        #     }

        logger.warning("Invalid token: user not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
        
    except Exception as e:
        token_preview = token[:10] + "..." if token and len(token) > 10 else token
        logger.error(f"Token verification failed: {str(e)}. Token preview: '{token_preview}'")
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
    
    # Check cache first
    cached_user = _get_cached_user(auth_user_id)
    if cached_user:
        logger.debug(f"[AUTH PERF] Cache hit for user {auth_user_id}, took {(time.time() - perf_start) * 1000:.2f}ms")
        return cached_user
    
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
                .values(auth_user_id=auth_user_id, updated_at=datetime.utcnow())
            )
            user = await database.fetch_one(users.select().where(users.c.id == linked_user["id"]))
            logger.info(f"Linked auth_user_id {auth_user_id} to existing user {linked_user['id']}")

    # Create new user if still not found
    if not user:
        full_name = _derive_full_name(email, payload.get("user_metadata") or {})
        try:
            now = datetime.utcnow()
            insert_values = {
                "email": email or f"missing-email-{auth_user_id}@example.com",
                "full_name": full_name,
                "role": "user",
                "initials": _initials_from_name(full_name),
                "auth_user_id": auth_user_id,
                "created_at": now,
                "updated_at": now,
            }
            new_id = await database.execute(users.insert().values(insert_values))
            user = await database.fetch_one(users.select().where(users.c.id == new_id))
            logger.info(
                "Auto-provisioned user for auth_user_id",
                extra={"auth_user_id": auth_user_id, "email": email},
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
    
    # Cache the user for future requests
    _cache_user(auth_user_id, user_dict)
    
    perf_duration = (time.time() - perf_start) * 1000
    logger.debug(f"[AUTH PERF] get_current_user took {perf_duration:.2f}ms")

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
    if current_user["id"] != user_id:
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
