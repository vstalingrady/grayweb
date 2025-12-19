"""
Google Calendar OAuth and data access routes.
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.auth import get_current_user, require_same_user
from backend.database import get_database, google_calendar_credentials, users
from backend.google_calendar import (
    GoogleCalendarCredentials,
    GoogleAuthRequest,
    GoogleAuthCallbackRequest,
    GoogleAuthResponse,
    GoogleCalendarInfo,
    GoogleCalendarEvent,
    get_google_auth_url,
    exchange_code_for_tokens,
    get_google_calendar_service,
    list_google_calendars,
    list_google_events,
    encrypt_refresh_token,
    decrypt_refresh_token,
    SCOPES,
)
from backend.time_utils import utcnow
from backend.tier_utils import normalize_plan_tier
from backend.compat_imports import row_get as _row_get

router = APIRouter(tags=["google-calendar"])


def _require_calendar_access(current_user: Dict[str, Any]) -> None:
    tier = normalize_plan_tier(
        _row_get(current_user, "plan_tier"),
        _row_get(current_user, "role"),
        _row_get(current_user, "subscription_expires_at"),
    )
    if tier not in ("voyager", "pioneer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Calendar access requires a Voyager or Pioneer plan.",
        )


def _parse_time_param(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _normalize_scopes(raw: Any) -> List[str]:
    if not raw:
        return list(SCOPES)
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return list(SCOPES)
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            pass
        return [item for item in raw.split() if item]
    return [str(raw)]


async def _load_google_credentials(
    db: databases.Database,
    user_id: int,
) -> Optional[GoogleCalendarCredentials]:
    row = await db.fetch_one(
        google_calendar_credentials.select().where(
            google_calendar_credentials.c.user_id == user_id
        )
    )
    if not row:
        return None

    record = dict(row)
    encrypted_refresh_token = _row_get(record, "refresh_token")
    refresh_token = decrypt_refresh_token(encrypted_refresh_token)
    scopes = _normalize_scopes(_row_get(record, "scopes"))

    credentials = GoogleCalendarCredentials(
        user_id=int(_row_get(record, "user_id", user_id)),
        access_token=_row_get(record, "access_token") or "",
        refresh_token=refresh_token,
        token_uri=_row_get(record, "token_uri") or "",
        client_id=_row_get(record, "client_id") or "",
        client_secret=None,
        scopes=scopes,
        expires_at=_row_get(record, "expires_at"),
        created_at=_row_get(record, "created_at") or utcnow(),
        updated_at=_row_get(record, "updated_at"),
    )

    if refresh_token and encrypted_refresh_token == refresh_token:
        await db.execute(
            google_calendar_credentials.update()
            .where(google_calendar_credentials.c.user_id == user_id)
            .values(
                refresh_token=encrypt_refresh_token(refresh_token),
                updated_at=utcnow(),
            )
        )

    return credentials


@router.post("/users/{user_id}/google-calendar/auth", response_model=GoogleAuthResponse)
async def request_google_calendar_auth(
    user_id: int,
    payload: GoogleAuthRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)

    if payload.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User mismatch")

    return get_google_auth_url(user_id, redirect_override=payload.redirect_uri)


@router.post("/google-calendar/oauth/callback")
async def finalize_google_calendar_oauth(
    payload: GoogleAuthCallbackRequest,
    db: databases.Database = Depends(get_database),
):
    credentials = await exchange_code_for_tokens(
        payload.code,
        payload.state,
        redirect_override=payload.redirect_uri,
    )

    user_id = credentials.user_id
    user_exists = await db.fetch_one(users.select().where(users.c.id == user_id))
    if not user_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing_row = await db.fetch_one(
        google_calendar_credentials.select().where(
            google_calendar_credentials.c.user_id == user_id
        )
    )
    existing = dict(existing_row) if existing_row else None

    refresh_token = credentials.refresh_token
    if not refresh_token and existing:
        refresh_token = decrypt_refresh_token(_row_get(existing, "refresh_token"))

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar did not return a refresh token. Please revoke access and try again.",
        )

    expires_at = credentials.expires_at
    if expires_at and expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)

    now = utcnow()
    scopes = credentials.scopes or list(SCOPES)
    record = {
        "user_id": user_id,
        "access_token": credentials.access_token,
        "refresh_token": encrypt_refresh_token(refresh_token),
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id or os.getenv("GOOGLE_CLIENT_ID") or "",
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET") or credentials.client_secret or "",
        "scopes": json.dumps(scopes),
        "expires_at": expires_at,
        "updated_at": now,
    }

    if existing:
        await db.execute(
            google_calendar_credentials.update()
            .where(google_calendar_credentials.c.user_id == user_id)
            .values(**record)
        )
    else:
        record["created_at"] = now
        await db.execute(google_calendar_credentials.insert().values(**record))

    return {"status": "ok"}


@router.get("/users/{user_id}/google-calendars", response_model=List[GoogleCalendarInfo])
async def get_google_calendars(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)

    credentials = await _load_google_credentials(db, user_id)
    if not credentials:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Google Calendar not connected")

    service = await get_google_calendar_service(credentials)
    return await list_google_calendars(service)


@router.get(
    "/users/{user_id}/google-calendars/{calendar_id}/events",
    response_model=List[GoogleCalendarEvent],
)
async def get_google_calendar_events(
    user_id: int,
    calendar_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    time_min: Optional[str] = Query(None),
    time_max: Optional[str] = Query(None),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)

    credentials = await _load_google_credentials(db, user_id)
    if not credentials:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Google Calendar not connected")

    service = await get_google_calendar_service(credentials)
    return await list_google_events(
        service,
        calendar_id=calendar_id,
        time_min=_parse_time_param(time_min),
        time_max=_parse_time_param(time_max),
    )
