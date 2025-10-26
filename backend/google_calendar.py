"""Google Calendar integration helpers."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlencode, urlparse

from fastapi import HTTPException, status
import google.oauth2.credentials
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from pydantic import BaseModel

# Environment variables for Google Calendar
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "https://gray.alignment.id/api/auth/google/callback",
)
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/calendar.events"]
STATE_TOKEN_TTL_SECONDS = int(os.getenv("GOOGLE_STATE_TTL_SECONDS", "900"))
STATE_SIGNING_SECRET = (
    os.getenv("GOOGLE_STATE_SECRET")
    or GOOGLE_CLIENT_SECRET
    or os.getenv("GRAY_APP_SECRET")
    or "gray-google-state"
)

class GoogleCalendarCredentials(BaseModel):
    """Google Calendar credentials stored in database."""
    user_id: int
    access_token: str
    refresh_token: str
    token_uri: str
    client_id: str
    client_secret: str
    scopes: List[str]
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GoogleCalendarInfo(BaseModel):
    """Information about a Google Calendar."""
    id: str
    email: str
    summary: str
    description: Optional[str] = None
    timezone: Optional[str] = None
    primary: bool = False

class GoogleCalendarEvent(BaseModel):
    """Google Calendar event model."""
    id: str
    summary: str
    description: Optional[str] = None
    start: dict  # DateTime with timezone
    end: dict    # DateTime with timezone
    location: Optional[str] = None
    visibility: Optional[str] = None  # "public", "private", "confidential"
    transparency: Optional[str] = None  # "opaque", "transparent"
    color_id: Optional[str] = None
    reminders: Optional[dict] = None

class GoogleAuthRequest(BaseModel):
    """Request model for Google Calendar authorization."""
    user_id: int
    redirect_uri: Optional[str] = None


class GoogleAuthCallbackRequest(BaseModel):
    """Payload received from the OAuth callback handler."""
    code: str
    state: str
    redirect_uri: Optional[str] = None

class GoogleAuthResponse(BaseModel):
    """Response model for Google Calendar authorization."""
    authorization_url: str
    state: str

def _normalize_redirect_uri(candidate: Optional[str]) -> str:
    value = (candidate or "").strip()
    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar redirect URI must be an absolute HTTP(S) URL",
        )
    return value


def _encode_state(payload: dict) -> str:
    data = json.dumps(payload, separators=(",", ":"))
    signature = hmac.new(STATE_SIGNING_SECRET.encode(), data.encode(), hashlib.sha256).digest()
    token = base64.urlsafe_b64encode(data.encode()).decode().rstrip("=")
    sig = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{token}.{sig}"


def _decode_state(token: str) -> dict:
    try:
        data_b64, sig_b64 = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state format") from exc

    padding = "=" * (-len(data_b64) % 4)
    data_bytes = base64.urlsafe_b64decode(data_b64 + padding)
    payload = data_bytes.decode()

    padding_sig = "=" * (-len(sig_b64) % 4)
    expected_sig = hmac.new(STATE_SIGNING_SECRET.encode(), payload.encode(), hashlib.sha256).digest()
    provided_sig = base64.urlsafe_b64decode(sig_b64 + padding_sig)

    if not hmac.compare_digest(expected_sig, provided_sig):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state signature")

    data = json.loads(payload)
    expires_at = data.get("exp")
    if expires_at and expires_at < int(time.time()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state has expired")
    return data


def get_google_auth_url(user_id: int, redirect_override: Optional[str] = None) -> GoogleAuthResponse:
    """Generate Google Calendar authorization URL."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Calendar credentials not configured"
        )

    redirect_uri = _normalize_redirect_uri(redirect_override or GOOGLE_REDIRECT_URI)
    if not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Calendar redirect URI is not configured",
        )

    # Generate state parameter for security
    state_payload = {
        "user_id": user_id,
        "nonce": secrets.token_urlsafe(16),
        "redirect_uri": redirect_uri,
        "exp": int(time.time()) + STATE_TOKEN_TTL_SECONDS,
    }
    state = _encode_state(state_payload)

    # Build OAuth URL manually to avoid OAuth library issues
    base_auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": " ".join(SCOPES),
        "response_type": "code",
        "access_type": "offline",
        "state": state,
        "prompt": "consent"
    }

    # Build URL with query parameters
    query_string = urlencode(params)
    authorization_url = f"{base_auth_url}?{query_string}"

    return GoogleAuthResponse(
        authorization_url=authorization_url,
        state=state
    )

