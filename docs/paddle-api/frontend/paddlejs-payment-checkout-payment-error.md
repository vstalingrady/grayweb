# checkout.payment.error - Paddle Developer

**Source:** https://developer.paddle.com/paddlejs/payment/checkout-payment-error

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
- Items
- Customer
- Paymentcheckout.payment.selectedcheckout.payment.initiatedcheckout.payment.failedcheckout.payment.error
- checkout.payment.selected
[checkout.payment.selected](/paddlejs/payment/checkout-payment-selected)
- checkout.payment.initiated
[checkout.payment.initiated](/paddlejs/payment/checkout-payment-initiated)
- checkout.payment.failed
[checkout.payment.failed](/paddlejs/payment/checkout-payment-failed)
- checkout.payment.error
[checkout.payment.error](/paddlejs/payment/checkout-payment-error)
- Discount
- Upsell

## checkout.payment.error

[checkout.payment.error](/paddlejs/payment/checkout-payment-error#checkout.payment.error)

Emitted when a payment errors for a checkout. Typically occurs when no payment methods are available.


Name of this event, in the formatentity.event_type.


Type of error which occured.


Short snake case string that describes this error. Use to search the error reference.


Some information about what went wrong as a human-readable string.


Link to a page in the error reference for this specific error.


```json
12345671{
2  "name": "checkout.payment.error",
3  "type": "front-end_error",
4  "code": "no_payment_methods_available",
5  "detail": "No payment methods available",
6  "documentation_url": "https://developer.paddle.com/api-reference/overview"
7}
```


---

*Last scraped: 2025-12-15 20:21:00*
