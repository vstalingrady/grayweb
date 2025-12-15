# Build an overlay checkout

**Source:** https://developer.paddle.com/build/checkout/build-overlay-checkout

---

- Overview
[Overview](/build/overview)
- Setup guides
- Get started
[Get started](/build/onboarding/overview)
- Setup checklist
[Setup checklist](/build/onboarding/set-up-checklist)
- Go-live checklist
[Go-live checklist](/build/onboarding/go-live-checklist)
- Tutorials
- Build a pricing page
[Build a pricing page](/build/checkout/build-pricing-page)
- Build an overlay checkout
[Build an overlay checkout](/build/checkout/build-overlay-checkout)
- Build an inline checkout
[Build an inline checkout](/build/checkout/build-branded-inline-checkout)
- Build and deploy a Next.js app
[Build and deploy a Next.js app](/build/nextjs-supabase-vercel-starter-kit)
- Launch checkout from iOS
- Create a cardless trial
[Create a cardless trial](/build/subscriptions/cardless-trials)
- Product catalog
- Create products and prices
[Create products and prices](/build/products/create-products-prices)
- Localize prices
[Localize prices](/build/products/offer-localized-pricing)
- Create and manage discounts
[Create and manage discounts](/build/products/offer-discounts-promotions-coupons)
- Checkout
- Pass checkout settings
[Pass checkout settings](/build/checkout/set-up-checkout-default-settings)
- Pass or update checkout items
[Pass or update checkout items](/build/checkout/pass-update-checkout-items)
- Prefill checkout properties
[Prefill checkout properties](/build/checkout/prefill-checkout-properties)
- Handle checkout success
[Handle checkout success](/build/checkout/handle-success-post-checkout)
- Present saved payment methods
[Present saved payment methods](/build/checkout/saved-payment-methods)
- Brand inline checkout
[Brand inline checkout](/build/checkout/brand-customize-inline-checkout)
- Open a checkout for an upsell
[Open a checkout for an upsell](/build/checkout/upsell-checkout)
- Recover abandoned checkouts
[Recover abandoned checkouts](/build/checkout/checkout-recovery)
- Work with custom subdomains
[Work with custom subdomains](/build/checkout/custom-subdomains)
- Invoices
- Create and issue an invoice
[Create and issue an invoice](/build/invoices/create-issue-invoices)
- Cancel an invoice
[Cancel an invoice](/build/invoices/cancel-invoices)
- Transactions
- Create a transaction
[Create a transaction](/build/transactions/create-transaction)
- Set your default payment link
[Set your default payment link](/build/transactions/default-payment-link)
- Bill for non-catalog items
[Bill for non-catalog items](/build/transactions/bill-create-custom-items-prices-products)
- Pass a transaction to a checkout
[Pass a transaction to a checkout](/build/transactions/pass-transaction-checkout)
- Revise billed customer details
[Revise billed customer details](/build/sell/transactions/revise-transaction-customer-details)
- Change collection mode
[Change collection mode](/build/transactions/change-collection-mode-transaction)
- Refund or credit a transaction
[Refund or credit a transaction](/build/transactions/create-transaction-adjustments)
- Work with custom data
[Work with custom data](/build/transactions/custom-data)
- Subscriptions
- Add or remove items
[Add or remove items](/build/subscriptions/add-remove-products-prices-addons)
- Upgrade or downgrade
[Upgrade or downgrade](/build/subscriptions/replace-products-prices-upgrade-downgrade)
- Bill for one-time charges
[Bill for one-time charges](/build/subscriptions/bill-add-one-time-charge)
- Change billing dates
[Change billing dates](/build/subscriptions/change-billing-dates)
- Update payment details
[Update payment details](/build/subscriptions/update-payment-details)
- Pause a subscription
[Pause a subscription](/build/subscriptions/pause-subscriptions)
- Cancel a subscription
[Cancel a subscription](/build/subscriptions/cancel-subscriptions)
- Provisioning
- Provision your app
[Provision your app](/build/subscriptions/provision-access-webhooks)
- Subscription creation
[Subscription creation](/build/lifecycle/subscription-creation)
- Subscription renewal
[Subscription renewal](/build/lifecycle/subscription-renewal)
- Subscription past due
[Subscription past due](/build/lifecycle/subscription-renewal-dunning)
- Subscription pause or resume
[Subscription pause or resume](/build/lifecycle/subscription-pause-resume)
- Subscription cancellation
[Subscription cancellation](/build/lifecycle/subscription-cancellation)
- Payment details update
[Payment details update](/build/lifecycle/payment-details-update)
- Retain
- Set up Paddle Retain
[Set up Paddle Retain](/build/retain/set-up-retain-profitwell)
- Configure recovery and dunning
[Configure recovery and dunning](/build/retain/configure-payment-recovery-dunning)
- Build cancellation surveys
[Build cancellation surveys](/build/retain/configure-cancellation-flows-surveys)
- Proactively upgrade plans
[Proactively upgrade plans](/build/retain/configure-term-optimization-automatic-upgrades)
- Trials
- Work with trials
[Work with trials](/build/subscriptions/update-trials)
- Extend or activate a trial
[Extend or activate a trial](/build/subscriptions/extend-activate-change-date-trials)
- Customers
- Create or update a customer
[Create or update a customer](/build/customers/create-update-customers)
- Work with credit balances
[Work with credit balances](/build/customers/get-customer-credit-balances)
- Get customer portal links
[Get customer portal links](/build/customers/integrate-customer-portal)
- Reporting
- Generate reports
[Generate reports](/build/finance/generate-reports)
- Report types
- Developer tools
- Use sandbox accounts
[Use sandbox accounts](/build/tools/sandbox)
- Connect Paddle and AI
[Connect Paddle and AI](/build/tools/mcp)

