import pytest


@pytest.mark.asyncio
async def test_notify_payment_success_no_webhook(monkeypatch):
    import backend.discord_notifier as notifier

    monkeypatch.delenv("DISCORD_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("DISCORD_PAYMENTS_WEBHOOK_URL", raising=False)

    called = {"value": False}

    async def fake_post(url, payload):
        called["value"] = True

    monkeypatch.setattr(notifier, "_post_discord_webhook", fake_post)

    await notifier.notify_payment_success(
        provider="midtrans",
        status="settlement",
        order_id="order_123",
        amount="10000",
        currency="IDR",
        user_id=1,
        plan_tier="voyager",
        billing_cycle="monthly",
        extra={"transaction_id": "txn_1"},
    )

    assert called["value"] is False


@pytest.mark.asyncio
async def test_notify_payment_success_posts(monkeypatch):
    import backend.discord_notifier as notifier

    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.example/webhook")
    monkeypatch.delenv("DISCORD_PAYMENTS_WEBHOOK_URL", raising=False)

    captured = {}

    async def fake_post(url, payload):
        captured["url"] = url
        captured["payload"] = payload

    monkeypatch.setattr(notifier, "_post_discord_webhook", fake_post)

    await notifier.notify_payment_success(
        provider="midtrans",
        status="sale",
        order_id="sale_123",
        amount="9.99",
        currency="USD",
        user_id=42,
        plan_tier="pioneer",
        billing_cycle="annual",
        extra={"sale_id": "sale_123"},
    )

    assert captured["url"] == "https://discord.example/webhook"
    assert captured["payload"]["embeds"][0]["title"] == "Payment received (midtrans)"
    fields = {field["name"]: field["value"] for field in captured["payload"]["embeds"][0]["fields"]}
    assert fields["Order ID"] == "sale_123"
    assert fields["User ID"] == "42"
    assert fields["Amount"] == "9.99"
    assert fields["Currency"] == "USD"
    assert fields["Plan"] == "pioneer"
    assert fields["Billing"] == "annual"
    assert fields["sale_id"] == "sale_123"


@pytest.mark.asyncio
async def test_notify_alert_posts(monkeypatch):
    import backend.discord_notifier as notifier

    monkeypatch.setenv("DISCORD_ALERTS_WEBHOOK_URL", "https://discord.example/alerts")

    captured = {}

    async def fake_post(url, payload):
        captured["url"] = url
        captured["payload"] = payload

    monkeypatch.setattr(notifier, "_post_discord_webhook", fake_post)

    await notifier.notify_alert(
        title="Slow DB query",
        message="A database query exceeded threshold.",
        severity="warning",
        fields={"duration_ms": 1234, "query_preview": "SELECT 1"},
        dedupe_key="slow-db-1",
    )

    assert captured["url"] == "https://discord.example/alerts"
    assert captured["payload"]["embeds"][0]["title"] == "Slow DB query"
    assert captured["payload"]["embeds"][0]["color"] != 0


@pytest.mark.asyncio
async def test_notify_alert_dedupes(monkeypatch):
    import backend.discord_notifier as notifier

    monkeypatch.setenv("DISCORD_ALERTS_WEBHOOK_URL", "https://discord.example/alerts")
    monkeypatch.setenv("DISCORD_ALERT_COOLDOWN_SECONDS", "9999")

    calls = {"count": 0}

    async def fake_post(url, payload):
        calls["count"] += 1

    monkeypatch.setattr(notifier, "_post_discord_webhook", fake_post)

    await notifier.notify_alert(title="X", message="Y", dedupe_key="k")
    await notifier.notify_alert(title="X", message="Y", dedupe_key="k")

    assert calls["count"] == 1
