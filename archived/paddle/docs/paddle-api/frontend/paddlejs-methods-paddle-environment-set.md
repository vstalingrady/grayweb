# Paddle.Environment.set()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-environment-set

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
- Payment
- Discount
- Upsell

# Paddle.Environment.set()

[Paddle.Environment.set()](/paddlejs/methods/paddle-environment-set#paddle.environment.set())

Sets environment to sandbox or live.


UsePaddle.Environment.set()to set the environment for your checkout.


Only used to set thesandbox environment. If not present, Paddle uses the production environment.

[sandbox environment](/build/tools/sandbox)

You should call this method before calling any other Paddle.js methods, ideally just before yourPaddle.Initialize()call.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

## Parameters

[Parameters](/paddlejs/methods/paddle-environment-set#params)

Paddle environment that you're working with.


## Examples

[Examples](/paddlejs/methods/paddle-environment-set#examples)

This example sets the environment tosandbox.


```javascript
123451Paddle.Environment.set("sandbox");
2Paddle.Initialize({
3  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN',
4  pwCustomer: { }
5});
```


We recommend removingPaddle.Environment.set()before going live.


This example doesn't set the checkout environment. Paddle defaults toproduction.


```javascript
12341Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN',
3  pwCustomer: { }
4});
```


## Related pages

[Related pages](/paddlejs/methods/paddle-environment-set#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/paddlejs/methods/paddle-initialize)
[Read more](/paddlejs/methods/paddle-checkout-open)
- Paddle.Environment.set()
[Paddle.Environment.set()](#paddle.environment.set())
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:38*
