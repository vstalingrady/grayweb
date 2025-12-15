# Simulate Paddle Retain interventions

**Source:** https://developer.paddle.com/paddlejs/test-retain

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

# Simulate Paddle Retain interventions

[Simulate Paddle Retain interventions](/paddlejs/test-retain#simulate-paddle-retain-interventions)

Check you've installed Paddle.js with Retain or the ProfitWell.js snippets correctly, and see for yourself what Retain looks like.


Once you've installed Paddle.js with Retain, or ProfitWell.js snippets if you're using a platform other than Paddle Billing, you can simulate Paddle Retain interventions by running some commands in your browser console. This lets you check that Paddle Retain is installed correctly, and gives you a chance to see what customers see when Retain is in action.


## Before you begin

[Before you begin](/paddlejs/test-retain#prerequisites)
> Paddle Retain works with live data for your billing platform. This means you can't integrate or test with sandbox accounts.


Paddle Retain works with live data for your billing platform. This means you can't integrate or test with sandbox accounts.


If you haven't already, includePaddle.js with Retainin your web app and on your commercial website.Paddle.js integrates with Retain, so you don't have to include a separate Retain script.

[Paddle.js with Retain](/paddlejs/include-paddlejs)
[Paddle.js integrates with Retain](/concepts/retain/overview)

We recommend that youset up Retainandconfigure payment recoverybefore testing.

[set up Retain](/build/retain/set-up-retain-profitwell)
[configure payment recovery](/build/retain/configure-payment-recovery-dunning)

## Simulate payment recovery

[Simulate payment recovery](/paddlejs/test-retain#notifications)

Emails, and text messagessent by Paddle Retain include a link to update payment method. When customers click the link to update, they're presented with a secure form to enter their details on your website — no need to log in or hunt through billing pages.

[Emails, and text messages](/build/retain/configure-payment-recovery-dunning)

Retain also sendspayment recovery notificationsin-app, reaching customers when they're using your product.

[payment recovery notifications](/build/retain/configure-payment-recovery-dunning#notifications)

You can simulate the payment recovery form that a customer sees when they click a Retain link and payment recovery notifications on a page where you've installed Paddle Retain.

1. Go to a page where you've installed Paddle.js.

Go to a page where you've installed Paddle.js.

1. Open yourbrowser console.

Open yourbrowser console.

[browser console](https://developer.chrome.com/docs/devtools/console/)
1. TypePaddle.Retain.demo({feature: 'paymentRecoveryInApp'})to demo a payment recovery notification.

TypePaddle.Retain.demo({feature: 'paymentRecoveryInApp'})to demo a payment recovery notification.

[Paddle.Retain.demo({feature: 'paymentRecoveryInApp'})](/paddlejs/methods/paddle-retain-demo)
1. TypePaddle.Retain.demo({feature: 'paymentRecovery'})to demo a payment recovery form.

TypePaddle.Retain.demo({feature: 'paymentRecovery'})to demo a payment recovery form.

[Paddle.Retain.demo({feature: 'paymentRecovery'})](/paddlejs/methods/paddle-retain-demo)

The form that appears uses Paddlesandbox, so you may usetest card detailsto simulate a successful or failed payment.

[sandbox](/build/tools/sandbox)
[test card details](/concepts/payment-methods/credit-debit-card#test-payment-method)
> UseCommand+Option+J(Mac) orCtrl+Shift+J(Windows) to quickly open your browser console in Google Chrome.


UseCommand+Option+J(Mac) orCtrl+Shift+J(Windows) to quickly open your browser console in Google Chrome.


## Simulate Cancellation Flows

[Simulate Cancellation Flows](/paddlejs/test-retain#cancellation-flows)

Cancellation Flowshelp you save customers from canceling by presenting them with dynamic salvage attempts while gathering cancellation insights. Paddle Retain asks customers why they're canceling, as well as what they found valuable about your app, then presents curated salvage attempts.

[Cancellation Flows](/build/retain/configure-cancellation-flows-surveys)

You can simulate Cancellation Flows on a page where you've installed Paddle Retain.

1. Go to a page where you've installed Paddle.js.

Go to a page where you've installed Paddle.js.

1. Open yourbrowser console.

Open yourbrowser console.

[browser console](https://developer.chrome.com/docs/devtools/console/)
1. TypePaddle.Retain.demo({feature: 'cancellationFlow'}).

TypePaddle.Retain.demo({feature: 'cancellationFlow'}).

[Paddle.Retain.demo({feature: 'cancellationFlow'})](/paddlejs/methods/paddle-retain-demo)

## Simulate Term Optimization

[Simulate Term Optimization](/paddlejs/test-retain#term-optimization)

Term Optimizationlets you increase cashflow and retention by driving key customer personas onto longer term plans. Paddle Retain determines which customers are most engaged and automatically suggests an upgrade from monthly to quarterly or annual plans, reducing your rate of churn.

[Term Optimization](https://www.paddle.com/help/profitwell-metrics/retain/get-started/retain-term-optimization)

You can simulate Term Optimization on a page where you've installed Paddle Retain.

1. Go to a page where you've installed Paddle.js.

Go to a page where you've installed Paddle.js.

1. Open yourbrowser console.

Open yourbrowser console.

[browser console](https://developer.chrome.com/docs/devtools/console/)
1. TypePaddle.Retain.demo({feature: 'termOptimizationInApp'})to demo a Term Optimization notification.

TypePaddle.Retain.demo({feature: 'termOptimizationInApp'})to demo a Term Optimization notification.

[Paddle.Retain.demo({feature: 'termOptimizationInApp'})](/paddlejs/methods/paddle-retain-demo)
1. TypePaddle.Retain.demo({feature: 'termOptimization'})to demo a Term Optimization form.

TypePaddle.Retain.demo({feature: 'termOptimization'})to demo a Term Optimization form.

[Paddle.Retain.demo({feature: 'termOptimization'})](/paddlejs/methods/paddle-retain-demo)

## Simulate other features

[Simulate other features](/paddlejs/test-retain#misc)

Retain ReactivationsandRetain Lockoutaren't available for all billing platforms supported by Paddle Retain.

[Retain Reactivations](https://www.paddle.com/help/profitwell-metrics/retain/get-started/retain-reactivations)
[Retain Lockout](https://www.paddle.com/help/profitwell-metrics/retain/get-started/lockout)

If you use a platform that supports Retain Reactivations and Retain Lockout, you can simulate them on a page where you've installed Paddle Retain.


#### Reactivations

[Reactivations](/paddlejs/test-retain#reactivations)
1. Go to a page where you've installed the ProfitWell.js snippets.

Go to a page where you've installed the ProfitWell.js snippets.

1. Open yourbrowser console.

Open yourbrowser console.

[browser console](https://developer.chrome.com/docs/devtools/console/)
1. Typeprofitwell('cq_demo', 'reactivation').

Typeprofitwell('cq_demo', 'reactivation').


#### Lockout

[Lockout](/paddlejs/test-retain#lockout)
1. Go to a page where you've installed the ProfitWell.js snippets.

Go to a page where you've installed the ProfitWell.js snippets.

1. Open yourbrowser console.

Open yourbrowser console.

[browser console](https://developer.chrome.com/docs/devtools/console/)
1. Typeprofitwell('cq_demo', 'lockout').

Typeprofitwell('cq_demo', 'lockout').


## Related pages

[Related pages](/paddlejs/test-retain#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/build/retain/set-up-retain-profitwell)
[Read more](/concepts/retain/overview)
- Simulate Paddle Retain interventions
[Simulate Paddle Retain interventions](#simulate-paddle-retain-interventions)
- Before you begin
[Before you begin](#prerequisites)
- Simulate payment recovery
[Simulate payment recovery](#notifications)
- Simulate Cancellation Flows
[Simulate Cancellation Flows](#cancellation-flows)
- Simulate Term Optimization
[Simulate Term Optimization](#term-optimization)
- Simulate other features
[Simulate other features](#misc)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:18*
