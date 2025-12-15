# customer.created - Paddle Developer

**Source:** https://developer.paddle.com/webhooks/customers/customer-created

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
- Customerscustomer.createdcustomer.importedcustomer.updated
- customer.created
[customer.created](/webhooks/customers/customer-created)
- customer.imported
[customer.imported](/webhooks/customers/customer-imported)
- customer.updated
[customer.updated](/webhooks/customers/customer-updated)
- Discounts
- Discount groups
- Payment methods
- Payouts
- Prices
- Products
- Reports
- Subscriptions
- Transactions

## customer.created

[customer.created](/webhooks/customers/customer-created#customer.created)

Occurs when a customer is created.


Unique Paddle ID for this event, prefixed withevt_.


Type of event sent by Paddle, in the formatentity.event_type.


RFC 3339 datetime string of when this event occurred.


New or changed entity.


Unique Paddle ID for this customer entity, prefixed withctm_.


Full name of this customer. Required when creating transactions wherecollection_modeismanual(invoices).


Email address for this customer.


Whether this customer opted into marketing from you.falseunless customers check the marketing consent boxwhen using Paddle Checkout. Set automatically by Paddle.


Whether this entity can be used in Paddle.


Your own structured key-value data.


Valid IETF BCP 47 short form locale tag.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


Import information for this entity.nullif this entity is not imported.


Unique Paddle ID for this notification, prefixed withntf_.


```json
1234567891011121314151617181{
2  "event_id": "evt_01hv6y1jtn1fr98zq3cvarxx2e",
3  "event_type": "customer.created",
4  "occurred_at": "2024-04-11T15:57:25.205966Z",
5  "notification_id": "ntf_01hv6y1jx2m6n1qk95m0cj69dg",
6  "data": {
7    "id": "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
8    "name": "Jo Brown",
9    "email": "jo@example.com",
10    "locale": "en",
11    "status": "active",
12    "created_at": "2024-04-11T15:57:24.813Z",
13    "updated_at": "2024-04-11T15:57:24.813Z",
14    "custom_data": null,
15    "import_meta": null,
16    "marketing_consent": false
17  }
18}
```


---

*Last scraped: 2025-12-15 20:13:38*
