# Build a pricing page

**Source:** https://developer.paddle.com/build/checkout/build-pricing-page

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

# Build a pricing page

[Build a pricing page](/build/checkout/build-pricing-page#build-a-pricing-page)

Get a step-by-step overview of how to build a pricing page that displays localized prices, including taxes and discount calculation. Open a checkout when a prospect wants to sign up.


Pricing pages show prospects the subscription plans, addons, or one-time charges that you offer and how much they cost. They're one of the most important pages on your website, and typicallyplay a key part in customer conversion.

[play a key part in customer conversion](https://www.paddle.com/resources/pricing-page-examples)

You can usePaddle.jsto build pricing pages that show prospects prices that arerelevant for their country, displayed in their local currency with estimated taxes. If you're running a sale or promo, you can calculate discounts too.

[Paddle.js](/paddlejs/overview)
[relevant for their country](/build/products/offer-localized-pricing)
[Explore the code for this tutorial and test right away using our pricing page pen.](https://codepen.io/heymcgovern/pen/VwgvgNb)

Explore the code for this tutorial and test right away using our pricing page pen.


## How it works

[How it works](/build/checkout/build-pricing-page#background)

Paddle Checkoutautomatically shows the correct prices for a customer using geolocation to estimate where a customer is buying from. Customers see prices in their local currency, with taxes estimated for their country or region.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

You can use thePaddle.PricePreview()method in Paddle.js to get localized prices for pricing pages or other pages on your website. This means you can show the same information on your pricing page that a customer sees when they open checkout to subscribe.

[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)

You don't need to do any calculations yourself or manipulate returned data. Paddle returns totals formatted for the country or region you're working with, including the currency symbol.


## What are we building?

[What are we building?](/build/checkout/build-pricing-page#objectives)

In this tutorial, we'll create a simple, three-tier pricing page. It includes a toggle to switch between monthly and annual plans.


We'll learn how to:

- Include and set up Paddle.js using a client-side token
- Build an items list that we can send toPaddle.PricePreview()
- Present and update prices on our page
- Toggle between monthly and annual prices for products

If you like, you can copy-paste the sample code into your editor orview on CodePenand follow along.

[view on CodePen](https://codepen.io/heymcgovern/pen/VwgvgNb)

```html
12345678910111213141516171819201<!DOCTYPE html>
2<html lang="en" color-mode="user">
3<head>
4  <title>Pricing page demo</title>
5  <meta charset="utf-8"/>
6  <meta name="viewport" content="width=device-width, initial-scale=1">
7  <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
8  <style>
9    .pricing-page-container {
10      max-width: 900px;
11      margin: auto;
12      text-align: center;
13      margin-top: 2em;
14      padding-left: 1em;
15      padding-right: 1em;
16    }
17    .pricing-grid {
18      display: block;
19      margin-bottom: 1em;
20    }

```


## Before you begin

[Before you begin](/build/checkout/build-pricing-page#prerequisites)

### Choose a pricing page

[Choose a pricing page](/build/checkout/build-pricing-page#prerequisites-choose-implementation)

This tutorial walks through creating a simple pricing page. You can also create a cart-style pricing page for more advanced implementations using transaction previews.


#### Simple pricing page

[Simple pricing page](/build/checkout/build-pricing-page#simple-pricing-page)

Pass a batch of price IDs and location information to Paddle.js. Paddle returns localized pricing for each item.

- Recommended for most pricing pages.Simply returns localized prices.
- UsesPaddle.PricePreview().
[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)
- Requests and responses mirror thepreview prices operation.
[preview prices operation](/api-reference/pricing-preview/preview-prices)
- Returns item totals formatted for the currency and region, including currency code.
- Response only includes calculations for each item included in the request.
- You can send prices with different billing periods and trial periods.

#### Cart-style pricing page

[Cart-style pricing page](/build/checkout/build-pricing-page#cart-style-pricing-page)

Send a batch of price IDs and location information to Paddle.js. Paddle returns a preview of a transaction.

- Recommended for more advanced pricing pages where users can build their own plans.
- UsesPaddle.TransactionPreview().
[Paddle.TransactionPreview()](/paddlejs/methods/paddle-transactionpreview)
- Requests and responses mirror thepreview a transaction operation.
[preview a transaction operation](/api-reference/transactions/preview-transaction)
- Returns item totals in the lowest denomination for a currency (for example, cents forUSD).
- Response includes calculations for line items and grand totals.
- Requests mirror creating a transaction, so billing and trial periods must match for all items.

### Create products and prices

[Create products and prices](/build/checkout/build-pricing-page#prerequisites-create-product-price)

You'll need tocreate a product and at least one related pricefor the items that you want to include on your pricing page.

[create a product and at least one related price](/build/products/create-products-prices)

### Localize prices

[Localize prices](/build/checkout/build-pricing-page#prerequisites-localize-prices)

To show localized prices,turn on automatic currency conversion or add price overridesto your prices.

[turn on automatic currency conversion or add price overrides](/build/products/offer-localized-pricing)

## Overview

[Overview](/build/checkout/build-pricing-page#tutorial-steps)

To build a pricing page:

1. Include and initialize Paddle.jsAdd Paddle.js to your app or website, so you can securely work with your product catalog.

Include and initialize Paddle.js

[Include and initialize Paddle.js](/build/checkout/build-pricing-page#include-paddle-js)

Add Paddle.js to your app or website, so you can securely work with your product catalog.

1. Pass prices to Paddle.jsBuild a pricing preview request body and pass toPaddle.PricePreview().

Pass prices to Paddle.js

[Pass prices to Paddle.js](/build/checkout/build-pricing-page#pricing-preview)

Build a pricing preview request body and pass toPaddle.PricePreview().

1. Update your page based on the responsePresent information returned by Paddle.js to a customer on your page.

Update your page based on the response

[Update your page based on the response](/build/checkout/build-pricing-page#update-page)

Present information returned by Paddle.js to a customer on your page.


## 1Include and initialize Paddle.js

[1Include and initialize Paddle.js](/build/checkout/build-pricing-page#include-paddle-js)

Paddle.jsis a lightweight JavaScript library that lets you build rich, integrated subscription billing experiences using Paddle. We can use Paddle.js to securely work with products and prices in our Paddle system, as well as opening checkouts and capturing payment information.

[Paddle.js](/paddlejs/overview)

### Include Paddle.js script

[Include Paddle.js script](/build/checkout/build-pricing-page#include-paddle-js-embed-script)

Start with a blank webpage, or an existing page on your website. Then,include Paddle.jsby adding this script to the<head>:

[include Paddle.js](/paddlejs/include-paddlejs)

```html
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
```


### Set environment (optional)

[Set environment (optional)](/build/checkout/build-pricing-page#include-paddle-js-environment)

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

[Pass a client-side token](/build/checkout/build-pricing-page#include-paddle-js-authenticate)

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

## 2Pass prices to Paddle.js

[2Pass prices to Paddle.js](/build/checkout/build-pricing-page#pricing-preview)

Next, we'll pass prices to Paddle.js so that we can get localized prices for them. When previewing prices, Paddle returns calculated totals for line items only — it doesn't include grand totals. This means that we can include prices with different billing cycles and trial periods in our request, unlike whenopening a checkoutorcreating a transaction.

[opening a checkout](/build/checkout/pass-update-checkout-items)
[creating a transaction](/build/transactions/create-transaction)

### Define lists of prices

[Define lists of prices](/build/checkout/build-pricing-page#pricing-preview-price-lists)

Our page includes four prices:


Starter

- Starter (monthly)
- Starter (yearly)

Pro

- Pro (monthly)
- Pro (yearly)

In Paddle, we've set these up as two products called 'Starter' and 'Pro,' each with two prices for monthly and annual.


This is an example from thelist products operationin the Paddle API. It shows the two products we're using, including an array of prices for each.

[list products operation](/api-reference/products/list-products)

```json
12345678910111213141516171819201{
2  "data": [
3    {
4      "id": "pro_01gsz4t5hdjse780zja8vvr7jg",
5      "name": "ChatApp Pro",
6      "tax_category": "standard",
7      "description": "Everything in starter, plus access to a suite of powerful tools and features designed to take your team's productivity to the next level.",
8      "image_url": "https://paddle-sandbox.s3.amazonaws.com/user/10889/2nmP8MQSret0aWeDemRw_icon1.png",
9      "custom_data": null,
10      "status": "active",
11      "created_at": "2023-02-23T12:43:46.605Z",
12      "prices": [
13        {
14          "id": "pri_01gsz8z1q1n00f12qt82y31smh",
15          "product_id": "pro_01gsz4t5hdjse780zja8vvr7jg",
16          "description": "Annual (per seat)",
17          "name": null,
18          "billing_cycle": {
19            "interval": "year",
20            "frequency": 1

```


To define these, create variables for the products in your script section and set them to the Paddle IDs for the products. We'll use these later to determine which products returned prices are for.


Then, create arrays for your prices. Each array should contain an object that includes the Paddle ID for a price (priceId) and aquantity. We've created two arrays:

- monthItems, which contains monthly prices for our products.
- yearItems, which contains yearly prices for our products.

We'll present localized prices formonthItemswhen the monthly toggle is selected, andyearItemswhen the yearly toggle is selected.


```html
12345678910111213141516171819201<script type="text/javascript">
2  Paddle.Environment.set("sandbox");
3  Paddle.Initialize({ 
4    token: 'test_REDACTED_EXAMPLE_CLIENT_TOKEN' // replace with a client-side token
5  });
6  
7  // define products and prices
8  var starterProduct = 'pro_01gsz4s0w61y0pp88528f1wvvb';
9  var proProduct = 'pro_01gsz4t5hdjse780zja8vvr7jg';
10  var monthItems = [{
11      quantity: 1,
12      priceId: 'pri_01gsz8ntc6z7npqqp6j4ys0w1w',
13    },
14    {
15      quantity: 1,
16      priceId: 'pri_01gsz8x8sawmvhz1pv30nge1ke',
17    }
18  ];
19  var yearItems = [{
20      quantity: 1,

```


### Get prices

[Get prices](/build/checkout/build-pricing-page#pricing-preview-get-prices)

Next, we'll create a function to get prices. This should pass our list of monthly or yearly items to Paddle.js.


In our sample, we've created a function calledgetPrices()that takes a parameter calledcycle. Here's how it works:

1. We create a variable calledbillingCycleand set this toyear. This is the billing cycle that we'd like to show when customers first visit our page.

We create a variable calledbillingCycleand set this toyear. This is the billing cycle that we'd like to show when customers first visit our page.

1. We check to see ifcycleismonth, then set a variable calleditemsListto eithermonthItemsoryearItems. We also set a variable calledbillingCycleto the value ofcyclefor later.

We check to see ifcycleismonth, then set a variable calleditemsListto eithermonthItemsoryearItems. We also set a variable calledbillingCycleto the value ofcyclefor later.

1. We define a variable calledrequest. This is what we're going to send to Paddle.js. It includes an object with anitemskey. The format of our request should match the request body for the pricing preview operation in the Paddle API, except withcamelCasenames for fields.

We define a variable calledrequest. This is what we're going to send to Paddle.js. It includes an object with anitemskey. The format of our request should match the request body for the pricing preview operation in the Paddle API, except withcamelCasenames for fields.

1. We callPaddle.PricePreview(), passing inrequestas a parameter.

We callPaddle.PricePreview(), passing inrequestas a parameter.

1. Paddle.PricePreview()returns a promise that contains a pricing preview object. We use the.then()method to attach a callback that logs the resolved value to the console, and the.catch()method to log errors to the console.

Paddle.PricePreview()returns a promise that contains a pricing preview object. We use the.then()method to attach a callback that logs the resolved value to the console, and the.catch()method to log errors to the console.


```html
202122232425262728293031323334353637383920      quantity: 1,
21      priceId: 'pri_01gsz8s48pyr4mbhvv2xfggesg',
22    },
23    {
24      quantity: 1,
25      priceId: 'pri_01gsz8z1q1n00f12qt82y31smh',
26    }
27  ];
28  
29  // set initial billing cycle
30  var billingCycle = 'year'
31  
32  // get prices
33  function getPrices(cycle) {
34    var itemsList = cycle === "month" ? monthItems : yearItems;  
35    var billingCycle = cycle;
36    var request = {
37      items: itemsList
38    }
39    

```


### Test your work

[Test your work](/build/checkout/build-pricing-page#pricing-preview-test)

Save your page, thenopen your browser consoleand typegetPrices('year')orgetPrices('month'). You should see a promise that contains a pricing preview object from Paddle returned the console.

[open your browser console](https://developer.chrome.com/docs/devtools/console/)
> Use⌘ Command+⌥ Option+J(Mac) orCtrl+⇧ Shift+J(Windows) to quickly open your browser console in Google Chrome.


Use⌘ Command+⌥ Option+J(Mac) orCtrl+⇧ Shift+J(Windows) to quickly open your browser console in Google Chrome.


## 3Update page

[3Update page](/build/checkout/build-pricing-page#update-page)

Our function doesn't do anything to our page yet. We'll updategetPrices()so that it displays pricing information returned by Paddle.js on our page.


### Create HTML for pricing table

[Create HTML for pricing table](/build/checkout/build-pricing-page#update-page-html)

First, we need to add some HTML for a simple pricing table with options for monthly and yearly. We'll add some CSS to the<head>of the page, too.


Add this to the<body>of your page.


In this sample, there are radio buttons for our pricing toggle, then a<div>with three<div>elements for each product that we offer. The radio buttons have anonclickattribute that runs ourgetPrices()function when clicked, passing eithermonthoryearas the parameter forcycle.


It setsids<p>elements that contain prices. We'll use these IDs to replace the contents of these elements with returned prices from Paddle.js later.


```html
12345678910111213141516171819201<div class="pricing-page-container">
2  <h1>Choose your plan</h1>
3  <div class="pricing-toggle">
4    <input type="radio" name="plan" value="month" id="month" onclick="getPrices('month')"><label for="month">Monthly</label>
5    <input type="radio" name="plan" value="year" id="year" onclick="getPrices('year')" checked><label for="year">Yearly  <sup>save 20%</sup></label>
6  </div>
7  <div class="pricing-grid">
8    <div class="starter-plan">
9      <h3>Starter</h3>
10      <p id="starter-price">$100.00</p>
11      <p><small>per user</small></p>
12      <button>Sign up now</button>
13    </div>
14    <div class="pro-plan">
15      <h3>Pro</h3>
16      <p id="pro-price">$300.00</p>
17      <p><small>per user</small></p>
18      <button>Sign up now</button>
19    </div>
20    <div class="enterprise-plan">

```


### Update elements using JavaScript

[Update elements using JavaScript](/build/checkout/build-pricing-page#update-page-elements)

Next, we'll change our script to update thestarter-priceandpro-priceelements so they return pricing from Paddle.


First, we'll get elements in our pricing table using theiridand assign them to variables that we can use later.


Then, we'll update ourgetPrices()function to iterate throughresult.data.details.lineItems. This array contains calculated totals for the prices that we passed to Paddle.js.


To make sure we show the correct prices for our products, we check to see if the Paddle ID of the related product of a price matches the product IDs we defined earlier:

- If the product for a returned price isstarterProduct, we replace the contents of thestarter-priceelement withitem.formattedTotals.subtotal
- If the product for a returned price isproProduct, we replace the contents of thepro-priceelement withitem.formattedTotals.subtotal.

For this sample, we also logitem.formattedTotals.subtotalto console. This can be useful for debugging.


```html
202122232425262728293031323334353637383920      quantity: 1,
21      priceId: 'pri_01gsz8s48pyr4mbhvv2xfggesg',
22    },
23    {
24      quantity: 1,
25      priceId: 'pri_01gsz8z1q1n00f12qt82y31smh',
26    }
27  ];
28  
29  // DOM queries
30  var starterPriceLabel = document.getElementById("starter-price");
31  var proPriceLabel = document.getElementById("pro-price");
32  
33  // set initial billing cycle
34  var billingCycle = 'year'
35  
36  // get prices
37  function getPrices(cycle) {
38    var itemsList = cycle === "month" ? monthItems : yearItems;  
39    var billingCycle = cycle;

```


### Set getPrices() to run on page load

[Set getPrices() to run on page load](/build/checkout/build-pricing-page#update-page-on-load)

Right now, our function only runs when the monthly or annual radio buttons are clicked.


We can addonLoadto our<body>tag to run ourgetPrices()function immediately after the page has loaded:


```html
11<body onLoad="getPrices(billingCycle)">
```


### Test your work

[Test your work](/build/checkout/build-pricing-page#update-page-test)

Save your page, then open it in your browser. You should see prices from Paddle.js in your pricing table. Selecting the monthly or annual toggle should change the prices that you see.

> Paddle.js automatically detects visitor location using their IP address and returns localized prices. To see localization in action, see theget starteddemo. We don't recommend including a country selector in real implementations.


Paddle.js automatically detects visitor location using their IP address and returns localized prices. To see localization in action, see theget starteddemo. We don't recommend including a country selector in real implementations.

[get started](/build/onboarding/overview)

## Next steps

[Next steps](/build/checkout/build-pricing-page#next-steps)

That's it. Now we've built a simple pricing page, you might like to add other fields to your page, pass a discount, or open a checkout.


### Add other fields to your pricing page

[Add other fields to your pricing page](/build/checkout/build-pricing-page#next-steps-request)

Paddle.PricePreview()returns a pricing preview object for the prices and location passed. We showdetails.lineItems.formattedTotals.subtotalin our sample. This is the calculated total for an item before estimated taxes and discounts, formatted for a particular currency.

[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)

You might like to use another value for the price you show on your page, or include other values.


Here are some fields in the response that you might like to use on your page:


| details.address.countryCode | Country code for the pricing preview. If you sent an IP address, Paddle returns the detected country. |
| details.line_items[].formattedTotals | Totals for a particular line item, formatted as a string for the currency you're working with. |
| details.line_items[].formattedUnitTotals | Totals for one unit of a particular line item, formatted as a string for the currency you're working with. |
| details.line_items[].price.trialPeriod | Details of the trial period for a price. |
| details.line_items[].discounts[].formattedTotal | Total amount discounted for a discount applied to a line item, formatted as a string for the currency you're working with. |


For a full list of values, seePricing preview object

[Pricing preview object](/api-reference/pricing-preview/overview)
[Read more](/api-reference/pricing-preview/preview-prices)
[Read more](/paddlejs/methods/paddle-pricepreview)

### Pass a discount

[Pass a discount](/build/checkout/build-pricing-page#next-steps-discount)

Extend your pricing page by passingdiscountIdin your request toPaddle.PricePreview(). The response includes adiscountarray that has information about the discount applied. Calculated totals indetails.lineItemsinclude discounts, where applicable.

[Read more](/api-reference/discounts/overview)
[Read more](/build/products/offer-discounts-promotions-coupons)

### Open a checkout

[Open a checkout](/build/checkout/build-pricing-page#next-steps-open-checkout)

Pass items toPaddle.Checkout.open()or useHTML data attributesto open a checkout.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[HTML data attributes](/paddlejs/html-data-attributes)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/build/checkout/build-overlay-checkout)
- Build a pricing page
[Build a pricing page](#build-a-pricing-page)
- How it works
[How it works](#background)
- What are we building?
[What are we building?](#objectives)
- Before you begin
[Before you begin](#prerequisites)
- Choose a pricing page
[Choose a pricing page](#prerequisites-choose-implementation)
- Create products and prices
[Create products and prices](#prerequisites-create-product-price)
- Localize prices
[Localize prices](#prerequisites-localize-prices)
- Overview
[Overview](#tutorial-steps)
- Include and initialize Paddle.js
[Include and initialize Paddle.js](#include-paddle-js)
- Include Paddle.js script
[Include Paddle.js script](#include-paddle-js-embed-script)
- Set environment (optional)
[Set environment (optional)](#include-paddle-js-environment)
- Pass a client-side token
[Pass a client-side token](#include-paddle-js-authenticate)
- Pass prices to Paddle.js
[Pass prices to Paddle.js](#pricing-preview)
- Define lists of prices
[Define lists of prices](#pricing-preview-price-lists)
- Get prices
[Get prices](#pricing-preview-get-prices)
- Test your work
[Test your work](#pricing-preview-test)
- Update page
[Update page](#update-page)
- Create HTML for pricing table
[Create HTML for pricing table](#update-page-html)
- Update elements using JavaScript
[Update elements using JavaScript](#update-page-elements)
- Set getPrices() to run on page load
[Set getPrices() to run on page load](#update-page-on-load)
- Test your work
[Test your work](#update-page-test)
- Next steps
[Next steps](#next-steps)
- Add other fields to your pricing page
[Add other fields to your pricing page](#next-steps-request)
- Pass a discount
[Pass a discount](#next-steps-discount)
- Open a checkout
[Open a checkout](#next-steps-open-checkout)

---

*Last scraped: 2025-12-15 20:18:57*
