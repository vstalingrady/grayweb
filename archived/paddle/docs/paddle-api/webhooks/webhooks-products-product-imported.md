# product.imported - Paddle Developer

**Source:** https://developer.paddle.com/webhooks/products/product-imported

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

## product.imported

[product.imported](/webhooks/products/product-imported#product.imported)

Occurs when a product is imported.


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
2  "event_id": "evt_01hgas2cm8r02nxryp83jqvg6k",
3  "event_type": "product.imported",
4  "occurred_at": "2024-01-28T10:54:46.181Z",
5  "notification_id": "ntf_01hd46rqryfc8d7d5yz595k2k6",
6  "data": {
7    "id": "pro_01gsz92krfzy3hcx5h5rtgnfwz",
8    "name": "VIP support",
9    "tax_category": "standard",
10    "type": "standard",
11    "description": "Get exclusive access to our expert team of product specialists, available to help you make the most of your AeroEdit subscription.",
12    "image_url": "https://paddle.s3.amazonaws.com/user/165798/qgyipKJwRtq98YNboipo_vip-support.png",
13    "custom_data": null,
14    "status": "active",
15    "import_meta": {
16      "external_id": "16a2c842-8ddc-11ee-b9d1-0242ac120002",
17      "imported_from": "paddle_classic"
18    },
19    "created_at": "2024-01-28T10:54:46.181Z",
20    "updated_at": "2024-01-28T10:54:46.181Z"

```


---

*Last scraped: 2025-12-15 20:14:17*