async def exchange_code_for_tokens(code: str, state: str, redirect_override: Optional[str] = None) -> GoogleCalendarCredentials:
    """Exchange authorization code for access tokens."""
    try:
        state_data = _decode_state(state)
        user_id = state_data.get("user_id")
        if not isinstance(user_id, int):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state payload")

        redirect_uri = _normalize_redirect_uri(redirect_override or state_data.get("redirect_uri") or GOOGLE_REDIRECT_URI)

        client_config = {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uris": [redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }

        flow = google_auth_oauthlib.flow.Flow.from_client_config(client_config=client_config, scopes=SCOPES)
        flow.redirect_uri = redirect_uri

        # Exchange code for tokens
        flow.fetch_token(code=code)

        credentials = flow.credentials
        expires_at = credentials.expiry or (datetime.utcnow() + timedelta(hours=1))

        return GoogleCalendarCredentials(
            user_id=user_id,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_uri=credentials.token_uri,
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=list(credentials.scopes or SCOPES),
            expires_at=expires_at,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange authorization code: {str(e)}"
        )

async def get_google_calendar_service(credentials: GoogleCalendarCredentials) -> any:
    """Get Google Calendar service instance."""
    try:
        scopes = credentials.scopes
        if isinstance(scopes, str):
            try:
                parsed = json.loads(scopes)
                if isinstance(parsed, list):
                    scopes = parsed
            except json.JSONDecodeError:
                scopes = [scope.strip() for scope in scopes.split() if scope.strip()]

        # Create credentials object
        creds = google.oauth2.credentials.Credentials(
            token=credentials.access_token,
            refresh_token=credentials.refresh_token,
            token_uri=credentials.token_uri,
            client_id=credentials.client_id,
            client_secret=credentials.client_secret,
            scopes=scopes or SCOPES,
        )

        # Build calendar service
        service = build('calendar', 'v3', credentials=creds)
        return service
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Google Calendar service: {str(e)}"
        )

async def list_google_calendars(service: any) -> List[GoogleCalendarInfo]:
    """List user's Google Calendars."""
    try:
        calendar_list = service.calendarList().list()
        calendars = []

        for calendar in calendar_list.get('items', []):
            calendars.append(GoogleCalendarInfo(
                id=calendar.get('id', ''),
                email=calendar.get('id', ''),
                summary=calendar.get('summary', ''),
                description=calendar.get('description', ''),
                timezone=calendar.get('timeZone', ''),
                primary=calendar.get('primary', False)
            ))

        return calendars
    except HttpError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list calendars: {str(e)}"
        )

async def list_google_events(service: any, calendar_id: str = 'primary', time_min: Optional[datetime] = None, time_max: Optional[datetime] = None) -> List[GoogleCalendarEvent]:
    """List events from a Google Calendar."""
    try:
        # Build event list request
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min.isoformat() if time_min else None,
            timeMax=time_max.isoformat() if time_max else None,
            singleEvents=True,
            orderBy='startTime'
        )

        events = []
        for event in events_result.get('items', []):
            events.append(GoogleCalendarEvent(
                id=event.get('id', ''),
                summary=event.get('summary', ''),
                description=event.get('description', ''),
                start=event.get('start', {}),
                end=event.get('end', {}),
                location=event.get('location', ''),
                visibility=event.get('visibility', ''),
                transparency=event.get('transparency', ''),
                color_id=event.get('colorId', ''),
                reminders=event.get('reminders', {})
            ))

        return events
    except HttpError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list events: {str(e)}"
        )

async def create_google_event(service: any, calendar_id: str, event_data: dict) -> GoogleCalendarEvent:
    """Create a new event in Google Calendar."""
    try:
        event = service.events().insert(
            calendarId=calendar_id,
            body=event_data
        ).execute()

        return GoogleCalendarEvent(
            id=event.get('id', ''),
            summary=event.get('summary', ''),
            description=event.get('description', ''),
            start=event.get('start', {}),
            end=event.get('end', {}),
            location=event.get('location', ''),
            visibility=event.get('visibility', ''),
            transparency=event.get('transparency', ''),
            color_id=event.get('colorId', ''),
            reminders=event.get('reminders', {})
        )
    except HttpError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create event: {str(e)}"
        )
