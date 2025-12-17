from types import SimpleNamespace


def _make_request(*, client_host: str | None, host_header: str | None = None, forwarded_host: str | None = None):
    headers = {}
    if host_header is not None:
        headers["host"] = host_header
    if forwarded_host is not None:
        headers["x-forwarded-host"] = forwarded_host
    client = SimpleNamespace(host=client_host) if client_host is not None else None
    return SimpleNamespace(client=client, headers=headers)


def test_is_localhost_request_accepts_loopback_client():
    from backend.api.analytics import _is_localhost_request

    req = _make_request(client_host="127.0.0.1", host_header="example.com")
    assert _is_localhost_request(req) is True


def test_is_localhost_request_rejects_localhost_host_header_spoofing():
    from backend.api.analytics import _is_localhost_request

    req = _make_request(client_host="10.0.0.5", host_header="localhost:3000")
    assert _is_localhost_request(req) is False


def test_is_localhost_request_rejects_wildcard_host_header_spoofing():
    from backend.api.analytics import _is_localhost_request

    req = _make_request(client_host="10.0.0.5", host_header="0.0.0.0:3000")
    assert _is_localhost_request(req) is False


def test_is_localhost_request_rejects_subdomain_localhost_spoofing():
    from backend.api.analytics import _is_localhost_request

    req = _make_request(client_host="10.0.0.5", host_header="gray.localhost:3000")
    assert _is_localhost_request(req) is False


def test_is_localhost_request_rejects_remote_host():
    from backend.api.analytics import _is_localhost_request

    req = _make_request(client_host="10.0.0.5", host_header="gray.alignment.id")
    assert _is_localhost_request(req) is False


def test_is_localhost_request_rejects_private_client_with_service_host():
    from backend.api.analytics import _is_localhost_request

    req = _make_request(client_host="172.18.0.10", host_header="backend:8000")
    assert _is_localhost_request(req) is False


def test_dev_analytics_prod_token_gate():
    import os
    import asyncio

    from backend.api.analytics import dev_analytics_summary

    async def run():
        req = _make_request(client_host="10.0.0.5", host_header="gray.alignment.id")

        original_env = dict(os.environ)
        try:
            os.environ["NODE_ENV"] = "production"
            os.environ["DEV_ANALYTICS_TOKEN"] = "secret"

            class StubDb:
                async def fetch_val(self, *_args, **_kwargs):
                    return 0

            # No token => 404
            try:
                await dev_analytics_summary(req, StubDb())
                assert False, "Expected HTTPException"
            except Exception as exc:
                assert getattr(exc, "status_code", None) == 404

            # With token => ok
            req_ok = _make_request(client_host="10.0.0.5", host_header="gray.alignment.id")
            req_ok.headers["x-dev-analytics-token"] = "secret"
            payload = await dev_analytics_summary(req_ok, StubDb())
            assert "counts" in payload
        finally:
            os.environ.clear()
            os.environ.update(original_env)

    asyncio.run(run())
