# Build an inline checkout

**Source:** https://developer.paddle.com/build/checkout/build-branded-inline-checkout

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

# Build an inline checkout

[Build an inline checkout](/build/checkout/build-branded-inline-checkout#build-an-inline-checkout)

Get a step-by-step overview of how to build a complete inline checkout — including initializing Paddle.js, passing settings and items, updating on-page information, and next steps.


The checkout is where customers make purchases. For SaaS businesses, it's the process where customers enter their details and payment information, and confirm that they'd like to sign up for a subscription with you.


You can usePaddle.jsto integrate an inline checkout into your app.Inline checkoutlets you embed a checkout and display information about items and totals in your own interface, creating checkout experiences that are fully integrated with your app.

[Paddle.js](/paddlejs/overview)
[Inline checkout](/concepts/sell/branded-integrated-inline-checkout)
[Explore the code for this tutorial and test right away using our inline checkout pen.](https://codepen.io/heymcgovern/pen/yLrogZd)

Explore the code for this tutorial and test right away using our inline checkout pen.


## What are we building?

[What are we building?](/build/checkout/build-branded-inline-checkout#objectives)

In this tutorial, we'll build a page that embeds a multi-page inline checkout for three items in our product catalog. We'll display information about items and totals in a table on the page, add a way for customers to switch to annual plan during checkout, then we'll extend it by passing customer information.


We'll learn how to:

- Include and set up Paddle.js using a client-side token
- Pass settings to Paddle.js to embed an inline checkout in our page
- Pass items to inline checkout usingPaddle.Checkout.open()
- Display and update information about items and totals using checkout events
- Take a test payment
- Update items for an opened checkout usingPaddle.Checkout.updateCheckout()

If you like, you can copy-paste the sample code in your editor orview on CodePenand follow along.

[view on CodePen](https://codepen.io/heymcgovern/pen/yLrogZd)

```html
12345678910111213141516171819201<!DOCTYPE html>
2<html lang="en" color-mode="user">
3<head>
4  <title>Inline checkout demo</title>
5  <meta charset="utf-8">
6  <meta name="viewport" content="width=device-width, initial-scale=1">
7  <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
8  <style>
9    .page-container {
10      max-width: 1000px;
11      margin: 0 auto 2em auto;
12      padding-left: 1em;
13      padding-right: 1em;
14      text-align: center;
15    }
16    .grid {
17      display: block;
18    }
19    .grid > * {
20      padding: 1rem;

```


## Before you begin

[Before you begin](/build/checkout/build-branded-inline-checkout#prerequisites)

### Choose a checkout implementation

[Choose a checkout implementation](/build/checkout/build-branded-inline-checkout#prerequisites-choose-implementation)

This tutorial walks through creating aninline checkout. You can also createoverlay checkouts, which let you launch a checkout in just a few lines of code.

[inline checkout](/concepts/sell/branded-integrated-inline-checkout)
[overlay checkouts](/concepts/sell/overlay-checkout)

We recommendbuilding an overlay checkoutif you're new to Paddle. Inline checkouts use the same JavaScript methods as overlay checkouts, so you can switch to an inline checkout later.

[building an overlay checkout](/build/checkout/build-overlay-checkout)

#### Overlay checkout

[Overlay checkout](/build/checkout/build-branded-inline-checkout#prerequisites-choose-implementation-overlay)

Integrate Paddle in just a few lines of code. Launches an overlay to capture payment.


#### Inline checkout

[Inline checkout](/build/checkout/build-branded-inline-checkout#prerequisites-choose-implementation-inline)

Get complete control of the checkout experience. Captures payment directly in your app.


To learn more about the differences between overlay and inline checkouts, seePaddle Checkout

[Paddle Checkout](/concepts/sell/self-serve-checkout)

### Create products and prices

[Create products and prices](/build/checkout/build-branded-inline-checkout#prerequisites-create-product-price)

Paddle Checkout works with products and prices to say what a customer is purchasing, so you'll need tocreate a product and at least one related priceto pass to your checkout.

[create a product and at least one related price](/build/checkout/build-branded-inline-checkout)

### Set your default payment link

[Set your default payment link](/build/checkout/build-branded-inline-checkout#prerequisites-default-payment-link)

You'll also need to:

- Set your default payment linkunderPaddle > Checkout > Checkout settings > Default payment link.
[Set your default payment link](/build/transactions/default-payment-link)
- Get your default payment link domain approved, if you're working with the live environment.
> We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go-live.


We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go-live.


## Overview

[Overview](/build/checkout/build-branded-inline-checkout##tutorial-steps)

Add an inline checkout to your website or app in five steps:

1. Include and initialize Paddle.jsAdd Paddle.js to your app or website, so you can securely capture payment information and build subscription billing experiences.

Include and initialize Paddle.js

[Include and initialize Paddle.js](/build/checkout/build-branded-inline-checkout#include-paddle-js)

Add Paddle.js to your app or website, so you can securely capture payment information and build subscription billing experiences.

1. Embed and pass checkout settings and itemsPass settings to determine how your checkout opens and how it works, then pass items to say what your checkout is for.

Embed and pass checkout settings and items

[Embed and pass checkout settings and items](/build/checkout/build-branded-inline-checkout#embed-pass-settings)

Pass settings to determine how your checkout opens and how it works, then pass items to say what your checkout is for.

1. Show and update on-page informationInline checkout handles capturing payment securely. Display an items list and totals on your page, and update using event callbacks.

Show and update on-page information

[Show and update on-page information](/build/checkout/build-branded-inline-checkout#frontend-items)

Inline checkout handles capturing payment securely. Display an items list and totals on your page, and update using event callbacks.

1. Take a test paymentMake sure that your checkout loads successfully, then take a test payment.

Take a test payment

[Take a test payment](/build/checkout/build-branded-inline-checkout#test-payment)

Make sure that your checkout loads successfully, then take a test payment.

1. Update your checkout— optionalDynamically update items and other information for your opened checkout.

Update your checkout— optional

[Update your checkout— optional](/build/checkout/build-branded-inline-checkout#update-checkout)

Dynamically update items and other information for your opened checkout.


## 1Include and initialize Paddle.js

[1Include and initialize Paddle.js](/build/checkout/build-branded-inline-checkout#include-paddle-js)

Paddle.jsis a lightweight JavaScript library that lets you build rich, integrated subscription billing experiences using Paddle. We can use Paddle.js to securely work with products and prices in our Paddle system, as well as opening checkouts and capturing payment information.

[Paddle.js](/paddlejs/overview)

### Include Paddle.js script

[Include Paddle.js script](/build/checkout/build-branded-inline-checkout#include-paddle-js-embed-script)

Start with a blank webpage, or an existing page on your website. Then,include Paddle.jsby adding this script to the<head>:

[include Paddle.js](/paddlejs/include-paddlejs)

```html
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
```


### Set environment (optional)

[Set environment (optional)](/build/checkout/build-branded-inline-checkout#include-paddle-js-environment)

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

[Pass a client-side token](/build/checkout/build-branded-inline-checkout#include-paddle-js-authenticate)

Next, go toPaddle > Developer tools > Authenticationand create a client-side token.Client-side tokenslet you interact with the Paddle platform in frontend code, like webpages or mobile apps. They have limited access to the data in your system, so they're safe to publish.

[Client-side tokens](/paddlejs/client-side-tokens)

In your page, callPaddle.Initialize()and pass your client-side token astoken. For best performance, do this just after callingPaddle.Environment.set(), like this:

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

```html
12345671<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Environment.set("sandbox");
4  Paddle.Initialize({ 
5    token: "test_REDACTED_EXAMPLE_CLIENT_TOKEN" // replace with a client-side token
6  });
7</script>
```

> Client-side tokens are separate for yoursandbox and live accounts. You'll need tocreate a new client-side tokenfor your live account. Sandbox tokens start withtest_to make them easy to distinguish.


Client-side tokens are separate for yoursandbox and live accounts. You'll need tocreate a new client-side tokenfor your live account. Sandbox tokens start withtest_to make them easy to distinguish.

[sandbox and live accounts](/paddlejs/client-side-tokens#sandbox-vs-live-tokens)
[create a new client-side token](/paddlejs/client-side-tokens#create-client-side-token)

## 2Embed and pass checkout settings

[2Embed and pass checkout settings](/build/checkout/build-branded-inline-checkout#embed-pass-settings)

Next, we'll set an element on our page as a container for Paddle Checkout and set up Paddle.js for inline checkout.


Inline checkout works by embedding a frame that contains Paddle Checkout into your website or app. The Paddle Checkout frame handles securely capturing payment information, letting you display information about items and totals elsewhere on the page.


### Create checkout container

[Create checkout container](/build/checkout/build-branded-inline-checkout#embed-pass-settings-create-container)

Create an empty<div>for the Paddle Checkout frame and give it a uniqueclass, for examplecheckout-container:


```html
11<div class="checkout-container"></div>
```


### Pass settings

[Pass settings](/build/checkout/build-branded-inline-checkout#embed-pass-settings-settings)

Now, we'll pass the class of this empty<div>to tell Paddle.js where to embed the checkout frame. We'll alsopass checkout settingsto tell Paddle.js to load an inline checkout and say how our inline checkout should work.

[pass checkout settings](/build/checkout/set-up-checkout-default-settings)

You can do this in two ways:


#### Paddle.Initialize() method

[Paddle.Initialize() method](/build/checkout/build-branded-inline-checkout#paddle.initialize()-method)
- Pass settings toPaddle.Initialize()when initializing Paddle.js.
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
- Settings apply to all checkouts opened on this page.
- Recommended in most cases.

#### Paddle.Checkout.open() method

[Paddle.Checkout.open() method](/build/checkout/build-branded-inline-checkout#paddle.checkout.open()-method)
- Pass settings toPaddle.Checkout.open()when opening a checkout.
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
- Settings only apply to the opened checkout.
- Recommended where you have multiple checkouts on a page with different options.

If all the checkouts you use have the same settings, we recommend using thePaddle.Initialize()method. This means you don't need to pass the same settings for every checkout that you want to open.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

Update yourPaddle.Initialize()method call so that it includescheckout.settings. These settings are applied to all checkouts opened on this page.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

In our sample, we pass these settings tocheckout.settings:


| displayMode | Determines whether Paddle.js should open an inline or overlay checkout. | We set toinline. |
| frameTarget | Sets the element where Paddle Checkout should be loaded. | We passed ourcheckout-containerclass name. |
| frameInitialHeight | Sets the initial height of the dev element where Paddle Checkout is loaded. | We set this to450, which is our recommendation. |
| frameStyle | CSS properties to apply to the checkout container. | We passed some simple CSS styles here. |


```html
12345678910111213141<script type="text/javascript">
2  Paddle.Environment.set("sandbox");
3  Paddle.Initialize({ 
4    token: "test_REDACTED_EXAMPLE_CLIENT_TOKEN", // replace with a client-side token
5    checkout: {
6      settings: {
7        displayMode: "inline",
8        frameTarget: "checkout-container",
9        frameInitialHeight: "450",
10        frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;"
11      }
12    }
13  });
14</script>
```

> We've covered the required settings for an inline checkout, but you can also passlocale,theme, and other settings that control how Paddle Checkout works. For more information, seePass checkout settings


We've covered the required settings for an inline checkout, but you can also passlocale,theme, and other settings that control how Paddle Checkout works. For more information, seePass checkout settings

[Pass checkout settings](/build/checkout/set-up-checkout-default-settings)

### Pass items

[Pass items](/build/checkout/build-branded-inline-checkout#embed-pass-settings-pass-items)

Checkouts must be for one or more items. If we were to try to open a checkout so far, Paddle.js would throw an error.


To pass items, we can use thePaddle.Checkout.open()method.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

In our sample, we've created a function calledopenCheckout()to open a checkout. Here's how it works:

1. We create a variable calledmonthItemsListand pass an array of objects, where each object contains apriceIdandquantity. In our case, there are two prices that recur monthly and a single one-time price.

We create a variable calledmonthItemsListand pass an array of objects, where each object contains apriceIdandquantity. In our case, there are two prices that recur monthly and a single one-time price.

1. We create a function calledopenCheckout()that takes a parameter calleditems.

We create a function calledopenCheckout()that takes a parameter calleditems.

1. In ouropenCheckout()function, we callPaddle.Checkout.open(), passing the value ofitemsas the items list for the checkout.

In ouropenCheckout()function, we callPaddle.Checkout.open(), passing the value ofitemsas the items list for the checkout.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

If you already used thePaddle.Checkout.open()method in the previous step to passsettings, work this into your existingopenCheckout()function.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


```html
12345678910111213141516171819201<script type="text/javascript">
2  Paddle.Environment.set("sandbox");
3  Paddle.Initialize({
4    token: "test_REDACTED_EXAMPLE_CLIENT_TOKEN", // replace with a client-side token
5    checkout: {
6      settings: {
7        displayMode: "inline",
8        frameTarget: "checkout-container",
9        frameInitialHeight: "450",
10        frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;"
11      }
12    }
13  });
14  
15  // define items
16  let monthItemsList = [
17    {
18      priceId: 'pri_01gsz8x8sawmvhz1pv30nge1ke',
19      quantity: 10
20    },

```


### Set openCheckout() to run on page load

[Set openCheckout() to run on page load](/build/checkout/build-branded-inline-checkout#embed-pass-settings-update-page-on-load)

Right now, we've written a function to open a checkout, but we haven't set it to run.


We can addonLoadto our<body>tag to run ouropenCheckout()function immediately after the page has loaded, passing in ourmonthItemsListvariable as a parameter:


```html
11<body onLoad="openCheckout(monthItemsList)">
```


### Test your work

[Test your work](/build/checkout/build-branded-inline-checkout#embed-pass-settings-test)

Save your page, then open it in your browser. Paddle Checkout should load in place of the checkout container<div>element we created earlier.


You'll notice that the Paddle Checkout frame doesn't include any information about what the checkout is for. That's our next step.


## 3Show and update on-page information

[3Show and update on-page information](/build/checkout/build-branded-inline-checkout#frontend-items)

The inline checkout frame doesn't include a breakdown of items or totals. It's designed to handle capturing customer and payment information, giving you the flexibility to show items and totals in your frontend in a way that fits with our design.


To do this, we can use an event callback function.Paddle.js emits events throughout the checkout processwhen key things happen. An event callback function is some code that we run when a specific event occurs.

[Paddle.js emits events throughout the checkout process](/paddlejs/events/overview)

For example, when checkout is first loaded, Paddle.js emits acheckout.loadedevent that contains information about the items and totals on a checkout. We can build an event callback function to update our items and totals table with data contained in the event.

[checkout.loaded](/paddlejs/general/checkout-loaded)

It's important that customers know who they're buying from, what they're buying, and how much they're paying.


To build an inline checkout that's compliant and optimized for conversion, your implementation must include:

1. If recurring, how often it recurs and the total to pay on renewal. If a trial, how long the trial lasts.

If recurring, how often it recurs and the total to pay on renewal. If a trial, how long the trial lasts.

1. A description of what's being purchased.

A description of what's being purchased.

1. Transaction totals, including subtotal, total tax, and grand total. Be sure to include the currency too.

Transaction totals, including subtotal, total tax, and grand total. Be sure to include the currency too.

1. The full inline checkout frame, including the checkout footer that has information about Paddle, our terms of sale, and our privacy policy.

The full inline checkout frame, including the checkout footer that has information about Paddle, our terms of sale, and our privacy policy.

1. A link to your refund policy, if it differs from the Paddle.com standard refund policy.

A link to your refund policy, if it differs from the Paddle.com standard refund policy.


### Add tables to hold items and totals

[Add tables to hold items and totals](/build/checkout/build-branded-inline-checkout#frontend-items-add-tables)

First, we need to add some HTML for a couple of tables to hold items and totals information. You might use something more visual when building an app or website, but tables work for our tutorial.


Add this to the<body>of your page.


In this sample, there are two tables for our items and our totals:

- Our items table has a header row and a body row that's got some zero values in. We'll add a row for each item on our checkout later.
- Our totals table has a header column for the totals we'd like to show to our customer. There'sids set on the<td>elements that should contain totals. We'll use these IDs to replace the contents of these elements with totals later.

```html
12345678910111213141516171819201<div class="page-container">
2  <div class="grid">
3    <div class="checkout-container">
4    </div>
5    <div>
6      <h3>Items</h3>
7      <table class="items-table">
8        <thead>
9        <tr>
10          <th>Product name</th>
11          <th>Price name</th>
12          <th>Quantity</th>
13          <th>Total</th>
14        </tr>
15        </thead>
16        <tbody>
17        <tr>
18          <td></td>
19          <td></td>
20          <td>0</td>

```


### Update items table

[Update items table](/build/checkout/build-branded-inline-checkout#frontend-items-eventcallback-items)

Next, we'll build an event callback function to take data about our items from events and display it in our items table.


In our sample, we created a function calledupdateTable()that takes a parameter calledevent. Then, we pass the event payload to our function asevent. Here's how it works:

1. First, we exclude events that don't return anamefield and print the data payload of events to the console. This is useful for us to see which events are emitted and how they look while we're testing.

First, we exclude events that don't return anamefield and print the data payload of events to the console. This is useful for us to see which events are emitted and how they look while we're testing.

1. We create a variable calleditemsand set this toevent.data.itemsin our event payload. We'll use this variable to populate our items table.

We create a variable calleditemsand set this toevent.data.itemsin our event payload. We'll use this variable to populate our items table.

1. We call another function as part of this event callback function:updateItemsTable(), where we passitemsas a parameter.

We call another function as part of this event callback function:updateItemsTable(), where we passitemsas a parameter.

1. We create theupdateItemsTable()function that we called in our event callback, setting it up to accept a parameter calleditems. It finds and selects our items table body (.items-table tbody), clears out any rows, then iterates through each item in theitemsarray we passed.

We create theupdateItemsTable()function that we called in our event callback, setting it up to accept a parameter calleditems. It finds and selects our items table body (.items-table tbody), clears out any rows, then iterates through each item in theitemsarray we passed.

1. When iterating through each item, we call another function calledcreateTableRow(). We define this underneath, and it acceptsproductName,priceName,quantity, andtotal— a parameter for each of the columns in our items table.

When iterating through each item, we call another function calledcreateTableRow(). We define this underneath, and it acceptsproductName,priceName,quantity, andtotal— a parameter for each of the columns in our items table.

1. createTableRow()returns an HTML table row element with our product name, price name, quantity, and total. This newly created row is appended to our table body in ourupdateItemsTable()function.

createTableRow()returns an HTML table row element with our product name, price name, quantity, and total. This newly created row is appended to our table body in ourupdateItemsTable()function.

1. We update ourPaddle.Initialize()method, passingupdateTableas theeventCallback. This means this function is run every time an event is emitted by Paddle.js.

We update ourPaddle.Initialize()method, passingupdateTableas theeventCallback. This means this function is run every time an event is emitted by Paddle.js.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

```html
12345678910111213141516171819201<script type="text/javascript">
2  function updateTable(event) {
3    if (!event.name) {
4      return;
5    }
6    
7    console.log(event);
8    
9    let items = event.data.items;
10
11    updateItemsTable(items);
12  }
13
14  function updateItemsTable(items) {
15    const itemsTableBody = document.querySelector('.items-table tbody');
16    itemsTableBody.innerHTML = '';
17
18    items.forEach(item => {
19      const newRow = createTableRow(item.product.name, item.price_name, item.quantity, item.totals.subtotal);
20      itemsTableBody.appendChild(newRow);

```


### Update totals table

[Update totals table](/build/checkout/build-branded-inline-checkout#frontend-items-eventcallback-totals)

Let's update our event callback function so that it displays totals from our events in our totals table.


In our sample, we updated ourupdateTable()function so that it calls another function,updateSummaryTable(), to update our totals table. Here's how it works:

1. We create some additional variables calledtotalsandrecurringTotals, setting these to values in our event payload.

We create some additional variables calledtotalsandrecurringTotals, setting these to values in our event payload.

1. We add a call to another function as part of this event callback function:updateSummaryTable(), where we passtotalsandrecurringTotalsas parameters.

We add a call to another function as part of this event callback function:updateSummaryTable(), where we passtotalsandrecurringTotalsas parameters.

1. We create theupdateSummaryTable()function that we called in our event callback, setting it up to accept parameters calledtotalsandrecurringTotals.

We create theupdateSummaryTable()function that we called in our event callback, setting it up to accept parameters calledtotalsandrecurringTotals.

1. updateSummaryTable()gets cells in our totals table using the IDs that we gave them earlier, then replaces the contents with values from thetotalsandrecurringTotalsarrays that we passed in as parameters. We calculate the one-time total by subtracting the subtotal of recurring items from the subtotal.

updateSummaryTable()gets cells in our totals table using the IDs that we gave them earlier, then replaces the contents with values from thetotalsandrecurringTotalsarrays that we passed in as parameters. We calculate the one-time total by subtracting the subtotal of recurring items from the subtotal.

> For simplicity, we use the built-in.toFixed()JavaScript method to format values to two decimal places in our sample. Paddlesupports 30 currencies, some of which use a different number of decimal places. Consider using a currency library likecurrency.jsto format currencies correctly.


For simplicity, we use the built-in.toFixed()JavaScript method to format values to two decimal places in our sample. Paddlesupports 30 currencies, some of which use a different number of decimal places. Consider using a currency library likecurrency.jsto format currencies correctly.

[supports 30 currencies](/concepts/sell/supported-currencies)
[currency.js](https://currency.js.org/)

```html
293031323334353637383940414243444546474829    newRow.innerHTML = `
30      <td>${productName}</td>
31      <td>${priceName}</td>
32      <td>${quantity}</td>
33      <td>${total.toFixed(2)}</td>
34    `;
35    return newRow;
36  }
37
38  function updateSummaryTable(totals, recurringTotals) {
39    document.getElementById('oneTimeTotal').textContent = (totals.subtotal - recurringTotals.subtotal).toFixed(2);
40    document.getElementById('recurringTotal').textContent = recurringTotals.subtotal.toFixed(2);
41    document.getElementById('discountTotal').textContent = totals.discount.toFixed(2);
42    document.getElementById('taxTotal').textContent = totals.tax.toFixed(2);
43    document.getElementById('totalToday').textContent = totals.total.toFixed(2);
44  }
45    
46  Paddle.Environment.set("sandbox");
47  Paddle.Initialize({
48    token: "test_REDACTED_EXAMPLE_CLIENT_TOKEN", // replace with a client-side token

```


## 4Take a test payment

[4Take a test payment](/build/checkout/build-branded-inline-checkout#test-payment)

We're now ready to test. Save your page, then open it in your browser. Paddle.js should open an inline checkout for the items that we passed. You should see items and totals in the tables we created.


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

[Common problems](/build/checkout/build-branded-inline-checkout#test-payment-troubleshooting)

Check that:

- You added a default payment link to your checkout underPaddle > Checkout > Checkout settings > Default payment link, and that this matches the domain where you're testing. You can uselocalhostif you're testing locally on sandbox.
- You included Paddle.js correctly. If you're moving from Paddle Classic, the CDN URL has changed.
- Your client-side token is correct and passed toPaddle.Initialize().
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
- You set the correct environment.
- The Paddle IDs for price entities that you passed are correct. Sandbox and live systems are separate, so make sure you're passing price IDs for the environment that you're working in.
- Your event callback function doesn't have any problems.

## 5Update items on the checkoutOptional

[5Update items on the checkoutOptional](/build/checkout/build-branded-inline-checkout#update-checkout)

What if we want to update our checkout now it's opened? For example, we might want to let customers adjust the quantity of items or upsell them addons. Paddle.js includes thePaddle.Checkout.updateCheckout()method to let us dynamically update items, customer information, and discount on a checkout.

[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)

For this tutorial, we'll add a button that we can click to switch to annual plan. When customers click this button, we'll swap monthly items on the checkout for annual plan items.


### Define list of prices

[Define list of prices](/build/checkout/build-branded-inline-checkout#update-checkout-prices)

Paddle.Checkout.updateCheckout()has anitemsparameter. When we pass an items list, Paddle.js replaces the items on the checkout with the new items list we passed.

[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)

First, we'll define a new variable calledyearItemsList. LikemonthItemsList, we'll pass an array of objects, where each object contains apriceIdandquantity. In this case, there are two prices that recur yearly and a single one-time price.


Keep in mind that the entire items list is replaced — any omitted items are removed from the checkout entirely.

> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


```html
666768697071727374757677787980818283848566    {
67      priceId: 'pri_01gsz95g2zrkagg294kpstx54r',
68      quantity: 1
69    },
70    {
71      priceId: 'pri_01gsz98e27ak2tyhexptwc58yk',
72      quantity: 1
73    }
74  ];
75  let yearItemsList = [
76    {
77      priceId: 'pri_01gsz8z1q1n00f12qt82y31smh',
78      quantity: 10
79    },
80    {
81      priceId: 'pri_01gsz96z29d88jrmsf2ztbfgjg',
82      quantity: 1
83    },
84    {
85      priceId: 'pri_01gsz98e27ak2tyhexptwc58yk',

```


### Update items

[Update items](/build/checkout/build-branded-inline-checkout#update-checkout-update-items)

Next, we'll build a function to replace items on our checkout


In our sample, we created a function calledswitchPlan(). Here's how it works:

1. We create a variable calledisMonthlyand set it totrue. This variable tracks whether the current plan is monthly or yearly, and it's set totrueinitially because we passmonthItemsListto our checkout when the page loads.

We create a variable calledisMonthlyand set it totrue. This variable tracks whether the current plan is monthly or yearly, and it's set totrueinitially because we passmonthItemsListto our checkout when the page loads.

1. We create a function calledswitchPlan(), then set a variable calledupdatedItemsto ouryearItemListarray ifisMonthlyistrue, andmonthItemListifisMonthlyisfalse.

We create a function calledswitchPlan(), then set a variable calledupdatedItemsto ouryearItemListarray ifisMonthlyistrue, andmonthItemListifisMonthlyisfalse.

1. We call thePaddle.Checkout.updateCheckout()method, passingupdatedItemsas theitemsparameter. This is our yearly items list when the plan is monthly, and our monthly items list when the plan is yearly.

We call thePaddle.Checkout.updateCheckout()method, passingupdatedItemsas theitemsparameter. This is our yearly items list when the plan is monthly, and our monthly items list when the plan is yearly.

[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)
1. We toggle the value ofisMonthly. If it weretrue, it's set tofalse; if it werefalse, it's set totrue. This means that next timeswitchPlan()is called, it'll switch plans correctly.

We toggle the value ofisMonthly. If it weretrue, it's set tofalse; if it werefalse, it's set totrue. This means that next timeswitchPlan()is called, it'll switch plans correctly.


```html
88899091929394959697989910010110210310410510610788  ];
89  
90  // open checkout
91  function openCheckout(items){
92    Paddle.Checkout.open({
93      items: items
94    });
95  }
96  
97  // switch plan
98  let isMonthly = true;
99
100  function switchPlan() {
101    let updatedItems = isMonthly ? yearItemsList : monthItemsList;
102    Paddle.Checkout.updateCheckout({
103      items: updatedItems
104    });
105    isMonthly = !isMonthly;
106  }
107</script>
```


### Add a button to swap plan

[Add a button to swap plan](/build/checkout/build-branded-inline-checkout#update-checkout-add-button)

Finally, add a button to our HTML to call ourswitchPlan()function.


```html
11<a href="#" onclick="switchPlan()"><b>Switch plan</b></a>
```


### Test your work

[Test your work](/build/checkout/build-branded-inline-checkout#update-checkout-test)

Save your page, then open it in your browser. Paddle Checkout should load as before. When you click the switch plan button, Paddle.js swaps items on your checkout from monthly to annual, and vice versa.


## Next steps

[Next steps](/build/checkout/build-branded-inline-checkout#next-steps)

That's it. Now you've built a checkout, you might like to extend Paddle Checkout by presenting other fields to your checkout, automatically applying a discount, passing optional checkout settings, or building a success workflow.


### Add other fields to your checkout

[Add other fields to your checkout](/build/checkout/build-branded-inline-checkout#next-steps-events)

Events emitted by Paddle.js contain information about the items and totals on a checkout. We present fields indata.items[],data.product,data.totals, anddata.recurring_totalsin our sample.


You might like to include other data from the event on your page.


Here are some fields in Paddle.js events that you might like to use on your page:


| data.items[].product.name | Product name for itemized breakdowns. |
| data.items[].price_name | Price name. Typically describes how often this item bills. |
| data.items[].trial_period | Details about the trial period for an item, if any. |
| data.items[].billing_cycle | How often an item is billed, if recurring. |
| data.items[].totals.subtotal | Total for an item, excluding tax and discount. |
| data.totals.total | Grand total for a transaction, including tax and discount. |
| data.recurring_totals.total | Recurring total for a transaction, including tax and discount. |
| (data.totals.total-data.recurring_totals.total) | Where transactions contain a mix of one-time charges and recurring items, subtract a value indata.recurring_totalsfrom the corresponding value indata.totalsto calculate one-time charge totals. |

> For compliance and the best customer experience, inline checkout implementations must include a description of what's being purchased, transaction totals, billing frequency (if recurring), and information about any trial periods (if applicable).


For compliance and the best customer experience, inline checkout implementations must include a description of what's being purchased, transaction totals, billing frequency (if recurring), and information about any trial periods (if applicable).


For a full list of fields, seePaddle.js events

[Paddle.js events](/paddlejs/events/overview)

### Automatically apply a discount

[Automatically apply a discount](/build/checkout/build-branded-inline-checkout#next-steps-discount)

Extend your checkout by passing a discount. When our checkout is launched, Paddle automatically applies the discount (where it's valid).

[Read more](/build/checkout/prefill-checkout-properties)
[Read more](/build/products/offer-discounts-promotions-coupons)

### Pass checkout settings

[Pass checkout settings](/build/checkout/build-branded-inline-checkout#extend-checkout-other)

We covered passing the required settings for inline checkout, but there are a bunch of other settings you can pass that give you more control over how opened checkouts work. For example, you can set the language that Paddle Checkout uses, hide the option to add a discount, or restrict payment methods shown to customers.

[Read more](/build/checkout/set-up-checkout-default-settings)
[Read more](/paddlejs/methods/paddle-checkout-open)

### Build a success workflow

[Build a success workflow](/build/checkout/build-branded-inline-checkout#extend-checkout-success)

When customers complete checkout, Paddle Checkout has a final screen that lets customers know that their purchase was successful. If you like, you can redirect customers to your own page or use JavaScript event callbacks to build a more advanced success workflow.

[Read more](/build/checkout/handle-success-post-checkout)
[Read more](/paddlejs/events/overview)
- Build an inline checkout
[Build an inline checkout](#build-an-inline-checkout)
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
- Embed and pass checkout settings
[Embed and pass checkout settings](#embed-pass-settings)
- Create checkout container
[Create checkout container](#embed-pass-settings-create-container)
- Pass settings
[Pass settings](#embed-pass-settings-settings)
- Pass items
[Pass items](#embed-pass-settings-pass-items)
- Set openCheckout() to run on page load
[Set openCheckout() to run on page load](#embed-pass-settings-update-page-on-load)
- Test your work
[Test your work](#embed-pass-settings-test)
- Show and update on-page information
[Show and update on-page information](#frontend-items)
- Add tables to hold items and totals
[Add tables to hold items and totals](#frontend-items-add-tables)
- Update items table
[Update items table](#frontend-items-eventcallback-items)
- Update totals table
[Update totals table](#frontend-items-eventcallback-totals)
- Take a test payment
[Take a test payment](#test-payment)
- Update items on the checkout
[Update items on the checkout](#update-checkout)
- Define list of prices
[Define list of prices](#update-checkout-prices)
- Update items
[Update items](#update-checkout-update-items)
- Add a button to swap plan
[Add a button to swap plan](#update-checkout-add-button)
- Test your work
[Test your work](#update-checkout-test)
- Next steps
[Next steps](#next-steps)
- Add other fields to your checkout
[Add other fields to your checkout](#next-steps-events)
- Automatically apply a discount
[Automatically apply a discount](#next-steps-discount)
- Pass checkout settings
[Pass checkout settings](#extend-checkout-other)
- Build a success workflow
[Build a success workflow](#extend-checkout-success)

---

*Last scraped: 2025-12-15 20:19:13*
