import importlib
import sys
import types

import pytest
from fastapi import HTTPException


def _install_google_stubs() -> None:
    """Avoid importing heavyweight google deps for redirect validation tests."""
    google = sys.modules.get("google") or types.ModuleType("google")
    oauth2 = sys.modules.get("google.oauth2") or types.ModuleType("google.oauth2")
    credentials = sys.modules.get("google.oauth2.credentials") or types.ModuleType("google.oauth2.credentials")
    oauth2.credentials = credentials
    google.oauth2 = oauth2

    sys.modules.setdefault("google", google)
    sys.modules.setdefault("google.oauth2", oauth2)
    sys.modules.setdefault("google.oauth2.credentials", credentials)

    google_auth_oauthlib = sys.modules.get("google_auth_oauthlib") or types.ModuleType("google_auth_oauthlib")
    flow = sys.modules.get("google_auth_oauthlib.flow") or types.ModuleType("google_auth_oauthlib.flow")
    google_auth_oauthlib.flow = flow
    sys.modules.setdefault("google_auth_oauthlib", google_auth_oauthlib)
    sys.modules.setdefault("google_auth_oauthlib.flow", flow)

    googleapiclient = sys.modules.get("googleapiclient") or types.ModuleType("googleapiclient")
    discovery = sys.modules.get("googleapiclient.discovery") or types.ModuleType("googleapiclient.discovery")
    errors = sys.modules.get("googleapiclient.errors") or types.ModuleType("googleapiclient.errors")

    def _stub_build(*_args, **_kwargs):
        raise RuntimeError("googleapiclient build stub invoked unexpectedly")

    class _StubHttpError(Exception):
        pass

    discovery.build = _stub_build
    errors.HttpError = _StubHttpError

    googleapiclient.discovery = discovery
    googleapiclient.errors = errors
    sys.modules.setdefault("googleapiclient", googleapiclient)
    sys.modules.setdefault("googleapiclient.discovery", discovery)
    sys.modules.setdefault("googleapiclient.errors", errors)


@pytest.fixture(autouse=True)
def _google_env(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_google_stubs()
    monkeypatch.setenv("GOOGLE_STATE_SECRET", "0123456789abcdef")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv(
        "GOOGLE_REDIRECT_URI",
        "https://gray.alignment.id/api/auth/google-calendar/callback",
    )


def _reload_module():
    import backend.google_calendar as google_calendar

    return importlib.reload(google_calendar)


def test_normalize_redirect_uri_allows_subdomains():
    google_calendar = _reload_module()
    assert (
        google_calendar._normalize_redirect_uri(
            "https://www.gray.alignment.id/api/auth/google-calendar/callback"
        )
        == "https://www.gray.alignment.id/api/auth/google-calendar/callback"
    )


def test_normalize_redirect_uri_rejects_bad_path():
    google_calendar = _reload_module()
    with pytest.raises(HTTPException) as excinfo:
        google_calendar._normalize_redirect_uri("https://www.gray.alignment.id/not-allowed")
    assert excinfo.value.status_code == 400

