# Paddle Integration Plan (Sandbox)

We are adding Paddle as a payment provider, initially in Sandbox mode.

## 1. Database Updates

We need to store Paddle-specific identifiers to link users and transactions to Paddle entities.

### `backend/database.py`

- Update `users` table:
  - Add `paddle_customer_id` (String, nullable, index=True)
  - Add `paddle_subscription_id` (String, nullable, index=True) - For active subscription mapping
- Update `transactions` table:
  - Add `paddle_transaction_id` (String, unique=True, nullable=True) - `txn_...` ID from Paddle

## 2. Paddle Client Service

Create `backend/paddle_client.py` to encapsulate Paddle API interactions.

- **Authentication**: Use `PADDLE_API_KEY` (and `PADDLE_SANDBOX` flag)
- **Base URL**: `https://sandbox-api.paddle.com` (configurable)
- **Key Methods**:
  - `get_subscription(subscription_id)`
  - `get_transaction(transaction_id)`
  - `cancel_subscription(subscription_id)`
  - `get_subscription_update_preview(...)` (for upgrades/downgrades)

## 3. Webhook Handling

Create `backend/api/paddle_webhook.py` (or add route to `main.py` if no router is split yet, but better to split).

- **Endpoint**: `POST /api/webhook/paddle`
- **Verification**: Verify `Paddle-Signature` header using `PADDLE_WEBHOOK_SECRET_KEY`.
- **Event Handlers**:
  - `subscription.created`: Update user `paddle_subscription_id`, `plan_tier`, `subscription_expires_at`.
  - `subscription.updated`: Update plan details, expiration.
  - `subscription.canceled`: Update active status (set expiry).
  - `transaction.completed` / `transaction.paid`: Record transaction in `transactions` table.

## 4. Environment Variables

You will need to add these to your `.env`:

```bash
PADDLE_SANDBOX=true
PADDLE_API_KEY=pdl_sdbx_...
PADDLE_WEBHOOK_SECRET_KEY=...
PADDLE_PRICE_ID_MONTHLY=pri_...
PADDLE_PRICE_ID_YEARLY=pri_...
```

## 5. Migration Strategy

Since we cannot use proper database migrations (alembic) easily without user intervention, we will use the existing pattern in `main.py` (`_ensure_sqlite_columns`) to safely add new columns on startup.
