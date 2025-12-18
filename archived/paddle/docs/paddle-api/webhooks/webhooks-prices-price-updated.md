# price.updated - Paddle Developer

**Source:** https://developer.paddle.com/webhooks/prices/price-updated

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
- Pricesprice.createdprice.importedprice.updated
- price.created
[price.created](/webhooks/prices/price-created)
- price.imported
[price.imported](/webhooks/prices/price-imported)
- price.updated
[price.updated](/webhooks/prices/price-updated)
- Products
- Reports
- Subscriptions
- Transactions

## price.updated

[price.updated](/webhooks/prices/price-updated#price.updated)

Occurs when a price is updated.


created_atandupdated_atmay benullin events that occurred before this field was added to price entities.


Unique Paddle ID for this event, prefixed withevt_.


Type of event sent by Paddle, in the formatentity.event_type.


RFC 3339 datetime string of when this event occurred.


Represents a price entity.


Unique Paddle ID for this price, prefixed withpri_.


Paddle ID for the product that this price is for, prefixed withpro_.


Internal description for this price, not shown to customers. Typically notes for your team.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Name of this price, shown to customers at checkout and on invoices. Typically describes how often the related product bills.


How often this price should be charged.nullif price is non-recurring (one-time).


Trial period for the product related to this price. The billing cycle begins once the trial period is over.nullfor no trial period. Requiresbilling_cycle.


How tax is calculated for this price.


Base price. This price applies to all customers, except for customers located in countries where you haveunit_price_overrides.


List of unit price overrides. Use to override the base price with a custom price and currency for a country or group of countries.


Limits on how many times the related product can be purchased at this price. Useful for discount campaigns.


Whether this entity can be used in Paddle.


Your own structured key-value data.


Import information for this entity.nullif this entity is not imported.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


Unique Paddle ID for this notification, prefixed withntf_.


```json
12345678910111213141516171819201{
2  "event_id": "evt_01hv0vd770td3m64srybj8453a",
3  "event_type": "price.updated",
4  "occurred_at": "2024-04-09T07:15:54.208116Z",
5  "notification_id": "ntf_01hv0vd7900qdtv6h6w8m2h6qf",
6  "data": {
7    "id": "pri_01hv0vax6rv18t4tamj848ne4d",
8    "name": "Monthly (per seat)",
9    "type": "standard",
10    "status": "active",
11    "quantity": {
12      "maximum": 100,
13      "minimum": 1
14    },
15    "tax_mode": "account_setting",
16    "product_id": "pro_01htz88xpr0mm7b3ta2pjkr7w2",
17    "unit_price": {
18      "amount": "500",
19      "currency_code": "USD"
20    },

```


---

*Last scraped: 2025-12-15 20:14:20*
