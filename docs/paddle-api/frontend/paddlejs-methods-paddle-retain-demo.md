# Paddle.Retain.demo()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-retain-demo

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

# Paddle.Retain.demo()

[Paddle.Retain.demo()](/paddlejs/methods/paddle-retain-demo#paddle.retain.demo())

Demos Paddle Retain functionality.


UsePaddle.Retain.demo()to demo Paddle Retain functionality.


Typically used by typingPaddle.Retain.demo({feature: 'featureName')directly into the browser console. You can simulate payment recovery and dunning, Cancellation Flows, and Term Optimization.

> Only available for live accounts.Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.


Only available for live accounts.


Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.

> This method is for Paddle Billing only. If you use Paddle Retain with another billing platform, use theprofitwellmethod in the ProfitWell.js snippet instead. To learn more, seeTest Paddle Retain


This method is for Paddle Billing only. If you use Paddle Retain with another billing platform, use theprofitwellmethod in the ProfitWell.js snippet instead. To learn more, seeTest Paddle Retain

[Test Paddle Retain](/paddlejs/test-retain)

## Parameters

[Parameters](/paddlejs/methods/paddle-retain-demo#params)

Paddle Retain feature to simulate. Features use sample data.


## Examples

[Examples](/paddlejs/methods/paddle-retain-demo#examples)

This example simulates a cancellation flow. Type this directly into your browser console to demo Retain Cancellation Flows:


```javascript
11Paddle.Retain.demo({feature: 'cancellationFlow'})
```


This example simulates the payment form that a customer sees when they click on a link in a payment recovery email. Type this directly into your browser console to demo Retain Payment Recovery:


```javascript
11Paddle.Retain.demo({feature: 'paymentRecovery'})
```


This example simulates an in-app notification that prompts a customer to update their payment method. Type this directly into your browser console to demo an in-app notification for Retain Payment Recovery:


```javascript
11Paddle.Retain.demo({feature: 'paymentRecoveryInApp'})
```


This example simulates the modal that a customer sees when they click on a link in a Term Optimization email. Type this directly into your browser console to demo Retain Term Optimization:


```javascript
11Paddle.Retain.demo({feature: 'termOptimization'})
```


This example simulates an in-app notification that prompts a customer to upgrade their plan. Type this directly into your browser console to demo an in-app notification for Retain Term Optimization:


```javascript
11Paddle.Retain.demo({feature: 'termOptimizationInApp'})
```


To learn more, seeTest Paddle Retain

[Test Paddle Retain](/paddlejs/test-retain)

## Related pages

[Related pages](/paddlejs/methods/paddle-retain-demo#related-pages)
[Read more](/build/retain/set-up-retain-profitwell)
[Read more](/build/retain/configure-payment-recovery-dunning)
[Read more](/paddlejs/test-retain)
- Paddle.Retain.demo()
[Paddle.Retain.demo()](#paddle.retain.demo())
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:26*
