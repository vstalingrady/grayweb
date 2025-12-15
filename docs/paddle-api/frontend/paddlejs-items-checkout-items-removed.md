# checkout.items.removed - Paddle Developer

**Source:** https://developer.paddle.com/paddlejs/items/checkout-items-removed

---

- Overview
[Overview](/paddlejs/overview)
- Setup & Authentication
- Manage client-side tokens
[Manage client-side tokens](/paddlejs/client-side-tokens)
- Include and initialize Paddle.js
[Include and initialize Paddle.js](/paddlejs/include-paddlejs)
- Test Retain x Paddle.js
[Test Retain x Paddle.js](/paddlejs/test-retain)
- Methods
- Paddle.Initialize()
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
- Paddle.Update()
[Paddle.Update()](/paddlejs/methods/paddle-update)
- Paddle.Environment.set()
[Paddle.Environment.set()](/paddlejs/methods/paddle-environment-set)
- Paddle.Checkout.open()
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
- Paddle.Checkout.updateCheckout()
[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)
- Paddle.Checkout.updateItems()
[Paddle.Checkout.updateItems()](/paddlejs/methods/paddle-checkout-updateitems)
- Paddle.Checkout.close()
[Paddle.Checkout.close()](/paddlejs/methods/paddle-checkout-close)
- Paddle.PricePreview()
[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)
- Paddle.Retain.demo()
[Paddle.Retain.demo()](/paddlejs/methods/paddle-retain-demo)
- Paddle.Retain.initCancellationFlow()
[Paddle.Retain.initCancellationFlow()](/paddlejs/methods/paddle-retain-initcancellationflow)
- Paddle.Spinner.show()
[Paddle.Spinner.show()](/paddlejs/methods/paddle-spinner-show)
- Paddle.Spinner.hide()
[Paddle.Spinner.hide()](/paddlejs/methods/paddle-spinner-hide)
- Paddle.Status.libraryVersion
[Paddle.Status.libraryVersion](/paddlejs/methods/paddle-status-libraryversion)
- Paddle.TransactionPreview()
[Paddle.TransactionPreview()](/paddlejs/methods/paddle-transactionpreview)
- Hosted checkouts
- URL parameters
[URL parameters](/paddlejs/hosted-checkout-url-parameters)
- HTML data attributes
- HTML data attributes
[HTML data attributes](/paddlejs/html-data-attributes)
- Events
- Overview
[Overview](/paddlejs/events/overview)
- General
- Itemscheckout.items.updatedcheckout.items.removed
- checkout.items.updated
[checkout.items.updated](/paddlejs/items/checkout-items-updated)
- checkout.items.removed
[checkout.items.removed](/paddlejs/items/checkout-items-removed)
- Customer
- Payment
- Discount
- Upsell

## checkout.items.removed

[checkout.items.removed](/paddlejs/items/checkout-items-removed#checkout.items.removed)

Emitted when an item is removed from a checkout.


Name of this event, in the formatentity.event_type.


Event payload.


Unique Paddle ID for this checkout, prefixed withche_.


Unique Paddle ID for the transaction related to this checkout, prefixed withtxn_.


Status of this checkout.


Key-value pairs of custom data. Must be valid JSON and contain at least one key.


Supported three-letter ISO 4217 currency code for this checkout.


Information about the customer on this checkout.


Items to bill for.


Financial breakdown of the total for this checkout, calculated by Paddle.


Financial breakdown of the recurring total for this checkout, calculated by Paddle.  Only included where there are recurring items.


Information about the payment details used on this checkout.


Checkout settings.


Information about the discount applied to this checkout. Only included when a discount is applied.


Context about the rendered upsell checkout.nullif an upsell flow was not rendered.


```json
12345678910111213141516171819201{
2  "name": "checkout.items.removed",
3  "data": {
4    "id": "che_01k9ppwfg7nkr1s47pntfe7x3s",
5    "transaction_id": "txn_01k9ppwf885xk7azx0xgnp6kp1",
6    "status": "draft",
7    "custom_data": null,
8    "currency_code": "USD",
9    "customer": {
10      "id": null,
11      "email": null,
12      "address": null,
13      "business": null
14    },
15    "items": [
16      {
17        "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
18        "price_name": "Monthly (per seat)",
19        "product": {
20          "id": "pro_01gsz4t5hdjse780zja8vvr7jg",

```


---

*Last scraped: 2025-12-15 20:20:56*
