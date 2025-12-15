# Hosted checkout URL query parameters

**Source:** https://developer.paddle.com/paddlejs/hosted-checkout-url-parameters

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

# Hosted checkout URL query parameters

[Hosted checkout URL query parameters](/paddlejs/hosted-checkout-url-parameters#hosted-checkout-url-query-parameters)

Append query parameters to hosted checkout launch URLs to pass information about a customer and items to a checkout.


You can usehosted checkoutsto let users securely make purchases outside your mobile app. Each hosted checkout has a unique link that you can add to your app to let customers open a checkout that's fully hosted by Paddle.

[hosted checkouts](/concepts/sell/hosted-checkout-mobile-apps)
> Access to hosted checkouts on live accounts is limited to approved mobile app companies. It's available on allsandbox accountsfor evaluation and testing. To request approval,contact support.


Access to hosted checkouts on live accounts is limited to approved mobile app companies. It's available on allsandbox accountsfor evaluation and testing. To request approval,contact support.

[sandbox accounts](/build/tools/sandbox)
[contact support](mailto:sellers@paddle.com)

All hosted checkout URL query parameters are optional. You can set defaults when creating a hosted checkout inPaddle > Checkout > Hosted Checkouts, like the prices to open the checkout with if nopriceIdortransactionIdis passed. However, one is required if no default price is set.


Hosted checkout parameters also work with thePaddle mobile web payments starter kit, which you can use to deploy your own mobile purchase workflow.

[Paddle mobile web payments starter kit](https://github.com/PaddleHQ/paddle-mobile-web-payments-starter)
> For maximum compatibility across browsers, make sure topercent-encode query strings. For example, passmax%2Bpaddle%40example.comformax+paddle@example.com.


For maximum compatibility across browsers, make sure topercent-encode query strings. For example, passmax%2Bpaddle%40example.comformax+paddle@example.com.

[percent-encode query strings](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding)

## Parameters

[Parameters](/paddlejs/hosted-checkout-url-parameters#params)

Paddle ID of the price for the item that this hosted checkout is for. Pass a comma-separated list of price IDs to open a checkout for multiple prices. If omitted and notransaction_idis passed, the default prices for the hosted checkout are used. Required if no default prices are set and notransaction_idis passed.


Discount code to apply. Use to prepopulate a discount at checkout. Takes precedence overdiscount_id. If omitted, no discount is applied.


Paddle ID of a discount to apply. Use to prepopulate a discount at checkout. Ignored ifdiscount_codeis also passed. If omitted, no discount is applied.


Paddle ID of the customer for this checkout. Use if you know the customer, like if they're authenticated and making a change to their subscription. You can't use if you're passinguser_email.


Email for this customer. You can't use if you're passingpaddle_customer_id.


Two-letter ISO 3166 country code for this customer.


ZIP or postal code of the address. Only asked for in countries with postal codes.


Unique identifier for this customer in RevenueCat. Used for fulfillment using entitlements in RevenueCat.


Paddle ID of an existing transaction. You can create a transaction on your backend and pass to checkout to use, instead of passingprice_idand customer details. If omitted and noprice_idis passed, the default prices for the hosted checkout are used. Required if no default prices are set and noprice_idis passed.


Language for the checkout.


Theme for the checkout. If omitted, defaults to light.


Payment options presented to customers at checkout.


Whether the option to add a tax number is displayed at checkout. Defaults totrue.


## Examples

[Examples](/paddlejs/hosted-checkout-url-parameters#examples)

This example passes a price ID to Paddle Checkout to specify what the customer is purchasing.


```sh
11https://pay.paddle.io/checkout/hsc_01jt8s46kx4nv91002z7vy4ecj_1as3scas9cascascasasx23dsa3asd2a?price_id=pri_01h1vjg3sqjj1y9tvazkdqe5vt
```


This example passes two price IDs to Paddle Checkout to specify that a customer is purchasing two items.


```sh
11https://pay.paddle.io/checkout/hsc_01jt8s46kx4nv91002z7vy4ecj_1as3scas9cascascasasx23dsa3asd2a?price_id=pri_01h1vjg3sqjj1y9tvazkdqe5vt,pri_01hv0vax6rv18t4tamj848ne4d
```


This example passes a price ID to specify Paddle Checkout what the customer is purchasing, along with a user email address. The email address ispercent-encoded.

[percent-encoded](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding)

```sh
11https://pay.paddle.io/checkout/hsc_01jt8s46kx4nv91002z7vy4ecj_1as3scas9cascascasasx23dsa3asd2a?price_id=pri_01h1vjg3sqjj1y9tvazkdqe5vt&user_email=sam%40example.com
```


This example passes a price ID to specify Paddle Checkout what the customer is purchasing, along with a discount code.


```sh
11https://pay.paddle.io/checkout/hsc_01jt8s46kx4nv91002z7vy4ecj_1as3scas9cascascasasx23dsa3asd2a?price_id=pri_01h1vjg3sqjj1y9tvazkdqe5vt&discount_code=BF20OFF
```


## Related pages

[Related pages](/paddlejs/hosted-checkout-url-parameters#related-pages)
[Read more](/concepts/sell/hosted-checkout-mobile-apps)
[Read more](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app)
[Read more](/build/mobile-apps/nextjs-vercel-mobile-app-starter-kit)
- Hosted checkout URL query parameters
[Hosted checkout URL query parameters](#hosted-checkout-url-query-parameters)
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:27*