# Build an overlay checkout

[Build an overlay checkout](/build/checkout/build-overlay-checkout#build-an-overlay-checkout)

Get a step-by-step overview of how to build a complete overlay checkout — including initializing Paddle.js, passing settings and items, prefilling customer information, and next steps.


The checkout is where customers make purchases. For SaaS businesses, it's the process where customers enter their details and payment information, and confirm that they'd like to sign up for a subscription with you.


You can usePaddle.jsto quickly add an overlay checkout into your app.Overlay checkoutlets you present customers with an overlay that handles all parts of the checkout process — minimal frontend coding required.

[Paddle.js](/paddlejs/overview)
[Overlay checkout](/concepts/sell/overlay-checkout)
[Explore the code for this tutorial and test right away using our overlay checkout pen.](https://codepen.io/heymcgovern/pen/wvZMmGq)

Explore the code for this tutorial and test right away using our overlay checkout pen.


## What are we building?

[What are we building?](/build/checkout/build-overlay-checkout#objectives)

In this tutorial, we'll launch a multi-page overlay checkout for two items in our product catalog, then we'll extend it by passing customer information.


We'll learn how to:

- Include and set up Paddle.js using a client-side token
- Pass items to overlay checkout usingPaddle.Checkout.open()or HTML data attributes
- Take a test payment
- Prefill customer information usingPaddle.Checkout.open()or HTML data attributes

If you like, you can copy-paste the sample code in your editor orview on CodePenand follow along.

[view on CodePen](https://codepen.io/heymcgovern/pen/wvZMmGq)

```html
12345678910111213141516171819201<!DOCTYPE html>
2<html lang="en" color-mode="user">
3<head>
4  <title>Overlay checkout demo</title>
5  <meta charset="utf-8">
6  <meta name="viewport" content="width=device-width, initial-scale=1">
7  <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
8  <style>
9    .page-container {
10      max-width: 900px;
11      margin: auto;
12      text-align: center;
13      margin-top: 2em;
14      padding-left: 1em;
15      padding-right: 1em;
16    }
17    .grid {
18      display: block;
19      margin-bottom: 1em;
20    }

```


## Before you begin

[Before you begin](/build/checkout/build-overlay-checkout#prerequisites)

### Choose a checkout implementation

[Choose a checkout implementation](/build/checkout/build-overlay-checkout#prerequisites-choose-implementation)

This tutorial walks through creating anoverlay checkout. You can also createinline checkouts, which lets you build Paddle Checkout right into your app or website.

[overlay checkout](/concepts/sell/overlay-checkout)
[inline checkouts](/concepts/sell/branded-integrated-inline-checkout)

We recommend building an overlay checkout if you're new to Paddle. Inline checkouts use the same JavaScript methods as overlay checkouts, so you can switch to an inline checkout later.


#### Overlay checkout

[Overlay checkout](/build/checkout/build-overlay-checkout#prerequisites-choose-implementation-overlay)

Integrate Paddle in just a few lines of code. Launches an overlay to capture payment.


#### Inline checkout

[Inline checkout](/build/checkout/build-overlay-checkout#prerequisites-choose-implementation-inline)

Get complete control of the checkout experience. Captures payment directly in your app.


To learn more about the differences between overlay and inline checkouts, seePaddle Checkout

[Paddle Checkout](/concepts/sell/self-serve-checkout)

### Create products and prices

[Create products and prices](/build/checkout/build-overlay-checkout#prerequisites-create-product-price)

Paddle Checkout works with products and prices to say what a customer is purchasing, so you'll need tocreate a product and at least one related priceto pass to your checkout.

[create a product and at least one related price](/build/checkout/build-branded-inline-checkout)

### Set your default payment link

[Set your default payment link](/build/checkout/build-overlay-checkout#prerequisites-default-payment-link)

You'll also need to:

- Set your default payment linkunderPaddle > Checkout > Checkout settings > Default payment link.
[Set your default payment link](/build/transactions/default-payment-link)
- Get your default payment link domain approved, if you're working with the live environment.
> We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go-live.


We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go-live.


## Overview

[Overview](/build/checkout/build-overlay-checkout##tutorial-steps)

Add an overlay checkout to your website or app in four steps:

1. Include and initialize Paddle.jsAdd Paddle.js to your app or website, so you can securely capture payment information and build subscription billing experiences.

Include and initialize Paddle.js

[Include and initialize Paddle.js](/build/checkout/build-overlay-checkout#include-paddle-js)

Add Paddle.js to your app or website, so you can securely capture payment information and build subscription billing experiences.

1. Add an overlay checkout buttonSet any element on your page as a launcher for Paddle Checkout.

Add an overlay checkout button

[Add an overlay checkout button](/build/checkout/build-overlay-checkout#add-checkout-launcher)

Set any element on your page as a launcher for Paddle Checkout.

1. Take a test paymentMake sure that your checkout loads successfully, then take a test payment.

Take a test payment

[Take a test payment](/build/checkout/build-overlay-checkout#test-payment)

Make sure that your checkout loads successfully, then take a test payment.

1. Prefill customer information— optionalExtend your checkout by prefilling customer and address information.

Prefill customer information— optional

[Prefill customer information— optional](/build/checkout/build-overlay-checkout#prefill-customer)

Extend your checkout by prefilling customer and address information.


## 1Include and initialize Paddle.js

[1Include and initialize Paddle.js](/build/checkout/build-overlay-checkout#include-paddle-js)

Paddle.jsis a lightweight JavaScript library that lets you build rich, integrated subscription billing experiences using Paddle. We can use Paddle.js to securely work with products and prices in our Paddle system, as well as opening checkouts and capturing payment information.

[Paddle.js](/paddlejs/overview)

### Include Paddle.js script

[Include Paddle.js script](/build/checkout/build-overlay-checkout#include-paddle-js-embed-script)

Start with a blank webpage, or an existing page on your website. Then,include Paddle.jsby adding this script to the<head>:

[include Paddle.js](/paddlejs/include-paddlejs)

```html
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
```


### Set environment (optional)

[Set environment (optional)](/build/checkout/build-overlay-checkout#include-paddle-js-environment)

We recommendsigning up for a sandbox accountto test and build your integration, then switching to a live account later when you're ready to go live.

[signing up for a sandbox account](https://sandbox-login.paddle.com/signup?utm_source=dx&utm_medium=dev-docs)

If you're testing with thesandbox, callPaddle.Environment.set()and set your environment tosandbox:

[sandbox](/build/tools/sandbox)
[Paddle.Environment.set()](/paddlejs/methods/paddle-environment-set)

```html
12341<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Environment.set("sandbox");
4</script>
```


### Pass a client-side token

[Pass a client-side token](/build/checkout/build-overlay-checkout#include-paddle-js-authenticate)

Next, go toPaddle > Developer tools > Authenticationand create a client-side token.Client-side tokenslet you interact with the Paddle platform in frontend code, like webpages or mobile apps. They have limited access to the data in your system, so they're safe to publish.

[Client-side tokens](/paddlejs/client-side-tokens)

In your page, callPaddle.Initialize()and pass your client-side token astoken. For best performance, do this just after callingPaddle.Environment.set(), like this:

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

```html
12345671<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Environment.set("sandbox");
4  Paddle.Initialize({ 
5    token: "test_7d279f61a3499fed520f7cd8c08" // replace with a client-side token
6  });
7</script>
```

> Client-side tokens are separate for yoursandbox and live accounts. You'll need tocreate a new client-side tokenfor your live account. Sandbox tokens start withtest_to make them easy to distinguish.


Client-side tokens are separate for yoursandbox and live accounts. You'll need tocreate a new client-side tokenfor your live account. Sandbox tokens start withtest_to make them easy to distinguish.

[sandbox and live accounts](/paddlejs/client-side-tokens#sandbox-vs-live-tokens)
[create a new client-side token](/paddlejs/client-side-tokens#create-client-side-token)

## 2Add an overlay checkout button

[2Add an overlay checkout button](/build/checkout/build-overlay-checkout#add-checkout-launcher)

Next, we'll set an element on our page as a launcher for our overlay checkout. Overlay checkout works by presenting an overlay to handle the entire checkout process. When our button or other launcher element is clicked, Paddle.js launches a checkout for us.


### Create checkout button element

[Create checkout button element](/build/checkout/build-overlay-checkout#add-checkout-launcher-create-button)

Any element can be a launcher for an overlay checkout. In our sample, we're using a link (<a>) that points to#. This means it doesn't open a new page.


```html
11<a href='#'>Sign up now</a>
```


### Set as a checkout launcher

[Set as a checkout launcher](/build/checkout/build-overlay-checkout#add-checkout-launcher-add-launcher)

Next, we'll make our checkout element open an overlay checkout by making it a launcher.


You can do this in two ways:


#### Paddle.Checkout.open() method

[Paddle.Checkout.open() method](/build/checkout/build-overlay-checkout#paddle.checkout.open()-method)
- Works using JavaScript to open a checkout when an element is clicked.
- You can pass items and settings as parameters toPaddle.Checkout.open().
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
- Recommended in most cases.
- No styles applied to your element.
- Best for passing multiple attributes.

#### HTML data attributes

[HTML data attributes](/build/checkout/build-overlay-checkout#html-data-attributes)
- Works by adding apaddle_buttonclass to an element, which Paddle.js turns into a checkout launcher.
- You can pass items and settings asdata attributesagainst the element.
[data attributes](/paddlejs/html-data-attributes)
- Recommended when you can't use JavaScript.
- Optionally styles your element to look like a button.
- Best for passing few attributes.

In general, we recommend using thePaddle.Checkout.open()method, but you can choose the option that makes the most sense for you.


Paddle.js comes with thePaddle.Checkout.open()method, which lets you open a checkout withsettings,items, andcustomerinformation.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[settings](/build/checkout/set-up-checkout-default-settings)
[items](/build/checkout/pass-update-checkout-items)
[customer](/build/checkout/prefill-checkout-properties)

In our sample, we've created a function calledopenCheckout()to open a checkout. Here's how it works:

1. We create a variable calleditemsListand pass an array of objects, where each object contains apriceIdandquantity.

We create a variable calleditemsListand pass an array of objects, where each object contains apriceIdandquantity.

1. We create a function calledopenCheckout()that takes a parameter calleditems.

We create a function calledopenCheckout()that takes a parameter calleditems.

1. In ouropenCheckout()function, we callPaddle.Checkout.open(), passing the value ofitemsas the items list for the checkout.

In ouropenCheckout()function, we callPaddle.Checkout.open(), passing the value ofitemsas the items list for the checkout.

1. We add anonclickevent to our checkout button to callopenCheckout()when clicked, passing ouritemsListvariable as a parameter.

We add anonclickevent to our checkout button to callopenCheckout()when clicked, passing ouritemsListvariable as a parameter.

> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


```html
12345678910111213141516171819201<script type="text/javascript">
2  Paddle.Environment.set("sandbox");
3  Paddle.Initialize({
4    token: "test_7d279f61a3499fed520f7cd8c08" // replace with a client-side token
5  });
6  
7  // define items
8  let itemsList = [
9    {
10      priceId: "pri_01gsz8ntc6z7npqqp6j4ys0w1w",
11      quantity: 5
12    },
13    {
14      priceId: "pri_01h1vjfevh5etwq3rb416a23h2",
15      quantity: 1
16    }
17  ];
18  
19  // open checkout
20  function openCheckout(items){

```


## 3Take a test payment

[3Take a test payment](/build/checkout/build-overlay-checkout#test-payment)

We're now ready to test. Save your page, then open it in your browser. Click on your "Sign up now" button and Paddle.js should open an overlay checkout for the items that we passed.


If you're using a sandbox account, you can take a test payment usingour test card details:

[our test card details](/concepts/payment-methods/credit-debit-card)

| Email address | An email address you own |
| Country | Any valid country supported by Paddle |
| ZIP code(if required) | Any valid ZIP or postal code |
| Card number | 4242 4242 4242 4242 |
| Name on card | Any name |
| Expiration date | Any valid date in the future. |
| Security code | 100 |


If the checkout doesn't appear, or you get a message saying "Something went wrong," you can open your browser console to see any specific error messages from Paddle.js to help you troubleshoot.

> Use⌘ Command+⌥ Option+J(Mac) orCtrl+⇧ Shift+J(Windows) to quickly open your browser console in Google Chrome.


Use⌘ Command+⌥ Option+J(Mac) orCtrl+⇧ Shift+J(Windows) to quickly open your browser console in Google Chrome.


#### Common problems

[Common problems](/build/checkout/build-overlay-checkout#test-payment-troubleshooting)

Check that:

- You added a default payment link to your checkout underPaddle > Checkout > Checkout settings > Default payment link, and that this matches the domain where you're testing. You can uselocalhostif you're testing locally on sandbox.
- You included Paddle.js correctly. If you're moving from Paddle Classic, the CDN URL has changed.
- Your client-side token is correct and passed toPaddle.Initialize().
- You set the correct environment.
- The Paddle IDs for price entities that you passed are correct. Sandbox and live systems are separate, so make sure you're passing price IDs for the environment that you're working in.
- If you're using HTML data attributes, you used single quotation marks around the value ofdata-items, and double quotation marks around the property names and string values inside it

## 4Prefill customer informationOptional

[4Prefill customer informationOptional](/build/checkout/build-overlay-checkout#prefill-customer)

At this point, we've passed items to our checkout. When we click our launcher, Paddle opens a checkout for the items that we passed.


Paddle.js also lets youpass customer information to a checkout. When we click our launcher, Paddle opens a checkout with the customer information prefilled. This means the first page of checkout is skipped entirely, so customers land on a screen where they can enter their payment information.

[pass customer information to a checkout](/build/checkout/prefill-checkout-properties)
> You can present customers with a one-page checkout experience by passingvariantwith the valueone-pageas a checkout setting. You don't need to prefill information.


You can present customers with a one-page checkout experience by passingvariantwith the valueone-pageas a checkout setting. You don't need to prefill information.

[as a checkout setting](/build/checkout/set-up-checkout-default-settings)

Paddle.Checkout.open()takes acustomerparameter, which lets you pass customer and address information.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

In our sample, we've extended ouropenCheckout()function so that it passes customer and address information to our checkout. Here's what's going on:

1. We create a variable calledcustomerInfo, with anemailkey and an object foraddress. You may also pass Paddle IDs for an existing customer or address here.

We create a variable calledcustomerInfo, with anemailkey and an object foraddress. You may also pass Paddle IDs for an existing customer or address here.

1. We update ouropenCheckout()function so it takes another parameter calledcustomer.

We update ouropenCheckout()function so it takes another parameter calledcustomer.

1. In ouropenCheckout()function, we added thecustomerparameter and passing the value ofcustomerto this.

In ouropenCheckout()function, we added thecustomerparameter and passing the value ofcustomerto this.

1. We updated theonClickevent on our checkout button to pass ourcustomerInfovariable as the parameter forcustomer.

We updated theonClickevent on our checkout button to pass ourcustomerInfovariable as the parameter forcustomer.


```html
12345678910111213141516171819201<script type="text/javascript">
2  Paddle.Environment.set("sandbox");
3  Paddle.Initialize({
4    token: "test_7d279f61a3499fed520f7cd8c08" // replace with a client-side token
5  });
6  
7  // define items
8  let itemsList = [
9    {
10      priceId: "pri_01gsz8ntc6z7npqqp6j4ys0w1w",
11      quantity: 5
12    },
13    {
14      priceId: "pri_01h1vjfevh5etwq3rb416a23h2",
15      quantity: 1
16    }
17  ];
18  
19  // define customer details
20  let customerInfo = {

```


### Test your work

[Test your work](/build/checkout/build-overlay-checkout#prefill-customer-test)

Save your page, then open it in your browser. Click on your "Sign up now" button and Paddle.js should open an overlay checkout with the customer information prefilled. You should land on the second screen, ready to enter payment information.


Where there's a problem passing optional information to a checkout, Paddle.js opens the checkout but emits acheckout.warningevent. This means customers are always able to complete a purchase provided you've initialized Paddle.js and passed items successfully.

[checkout.warning](/paddlejs/general/checkout-warning)

You can use theeventCallbackparameter forPaddle.Initialize()to work with events emitted by Paddle.js. To print events emitted by Paddle.js to the console, update yourPaddle.Initialize()function so it looks like this.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

```javascript
12345671Paddle.Initialize({
2  token: "test_7d279f61a3499fed520f7cd8c08", // replace with a client-side token
3  // prints events to console for debugging
4  eventCallback: function(data) {
5    console.log(data);
6  }
7});
```


Then, open your browser console and check for events with the namecheckout.warning. They should tell you what the problem is.

[checkout.warning](/paddlejs/general/checkout-warning)
> Use⌘ Command+⌥ Option+J(Mac) orCtrl+⇧ Shift+J(Windows) to quickly open your browser console in Google Chrome.


Use⌘ Command+⌥ Option+J(Mac) orCtrl+⇧ Shift+J(Windows) to quickly open your browser console in Google Chrome.


#### Common problems

[Common problems](/build/checkout/build-overlay-checkout#prefill-customer-troubleshooting)

Check that:

- The email address that you passed is formatted correctly. Email addresses must not include spaces or non-ASCII characters.
- If you passed an address country, you also passed a ZIP/postal code if the country requires it. Most countries don't require a ZIP/postal code, but it'srequired in some placesfor tax calculation and fraud prevention.
[required in some places](/concepts/sell/supported-countries-locales)
- The Paddle IDs for customer, address, or business entities that you passed are correct. Sandbox and live systems are separate, so make sure you're passing Paddle IDs for the environment that you're working in.

## Next steps

[Next steps](/build/checkout/build-overlay-checkout#next-steps)

That's it. Now you've built a checkout, you might like to extend Paddle Checkout by automatically applying a discount, passing optional checkout settings, or building a success workflow.


### Automatically apply a discount

[Automatically apply a discount](/build/checkout/build-overlay-checkout#next-steps-discount)

Extend your checkout by passing a discount. When we click our launcher, Paddle opens a checkout with the discount automatically applied (where it's valid).

[Read more](/build/checkout/prefill-checkout-properties)
[Read more](/build/products/offer-discounts-promotions-coupons)

### Pass checkout settings

[Pass checkout settings](/build/checkout/build-overlay-checkout#extend-checkout-other)

You don't need to pass checkout settings when working with overlay checkout, but you can use them to give you more control over how opened checkouts work. For example, you can set the language that Paddle Checkout uses, hide the option to add a discount, or restrict payment methods shown to customers.

[Read more](/build/checkout/set-up-checkout-default-settings)
[Read more](/paddlejs/methods/paddle-checkout-open)

### Build a success workflow

[Build a success workflow](/build/checkout/build-overlay-checkout#extend-checkout-success)

When customers complete checkout, Paddle Checkout has a final screen that lets customers know that their purchase was successful. If you like, you can redirect customers to your own page or use JavaScript event callbacks to build a more advanced success workflow.

[Read more](/build/checkout/handle-success-post-checkout)
[Read more](/paddlejs/events/overview)
- Build an overlay checkout
[Build an overlay checkout](#build-an-overlay-checkout)
- What are we building?
[What are we building?](#objectives)
- Before you begin
[Before you begin](#prerequisites)
- Choose a checkout implementation
[Choose a checkout implementation](#prerequisites-choose-implementation)
- Create products and prices
[Create products and prices](#prerequisites-create-product-price)
- Set your default payment link
[Set your default payment link](#prerequisites-default-payment-link)
- Overview
[Overview](##tutorial-steps)
- Include and initialize Paddle.js
[Include and initialize Paddle.js](#include-paddle-js)
- Include Paddle.js script
[Include Paddle.js script](#include-paddle-js-embed-script)
- Set environment (optional)
[Set environment (optional)](#include-paddle-js-environment)
- Pass a client-side token
[Pass a client-side token](#include-paddle-js-authenticate)
- Add an overlay checkout button
[Add an overlay checkout button](#add-checkout-launcher)
- Create checkout button element
[Create checkout button element](#add-checkout-launcher-create-button)
- Set as a checkout launcher
[Set as a checkout launcher](#add-checkout-launcher-add-launcher)
- Take a test payment
[Take a test payment](#test-payment)
- Prefill customer information
[Prefill customer information](#prefill-customer)
- Test your work
[Test your work](#prefill-customer-test)
- Next steps
[Next steps](#next-steps)
- Automatically apply a discount
[Automatically apply a discount](#next-steps-discount)
- Pass checkout settings
[Pass checkout settings](#extend-checkout-other)
- Build a success workflow
[Build a success workflow](#extend-checkout-success)

---

*Last scraped: 2025-12-15 20:18:17*
