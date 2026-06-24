# Handle checkout success

**Source:** https://developer.paddle.com/build/checkout/handle-success-post-checkout

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

# Handle checkout success

[Handle checkout success](/build/checkout/handle-success-post-checkout#handle-checkout-success)

Redirect to a success page or create custom logic that runs when checkout completes. Then, provision your app.


Paddle Checkout includes a final screen that lets customers know their purchase was successful. You can redirect to your own page or build a more advanced success workflow usingPaddle.js.

[Paddle.js](/paddlejs/overview)

## How it works

[How it works](/build/checkout/handle-success-post-checkout#background)

When a customer successfully pays for items on a checkout, Paddle Checkout lets them know that their purchase was successful and sends an email with details of the order.


If you like, you can redirect to your own success page when checkout completes successfully. You might like to include tips and tricks for getting started, or point customers towards a complementary addon like training or implementation.


For more advanced success workflows, you can pass aneventCallbackforcheckout.completedtoPaddle.Initialize(). This lets you run your own JavaScript function when checkout completes. You might use this as part ofan inline checkoutworkflow to redirect to a new page or change elements on the checkout page to show order information.

[checkout.completed](/paddlejs/general/checkout-completed)
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
[an inline checkout](/build/checkout/build-branded-inline-checkout)

If a checkout is for recurring products, Paddle automatically creates a newsubscriptionfor the customer for the items that they purchased. You shouldprovision your appat this point to make sure the customer can access the products they paid for.

[subscription](/api-reference/subscriptions/overview)
[provision your app](/build/subscriptions/provision-access-webhooks)

## Before you begin

[Before you begin](/build/checkout/handle-success-post-checkout#prerequisites)

You'll need toinclude Paddle.js on your pageand pass aclient-side token.

[include Paddle.js on your page](/paddlejs/include-paddlejs)
[client-side token](/paddlejs/client-side-tokens)

To open a checkout, you'll need tocreate products and pricesandpass them to a checkout.

[create products and prices](/build/products/create-products-prices)
[pass them to a checkout](/build/checkout/pass-update-checkout-items)
> To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout


To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout

[Build an overlay checkout](/build/checkout/build-overlay-checkout)
[build an inline checkout](/build/checkout/build-branded-inline-checkout)

## Redirect to a success page

[Redirect to a success page](/build/checkout/handle-success-post-checkout#redirect-to-a-success-page)

You can redirect customers to your own success page by passing a property to a checkout when opening it.


Use thedata-success-urlHTML data attributeon your checkout launcher element, or passsettings.successUrlto thePaddle.Checkout.open()orPaddle.Initialize()methods do this.

[HTML data attribute](/paddlejs/html-data-attributes)
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

This example sets the redirect page tohttps://paddle.com/thankyouusingdata-success-url.


```html
12345678910111213141516171819201<a 
2  href='#' 
3  class='paddle_button'
4  data-display-mode='overlay'
5  data-theme='light'
6  data-locale='en'
7  data-success-url='https://paddle.com/thankyou'
8  data-items='[
9    {
10      "priceId": "pri_01gs59hve0hrz6nyybj56z04eq",
11      "quantity": 1
12    },
13    {
14      "priceId": "pri_01gs59p7rcxmzab2dm3gfqq00a",
15      "quantity": 1
16    }
17  ]'
18>
19  Buy Now
20</a>
```


To learn more, seeHTML data attribute

[HTML data attribute](/paddlejs/html-data-attributes)

## Write an event callback

[Write an event callback](/build/checkout/handle-success-post-checkout#write-an-event-callback)

Paddle.js emits eventsfor key actions as a customer moves through checkout. It emitsacheckout.completedeventwhen a customer successfully pays for items on a checkout.

[Paddle.js emits events](/paddlejs/events/overview)
[acheckout.completedevent](/paddlejs/general/checkout-completed)

You can pass aneventCallbacktoPaddle.Initialize()to call a function whencheckout.completedis emitted.


This example logs thecheckout.completedevent emitted by Paddle.js to console.


```javascript
123456781Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  eventCallback: function(data) {
4    if (data.name == "checkout.completed") {
5      console.log(data);
6    }
7  }
8});
```


## Provision your app

[Provision your app](/build/checkout/handle-success-post-checkout#provision-your-app)

When a customer completes checkout for recurring items, Paddle automatically createsa related subscription.

[a related subscription](/api-reference/subscriptions/overview)

At this point, you should provision your app. Provisioning is how you grant customers access to your app, as well as determining which features they should have access to.


To learn more, seeHandle provisioning and fulfillment

[Handle provisioning and fulfillment](/build/subscriptions/provision-access-webhooks)

## Related pages

[Related pages](/build/checkout/handle-success-post-checkout#related-pages)
[Read more](/build/subscriptions/provision-access-webhooks)
[Read more](/build/checkout/set-up-checkout-default-settings)
[Read more](/paddlejs/events/overview)
- Handle checkout success
[Handle checkout success](#handle-checkout-success)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Redirect to a success page
[Redirect to a success page](#redirect-to-a-success-page)
- Write an event callback
[Write an event callback](#write-an-event-callback)
- Provision your app
[Provision your app](#provision-your-app)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:39*
