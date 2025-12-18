# subscription.imported - Paddle Developer

**Source:** https://developer.paddle.com/webhooks/subscriptions/subscription-imported

---

- Overview
[Overview](/webhooks/overview)
- How-to
- Create a notification destination
[Create a notification destination](/webhooks/notification-destinations)
- Handle webhook delivery
[Handle webhook delivery](/webhooks/respond-to-webhooks)
- Verify signatures
[Verify signatures](/webhooks/signature-verification)
- Simulate webhooks
[Simulate webhooks](/webhooks/test-webhooks)
- Scenarios
- Subscription created
[Subscription created](/webhooks/scenarios/subscription-created)
- Subscription renewed
[Subscription renewed](/webhooks/scenarios/subscription-renewed)
- Subscription paused
[Subscription paused](/webhooks/scenarios/subscription-paused)
- Subscription resumed
[Subscription resumed](/webhooks/scenarios/subscription-resumed)
- Subscription canceled
[Subscription canceled](/webhooks/scenarios/subscription-canceled)
- Notifications
- Addresses
- Adjustments
- API keys
- API key exposures
- Businesses
- Client-side tokens
- Customers
- Discounts
- Discount groups
- Payment methods
- Payouts
- Prices
- Products
- Reports
- Subscriptionssubscription.activatedsubscription.canceledsubscription.createdsubscription.importedsubscription.past_duesubscription.pausedsubscription.resumedsubscription.trialingsubscription.updated
- subscription.activated
[subscription.activated](/webhooks/subscriptions/subscription-activated)
- subscription.canceled
[subscription.canceled](/webhooks/subscriptions/subscription-canceled)
- subscription.created
[subscription.created](/webhooks/subscriptions/subscription-created)
- subscription.imported
[subscription.imported](/webhooks/subscriptions/subscription-imported)
- subscription.past_due
[subscription.past_due](/webhooks/subscriptions/subscription-past-due)
- subscription.paused
[subscription.paused](/webhooks/subscriptions/subscription-paused)
- subscription.resumed
[subscription.resumed](/webhooks/subscriptions/subscription-resumed)
- subscription.trialing
[subscription.trialing](/webhooks/subscriptions/subscription-trialing)
- subscription.updated
[subscription.updated](/webhooks/subscriptions/subscription-updated)
- Transactions

## subscription.imported

[subscription.imported](/webhooks/subscriptions/subscription-imported#subscription.imported)

Occurs when a subscription is imported.


subscription.trialingorsubscription.activatedtypically follow.

[subscription.trialing](/webhooks/subscriptions/subscription-trialing)
[subscription.activated](/webhooks/subscriptions/subscription-activated)

Payload includes the complete subscription entity, exceptmanagement_urls. Subscription management links are temporary, so they're not included.Get a subscription using the APIto get management links for a subscription.

[Get a subscription using the API](/api-reference/subscriptions/get-subscription)

Unique Paddle ID for this event, prefixed withevt_.


Type of event sent by Paddle, in the formatentity.event_type.


RFC 3339 datetime string of when this event occurred.


New or changed entity.


Unique Paddle ID for this subscription entity, prefixed withsub_.


Status of this subscription. Set automatically by Paddle. Use the pause subscription or cancel subscription operations to change.


Paddle ID of the customer that this subscription is for, prefixed withctm_.


Paddle ID of the address that this subscription is for, prefixed withadd_.


Paddle ID of the business that this subscription is for, prefixed withbiz_.


Supported three-letter ISO 4217 currency code. Transactions for this subscription are created in this currency. Must beUSD,EUR, orGBPifcollection_modeismanual.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


RFC 3339 datetime string of when this subscription started. This may be different fromfirst_billed_atif the subscription started in trial.


RFC 3339 datetime string of when this subscription was first billed. This may be different fromstarted_atif the subscription started in trial.


RFC 3339 datetime string of when this subscription is next scheduled to be billed.


RFC 3339 datetime string of when this subscription was paused. Set automatically by Paddle when the pause subscription operation is used.nullif not paused.


RFC 3339 datetime string of when this subscription was canceled. Set automatically by Paddle when the cancel subscription operation is used.nullif not canceled.


Details of the discount applied to this subscription.


How payment is collected for transactions created for this subscription.automaticfor checkout,manualfor invoices.


Details for invoicing. Required ifcollection_modeismanual.


Current billing period for this subscription. Set automatically by Paddle based on the billing cycle.nullforpausedandcanceledsubscriptions.


How often this subscription renews. Set automatically by Paddle based on the prices on this subscription.


Change that's scheduled to be applied to a subscription. Use the pause subscription, cancel subscription, and resume subscription operations to create scheduled changes.nullif no scheduled changes.


List of items on this subscription. Only recurring items are returned.


Your own structured key-value data.


Import information for this entity.nullif this entity is not imported.


Unique Paddle ID for this notification, prefixed withntf_.


```json
12345678910111213141516171819201{
2  "event_id": "evt_01hv90ze5sg2gcazvqmqjwzcnf",
3  "event_type": "subscription.imported",
4  "occurred_at": "2024-04-12T11:27:09.497701Z",
5  "notification_id": "ntf_01hv90ze96bnqq3smhha1t9f4e",
6  "data": {
7    "id": "sub_01hv8x29kz0t586xy6zn1a62ny",
8    "items": [
9      {
10        "price": {
11          "id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
12          "name": "Monthly (per seat)",
13          "type": "standard",
14          "status": "active",
15          "quantity": {
16            "maximum": 999,
17            "minimum": 1
18          },
19          "tax_mode": "account_setting",
20          "created_at": "2023-02-23T13:55:22.538367Z",

```


---

*Last scraped: 2025-12-15 20:14:07*
