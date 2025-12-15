# product.created - Paddle Developer

**Source:** https://developer.paddle.com/webhooks/products/product-created

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
- Productsproduct.createdproduct.importedproduct.updated
- product.created
[product.created](/webhooks/products/product-created)
- product.imported
[product.imported](/webhooks/products/product-imported)
- product.updated
[product.updated](/webhooks/products/product-updated)
- Reports
- Subscriptions
- Transactions

## product.created

[product.created](/webhooks/products/product-created#product.created)

Occurs when a product is created.


updated_atmay benullin events that occurred before this field was added to product entities.


Unique Paddle ID for this event, prefixed withevt_.


Type of event sent by Paddle, in the formatentity.event_type.


RFC 3339 datetime string of when this event occurred.


Represents a product entity.


Unique Paddle ID for this product, prefixed withpro_.


Name of this product.


Short description for this product.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Tax category for this product. Used for charging the correct rate of tax. Selected tax category must be enabled on your Paddle account.


Image for this product. Included in the checkout and on some customer documents.


Your own structured key-value data.


Whether this entity can be used in Paddle.


Import information for this entity.nullif this entity is not imported.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


Unique Paddle ID for this notification, prefixed withntf_.


```json
12345678910111213141516171819201{
2  "event_id": "evt_01htz88y5k59y9rrv15p72dv91",
3  "event_type": "product.created",
4  "occurred_at": "2024-04-08T16:22:16.499189Z",
5  "notification_id": "ntf_01htz88y8sg8cww5jdj4q68yq0",
6  "data": {
7    "id": "pro_01htz88xpr0mm7b3ta2pjkr7w2",
8    "name": "AeroEdit Student",
9    "type": "standard",
10    "status": "active",
11    "image_url": "https://paddle.s3.amazonaws.com/user/165798/bT1XUOJAQhOUxGs83cbk_pro.png",
12    "custom_data": {
13      "features": {
14        "sso": false,
15        "route_planning": true,
16        "payment_by_invoice": false,
17        "aircraft_performance": true,
18        "compliance_monitoring": false,
19        "flight_log_management": true
20      },

```


---

*Last scraped: 2025-12-15 20:13:47*
