# checkout.warning - Paddle Developer

**Source:** https://developer.paddle.com/paddlejs/general/checkout-warning

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
- Generalcheckout.loadedcheckout.closedcheckout.updatedcheckout.completedcheckout.warningcheckout.error
- checkout.loaded
[checkout.loaded](/paddlejs/general/checkout-loaded)
- checkout.closed
[checkout.closed](/paddlejs/general/checkout-closed)
- checkout.updated
[checkout.updated](/paddlejs/general/checkout-updated)
- checkout.completed
[checkout.completed](/paddlejs/general/checkout-completed)
- checkout.warning
[checkout.warning](/paddlejs/general/checkout-warning)
- checkout.error
[checkout.error](/paddlejs/general/checkout-error)
- Items
- Customer
- Payment
- Discount
- Upsell

## checkout.warning

[checkout.warning](/paddlejs/general/checkout-warning#checkout.warning)

Emitted when a warning occurs on a checkout.


Typically happens when information passed to a checkout isn't valid or is incomplete, but this doesn'tprevent Paddle from opening a checkout.


Type of error encountered.


Short snake case string that describes this error.


Some information about what went wrong as a human-readable string.


Link to a page in the error reference for this specific error.


List of errors.


Field where validation error occurred.


Information about how the field failed validation.


```json
1234567891011121{
2  "type": "checkout.warning",
3  "code": "checkout_creation_invalid_field",
4  "detail": "Invalid values for fields in request",
5  "documentation_url": "https://developer.paddle.com/errors/shared/invalid_field",
6  "errors": [
7    {
8      "field": "/data/customer",
9      "message": "Either id or email is required when customer is present."
10    }
11  ]
12}
```


---

*Last scraped: 2025-12-15 20:20:53*
