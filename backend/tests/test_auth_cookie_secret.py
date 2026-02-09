from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from backend import auth


def _clear_cookie_secret_env(monkeypatch) -> None:
    for env_name in (
        *auth._AUTH_COOKIE_SECRET_ENV_KEYS,
        *auth._AUTH_COOKIE_LOCAL_FALLBACK_ENV_KEYS,
    ):
        monkeypatch.delenv(env_name, raising=False)


def _signed_session_cookie(payload: dict[str, object], secret: str) -> str:
    body_json = json.dumps(payload, separators=(",", ":"))
    body_b64 = base64.urlsafe_b64encode(body_json.encode("utf-8")).decode("ascii").rstrip("=")
    signature = hmac.new(
        secret.encode("utf-8"),
        body_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{body_b64}.{signature_b64}"


def test_resolve_auth_cookie_secret_prefers_primary_env(monkeypatch) -> None:
    _clear_cookie_secret_env(monkeypatch)
    monkeypatch.setenv("AUTH_COOKIE_SECRET", "primary-secret")
    monkeypatch.setenv("AUTH_COOKIE_LOCAL_SECRET", "local-secret")

    assert auth._resolve_auth_cookie_secret(is_local_env=True) == "primary-secret"


def test_resolve_auth_cookie_secret_uses_local_fallback_only_in_local_env(monkeypatch) -> None:
    _clear_cookie_secret_env(monkeypatch)
    monkeypatch.setenv("AUTH_COOKIE_LOCAL_SECRET", "local-only-secret")

    assert auth._resolve_auth_cookie_secret(is_local_env=True) == "local-only-secret"
    assert auth._resolve_auth_cookie_secret(is_local_env=False) is None


def test_verify_session_cookie_accepts_local_fallback_secret(monkeypatch) -> None:
    _clear_cookie_secret_env(monkeypatch)
    monkeypatch.setenv("AUTH_COOKIE_LOCAL_SECRET", "local-dev-secret")
    monkeypatch.setattr(auth, "_IS_EXPLICIT_LOCAL_ENV", True)

    token = _signed_session_cookie(
        {"sub": "auth-user-1", "exp": time.time() + 60},
        "local-dev-secret",
    )

    payload = auth._verify_session_cookie(token)

    assert payload is not None
    assert payload["sub"] == "auth-user-1"


def test_verify_session_cookie_rejects_local_fallback_outside_local_env(monkeypatch) -> None:
    _clear_cookie_secret_env(monkeypatch)
    monkeypatch.setenv("AUTH_COOKIE_LOCAL_SECRET", "local-dev-secret")
    monkeypatch.setattr(auth, "_IS_EXPLICIT_LOCAL_ENV", False)

    token = _signed_session_cookie(
        {"sub": "auth-user-1", "exp": time.time() + 60},
        "local-dev-secret",
    )

    assert auth._verify_session_cookie(token) is None


def test_verify_session_cookie_rejects_when_no_secret_available(monkeypatch) -> None:
    _clear_cookie_secret_env(monkeypatch)
    monkeypatch.setattr(auth, "_IS_EXPLICIT_LOCAL_ENV", True)

    token = _signed_session_cookie(
        {"sub": "auth-user-1", "exp": time.time() + 60},
        "some-secret",
    )

    assert auth._verify_session_cookie(token) is None
