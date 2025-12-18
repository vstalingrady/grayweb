# price.imported - Paddle Developer

**Source:** https://developer.paddle.com/webhooks/prices/price-imported

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

## price.imported

[price.imported](/webhooks/prices/price-imported#price.imported)

Occurs when a price is imported.


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
2  "event_id": "evt_01hgarz844zdfws6djn9rz6qm7",
3  "event_type": "price.imported",
4  "occurred_at": "2024-01-01T13:31:34.071379Z",
5  "notification_id": "ntf_01hd46rrqkrbndwzrarcew6t21",
6  "data": {
7    "id": "pri_01gsz95g2zrkagg294kpstx54r",
8    "product_id": "pro_01gsz92krfzy3hcx5h5rtgnfwz",
9    "type": "standard",
10    "description": "Monthly (recurring addon)",
11    "name": "Monthly (recurring addon)",
12    "billing_cycle": {
13      "interval": "month",
14      "frequency": 1
15    },
16    "trial_period": null,
17    "tax_mode": "account_setting",
18    "unit_price": {
19      "amount": "25000",
20      "currency_code": "USD"

```


---

*Last scraped: 2025-12-15 20:14:19*
