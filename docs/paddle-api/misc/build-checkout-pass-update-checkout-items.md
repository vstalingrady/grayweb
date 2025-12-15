# Pass or update checkout items

**Source:** https://developer.paddle.com/build/checkout/pass-update-checkout-items

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

# Pass or update checkout items

[Pass or update checkout items](/build/checkout/pass-update-checkout-items#pass-or-update-checkout-items)

Pass price IDs to Paddle.js to tell Paddle what a checkout is for. Use HTML data attributes or JavaScript properties.


As well aspassing settings, you must pass an array of prices to a checkout before opening. This tells Paddle what the customer should be billed for.

[passing settings](/build/checkout/set-up-checkout-default-settings)

## How it works

[How it works](/build/checkout/pass-update-checkout-items#background)

When opening a checkout, pass a list ofpricesto it to tell Paddle what the checkout is for. You can pass properties toPaddle.Checkout.open()or useHTML data attributes.

[prices](/api-reference/prices/overview)
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[HTML data attributes](/paddlejs/html-data-attributes)
> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Overlay checkoutincludes options for customers to change item quantities and remove items.

[Overlay checkout](/build/checkout/build-overlay-checkout)

If you're usinginline checkout, you can use thePaddle.Checkout.updateCheckout()method to build your own logic to let customers add, remove, and update items.

[inline checkout](/build/checkout/build-branded-inline-checkout)
[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)
> Checkouts must have at least one item. You can't open a checkout without any items.


Checkouts must have at least one item. You can't open a checkout without any items.


## Before you begin

[Before you begin](/build/checkout/pass-update-checkout-items#prerequisites)

You'll need toinclude Paddle.js on your pageand pass aclient-side token.

[include Paddle.js on your page](/paddlejs/include-paddlejs)
[client-side token](/paddlejs/client-side-tokens)

To pass items to a checkout, you'll need to firstcreate products and prices.

[create products and prices](/build/products/create-products-prices)
> To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout


To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout

[Build an overlay checkout](/build/checkout/build-overlay-checkout)
[build an inline checkout](/build/checkout/build-branded-inline-checkout)

## Pass items to a checkout

[Pass items to a checkout](/build/checkout/pass-update-checkout-items#open-items)

Pass a list ofitemswhen opening a checkout to tell Paddle what this checkout is for.itemsshould contain an object for each item, with theprice_idfora price entityand aquantity.

[a price entity](/api-reference/prices/overview)

Passitemsto thePaddle.Checkout.open()method or use thedata-itemsHTML data attributeon your checkout launcher element to do this.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[HTML data attribute](/paddlejs/html-data-attributes)

This example passes three prices usingPaddle.Checkout.open(). The opened checkout is for these items.


```javascript
123456789101112131415161Paddle.Checkout.open({
2  items: [
3    {
4      priceId: 'pri_01gsz8x8sawmvhz1pv30nge1ke',
5      quantity: 10
6    },
7    {
8      priceId: 'pri_01gsz95g2zrkagg294kpstx54r',
9      quantity: 1
10    },
11    {
12      priceId: 'pri_01gsz98e27ak2tyhexptwc58yk',
13      quantity: 1
14    }
15  ]
16});
```


To learn more, seePaddle.Checkout.open()

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

## Update items on a checkout

[Update items on a checkout](/build/checkout/pass-update-checkout-items#update-items)

### Overlay checkout

[Overlay checkout](/build/checkout/pass-update-checkout-items#overlay-update-items)

Overlay checkoutincludes an items list along with the payment form. Customers can change quantities and remove items, except where there's only one item left on a checkout. They can't add new items.

[Overlay checkout](/concepts/sell/overlay-checkout)

### Inline checkout

[Inline checkout](/build/checkout/pass-update-checkout-items#inline-update-items)

Theinline checkoutframe captures customer and payment information. You can build your own logic to show the items list and interact with it. To update items:

[inline checkout](/concepts/sell/branded-integrated-inline-checkout)
1. Pass aneventCallbacktoPaddle.Initialize()that listens for thecheckout.loadedevent to display the on-page items list initially. Items are returned indata.itemsagainst the event.

Pass aneventCallbacktoPaddle.Initialize()that listens for thecheckout.loadedevent to display the on-page items list initially. Items are returned indata.itemsagainst the event.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
[checkout.loaded](/paddlejs/general/checkout-loaded)
1. Build logic to add or remove items and change quantities using thePaddle.checkout.updateCheckout()method. You may like to update discount at this point, too.

Build logic to add or remove items and change quantities using thePaddle.checkout.updateCheckout()method. You may like to update discount at this point, too.

[Paddle.checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)
1. Listen forcheckout.updatedin youreventCallbackto update the on-page items list.

Listen forcheckout.updatedin youreventCallbackto update the on-page items list.

[checkout.updated](/paddlejs/general/checkout-updated)
> For a complete example of an inline checkout that includes logic to dynamically update checkout items, seeBuild an inline checkout


For a complete example of an inline checkout that includes logic to dynamically update checkout items, seeBuild an inline checkout

[Build an inline checkout](/build/checkout/build-branded-inline-checkout)

## Prevent changes to items on a checkout

[Prevent changes to items on a checkout](/build/checkout/pass-update-checkout-items#prevent-changes-to-items-on-a-checkout)

### Overlay checkout

[Overlay checkout](/build/checkout/pass-update-checkout-items#overlay-prevent-changes)

Withoverlay checkout, there's no built-in option to stop customers from removing or changing quantities of items on a checkout. However, you can:

[overlay checkout](/concepts/sell/overlay-checkout)
- Set quantity limits against a price.You can set minimum and maximum quantitieswhen creating a priceto prevent customers from adding more or less of a price than they should. For example, a "Premium Support" addon might have a maximum quantity of1. Customers aren't able to change the quantity of this item on the checkout.

Set quantity limits against a price.


You can set minimum and maximum quantitieswhen creating a priceto prevent customers from adding more or less of a price than they should. For example, a "Premium Support" addon might have a maximum quantity of1. Customers aren't able to change the quantity of this item on the checkout.

[when creating a price](/build/products/create-products-prices)
- Pass a billed transaction to Paddle.js.Create a billed transactionusing the Paddle API, thenpass it to Paddle.js. Billed transactions can't be changed, so customers aren't able to change the quantity of this item on the checkout.

Pass a billed transaction to Paddle.js.


Create a billed transactionusing the Paddle API, thenpass it to Paddle.js. Billed transactions can't be changed, so customers aren't able to change the quantity of this item on the checkout.

[Create a billed transaction](/build/transactions/create-transaction)
[pass it to Paddle.js](/build/transactions/pass-transaction-checkout)
- Mark a transaction asbilledonceready.Paddle creates a relatedtransactionfor checkouts to handle calculations. You can use aneventCallbackto listen for checkout events, then send a request to the Paddle API to mark a transaction as billed once it has the status ofready. The quantity stepper is presented, but the checkout shows an error if customers try to change the quantity.

Mark a transaction asbilledonceready.


Paddle creates a relatedtransactionfor checkouts to handle calculations. You can use aneventCallbackto listen for checkout events, then send a request to the Paddle API to mark a transaction as billed once it has the status ofready. The quantity stepper is presented, but the checkout shows an error if customers try to change the quantity.

[transaction](/api-reference/transactions/overview)

### Inline checkout

[Inline checkout](/build/checkout/pass-update-checkout-items#inline-prevent-changes)

When usinginline checkout, the checkout frame doesn't include a breakdown of items or totals. It's handles capturing customer and payment information, letting you show information about what a customer is buying on your page.

[inline checkout](/concepts/sell/branded-integrated-inline-checkout)

When designing your inline checkout, we recommend building logic in your frontend if you need to prevent customers from removing or changing quantities


## Related pages

[Related pages](/build/checkout/pass-update-checkout-items#related-pages)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/paddlejs/methods/paddle-checkout-open)
[Read more](/paddlejs/methods/paddle-checkout-updatecheckout)
- Pass or update checkout items
[Pass or update checkout items](#pass-or-update-checkout-items)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Pass items to a checkout
[Pass items to a checkout](#open-items)
- Update items on a checkout
[Update items on a checkout](#update-items)
- Overlay checkout
[Overlay checkout](#overlay-update-items)
- Inline checkout
[Inline checkout](#inline-update-items)
- Prevent changes to items on a checkout
[Prevent changes to items on a checkout](#prevent-changes-to-items-on-a-checkout)
- Overlay checkout
[Overlay checkout](#overlay-prevent-changes)
- Inline checkout
[Inline checkout](#inline-prevent-changes)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:04*
