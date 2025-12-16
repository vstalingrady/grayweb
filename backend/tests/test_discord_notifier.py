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
        provider="paddle",
        status="completed",
        order_id="txn_123",
        amount="9.99",
        currency="USD",
        user_id=42,
        plan_tier="pioneer",
        billing_cycle="annual",
        extra={"subscription_id": "sub_123"},
    )

    assert captured["url"] == "https://discord.example/webhook"
    assert captured["payload"]["embeds"][0]["title"] == "Payment received (paddle)"
    fields = {field["name"]: field["value"] for field in captured["payload"]["embeds"][0]["fields"]}
    assert fields["Order ID"] == "txn_123"
    assert fields["User ID"] == "42"
    assert fields["Amount"] == "9.99"
    assert fields["Currency"] == "USD"
    assert fields["Plan"] == "pioneer"
    assert fields["Billing"] == "annual"
    assert fields["subscription_id"] == "sub_123"
