# Paddle.Update()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-update

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

# Paddle.Update()

[Paddle.Update()](/paddlejs/methods/paddle-update#paddle.update())

Updates values passed to Paddle.js during initialization.


UsePaddle.Update()to update values sent to Paddle.js during initialization. This is typically used when working with single page applications to pass an updated customer topwCustomerwhen a customer is identified.


You must callPaddle.Initalize()before callingPaddle.Update(). Use thePaddle.Initializedflag to determine whether you need to callPaddle.Initialize()orPaddle.Update().


## Parameters

[Parameters](/paddlejs/methods/paddle-update#params)

Identifier for a logged-in customer for Paddle Retain. Pass an empty object if you don't have a logged-in customer. Paddle Retain is only loaded for live accounts.


Paddle ID of a customer entity, prefixedctm_. Only customer IDs are accepted. Don't pass subscription IDs, other Paddle IDs, or your own internal identifiers for a customer.


Function to call for Paddle.js events.


## Examples

[Examples](/paddlejs/methods/paddle-update#examples)

This example passes a newpwCustomerto Paddle.js usingPaddle.Update().


```javascript
123451Paddle.Update({
2  pwCustomer: {
3    id: 'ctm_01gt25aq4b2zcfw12szwtjrbdt'
4  }
5});
```


This example checks if Paddle is initialized using thePaddle.Initializedflag, then callsPaddle.Update()to setpwCustomerif not initialized.


```javascript
123456789101112131415161718191if (Paddle.Initialized) {
2  Paddle.Update({
3      pwCustomer: {
4        id: 'ctm_01gt25aq4b2zcfw12szwtjrbdt'
5      }
6    }
7  );
8} else {
9  Paddle.Initalize({
10      token: 'live_7d279f61a3499fed520f7cd8c08',
11      checkout: {
12        displayMode: "overlay",
13        theme: "dark",
14        locale: "en"
15      },
16      pwCustomer: { },
17    }
18  );
19}
```


## Related pages

[Related pages](/paddlejs/methods/paddle-update#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/paddlejs/events/overview)
[Read more](/paddlejs/methods/paddle-checkout-open)
- Paddle.Update()
[Paddle.Update()](#paddle.update())
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:36*
