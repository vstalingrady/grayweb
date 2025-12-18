# Bill for one-time charges

**Source:** https://developer.paddle.com/build/subscriptions/bill-add-one-time-charge

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

# Bill for one-time charges

[Bill for one-time charges](/build/subscriptions/bill-add-one-time-charge#bill-for-one-time-charges)

Bill one-time charges to a subscription for one-off things, like setup or onboarding fees or support incident charges. Charge immediately, or add them to the next renewal.


As well as adding recurring items to subscriptions, Paddle lets you bill for one-time charges. One-time charges are sometimes called one-off, ad-hoc, or non-recurring charges or fees.


Bill one-time charges to a subscription when:

- Customers pay a fee at the start of their subscription for things like setup, implementation, deployment, or activation.
- You offer services to subscribed customers, like auditing, data export, data migration, or incident support.
- You offer passes to access modules or features, like a 10-day pro pass for customers on a starter plan.
- You want to provide an easy way for customers to buy ebooks, access to webinars, or other resources you offer.
> You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


## How it works

[How it works](/build/subscriptions/bill-add-one-time-charge#background)

One-time charges for a subscription are items that don't recur. Thebilling_cycleagainst therelated price entityisnull.

[related price entity](/api-reference/prices/overview)

They're typically charged at the start of a subscription, like setup fees, or mid-cycle for things like incident support or data auditing. You can also use them to offer additional products, like ebooks, access to webinars, or other educational resources.


While you could create an entirely new transaction for additional products, billing them to the subscription lets you:

- Automatically-collect using the payment method on file for the subscriptionNo need to ask a customer for card details again. Use the billing details that you use to collect for subscription payments.

Automatically-collect using the payment method on file for the subscription


No need to ask a customer for card details again. Use the billing details that you use to collect for subscription payments.

- Add one-time charges to the next renewalCollect for your one-time charges when you next collect for a subscription, offering an integrated experience.

Add one-time charges to the next renewal


Collect for your one-time charges when you next collect for a subscription, offering an integrated experience.


As they're non-recurring, one-time charges aren't added to theitemslist against subscriptions. This list is just for recurring items.


Prorationdoesn't apply to one-time charges because they're not related to the billing period. Customers are always charged the full amount.

[Proration](/concepts/subscriptions/proration)

### Related subscription changes

[Related subscription changes](/build/subscriptions/bill-add-one-time-charge#background-other-tasks)

Billing for one-time charges is typically used when you want customers to pay for one-off fees or ad-hoc products.


Depending on what you're looking to do, you might also like to:

- Add items for new users, modules, or other recurring addonsAdding or removing users, modules, one-off fees, or other addons typically involves adding or removing items. For example, you might offer a module called "Advanced Reporting" that customers can subscribe to.

Add items for new users, modules, or other recurring addons

[Add items for new users, modules, or other recurring addons](/build/subscriptions/add-remove-products-prices-addons)

Adding or removing users, modules, one-off fees, or other addons typically involves adding or removing items. For example, you might offer a module called "Advanced Reporting" that customers can subscribe to.

- Replace items to upgrade or downgrade a subscriptionUpgrading or downgrading a subscription plan typically involves replacing products. For example, you might replace a "Starter plan" product with a "Premium plan" product to upgrade.

Replace items to upgrade or downgrade a subscription

[Replace items to upgrade or downgrade a subscription](/build/subscriptions/replace-products-prices-upgrade-downgrade)

Upgrading or downgrading a subscription plan typically involves replacing products. For example, you might replace a "Starter plan" product with a "Premium plan" product to upgrade.


## Before you begin

[Before you begin](/build/subscriptions/bill-add-one-time-charge#prerequisites)

To bill for one-time charges, you'll need toget the subscription IDfor the subscription you want them to be billed to.

[get the subscription ID](/api-reference/subscriptions/list-subscriptions)

You'll also need to get one-time prices that you want to bill for. One-time charges are prices where thebilling_cycleisnull. Use therecurringquery parameter with the valuefalsewhenlisting priceswith the API to return one-time prices.

[listing prices](/api-reference/prices/list-prices)

## Bill for one-time charges

[Bill for one-time charges](/build/subscriptions/bill-add-one-time-charge#create-charge)

Bill one-time charges to a subscription in three steps:

1. Build a requestCreate anitemslist that includes the one-time charges you want to bill for, then choose when to bill for them.

Build a request

[Build a request](/build/subscriptions/bill-add-one-time-charge#build-request-create-charge)

Create anitemslist that includes the one-time charges you want to bill for, then choose when to bill for them.

1. Preview one-time chargePreview charging for the one-time charge. This is optional, but recommended — you should present charge information to a customer.

Preview one-time charge

[Preview one-time charge](/build/subscriptions/bill-add-one-time-charge#preview-create-charge)

Preview charging for the one-time charge. This is optional, but recommended — you should present charge information to a customer.

1. Create one-time chargeSend the request to create your one-time charge. Paddle creates a transaction now or in the future.

Create one-time charge

[Create one-time charge](/build/subscriptions/bill-add-one-time-charge#post-create-charge)

Send the request to create your one-time charge. Paddle creates a transaction now or in the future.


### Build request

[Build request](/build/subscriptions/bill-add-one-time-charge#build-request-create-charge)

Build an array ofitems, with an object containing either:

- An item from your catalogInclude a price ID and quantity for each item.

An item from your catalog


Include a price ID and quantity for each item.

- A non-catalog itemInclude a price object and quantity for each item.

A non-catalog item


Include a price object and quantity for each item.


Non-catalog items are one-off or bespoke items that are specific to that transaction. To learn more, seeBill for non-catalog items

[Bill for non-catalog items](/build/transactions/bill-create-custom-items-prices-products)

You don't need to include existing recurring items on the subscription.


List of one-time charges to bill for. Only prices where thebilling_cycleisnullmay be added.


Quantity to bill for.


Paddle ID of an an existing catalog price to bill for.


List of one-time charges to add to this subscription. Only prices where thebilling_cycleisnullmay be added.


Price object for a non-catalog item to bill for. Include aproduct_idto relate this non-catalog price to an existing catalog price.


Internal description for this price, not shown to customers. Typically notes for your team.


Name of this price, shown to customers at checkout and on invoices. Typically describes how often the related product bills.


How often this price should be charged.nullif price is non-recurring (one-time).


Trial period for the product related to this price. The billing cycle begins once the trial period is over.nullfor no trial period. Requiresbilling_cycle.


How tax is calculated for this price.


Base price. This price applies to all customers, except for customers located in countries where you haveunit_price_overrides.


List of unit price overrides. Use to override the base price with a custom price and currency for a country or group of countries.


Limits on how many times the related product can be purchased at this price. Useful for discount campaigns. If omitted, defaults to 1-100.


Your own structured key-value data.


Paddle ID for the product that this price is for, prefixed withpro_.


Quantity to bill for.


Along with youritemsarray, includeeffective_fromto tell Paddle when to bill for any one-time charges.


When one-time charges should be billed.


When billing one-time charges to automatically-collected subscriptions where theeffective_fromisimmediately, Paddle tries to collect for the amount due right away.


You can optionally includeon_payment_failureto tell Paddle how to handle failed payment when billing for a one-time charge.


If omitted, this defaults toprevent_changemeaning that Paddle returns an error and doesn't bill for a one-time charge.


How Paddle should handle changes made to a subscription or its items if the payment fails during update. If omitted, defaults toprevent_change.


#### Request

[Request](/build/subscriptions/bill-add-one-time-charge#request-create-charge)

This example bills for a one-time charge on the next billing period. This means Paddle adds the charge to the transaction created when the subscription next renews.


```json
1234567891{
2  "effective_from": "next_billing_period",
3  "items": [
4    {
5      "price_id": "pri_01gsz98e27ak2tyhexptwc58yk",
6      "quantity": 1
7    }
8  ]
9}
```


### Preview charge

[Preview charge](/build/subscriptions/bill-add-one-time-charge#preview-create-charge)

Send aPOSTrequest to the/subscriptions/{subscription_id}/charge/previewendpoint with the request you built.


Paddle ID of the subscription entity to work with.


### Response

[Response](/build/subscriptions/bill-add-one-time-charge#response-preview-create-charge)

If successful, Paddle returns a preview of the updated subscription entity.


The subscription entity doesn't include the item you just added. Theitemsarray only includes recurring items.


Previews includeimmediate_transaction,next_transaction, andrecurring_transaction_detailsthat give you information about upcoming transactions impacted as a result of this change. In this example,effective_fromisnext_billing_period, meaning:

- Paddle doesn't create a charge immediately, soimmediate_transactionisnull
- Paddle charges for this item on the next billing period, so it's included innext_transaction

```json
12345678910111213141516171819201{
2  "data": {
3    "status": "active",
4    "customer_id": "ctm_01hw21d3hac6pe4wz04caz3kf4",
5    "address_id": "add_01hw2ac15twq7c162p05qzq8c9",
6    "business_id": null,
7    "currency_code": "USD",
8    "created_at": "2024-04-22T07:13:19.02Z",
9    "updated_at": "2024-04-22T08:24:45.138Z",
10    "started_at": "2024-04-22T07:13:18.412737Z",
11    "first_billed_at": "2024-04-22T07:13:18.412737Z",
12    "next_billed_at": "2025-04-22T07:13:18.412737Z",
13    "paused_at": null,
14    "canceled_at": null,
15    "collection_mode": "automatic",
16    "billing_details": null,
17    "current_billing_period": {
18      "starts_at": "2024-04-22T07:13:18.412737Z",
19      "ends_at": "2025-04-22T07:13:18.412737Z"
20    },

```


### Create one-time charge

[Create one-time charge](/build/subscriptions/bill-add-one-time-charge#post-create-charge)

Send aPOSTrequest to the/subscriptions/{subscription_id}/chargeendpoint.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/bill-add-one-time-charge#response-create-charge)
> One-time charges aren't held againstthe subscription entity, so the charges you billed for aren't returned in the response.


One-time charges aren't held againstthe subscription entity, so the charges you billed for aren't returned in the response.

[the subscription entity](/api-reference/subscriptions/overview)

If successful, Paddle returns a copy of the updated subscription entity.


The updated subscription entity doesn't include the item you just added. Theitemsarray only includes recurring items.


You can query the API to get information about the one-time charge. To learn more, seeGet a one-time charge(below)

[Get a one-time charge](/build/subscriptions/bill-add-one-time-charge#get-charge)

```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01hw2adtncz3kfj9tqhk3wcv3z",
4    "status": "active",
5    "customer_id": "ctm_01hw21d3hac6pe4wz04caz3kf4",
6    "address_id": "add_01hw2ac15twq7c162p05qzq8c9",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2024-04-22T07:13:19.02Z",
10    "updated_at": "2024-04-22T08:25:51.744Z",
11    "started_at": "2024-04-22T07:13:18.412737Z",
12    "first_billed_at": "2024-04-22T07:13:18.412737Z",
13    "next_billed_at": "2025-04-22T07:13:18.412737Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2024-04-22T07:13:18.412737Z",
20      "ends_at": "2025-04-22T07:13:18.412737Z"

```


## Get one-time charges

[Get one-time charges](/build/subscriptions/bill-add-one-time-charge#get-charge)

One-time charges aren't added to the subscriptionitemslist. This array is only for recurring items.


To get details of a one-time charge:

- Billed next billing periodWhen billed on thenext_billing_period, get the subscription you billed the charge to using the API and includenext_transaction.

Billed next billing period

[Billed next billing period](/build/subscriptions/bill-add-one-time-charge#get-charge-next-billing-period)

When billed on thenext_billing_period, get the subscription you billed the charge to using the API and includenext_transaction.

- Billed immediatelyWhen billedimmediately, list transactions using the API and filter to see transactions for the subscription you billed the charge to.

Billed immediately

[Billed immediately](/build/subscriptions/bill-add-one-time-charge#get-charge-immediately)

When billedimmediately, list transactions using the API and filter to see transactions for the subscription you billed the charge to.


### Next billing period

[Next billing period](/build/subscriptions/bill-add-one-time-charge#get-charge-next-billing-period)

When you bill for a one-time charge witheffective_fromasnext_billing_period, Paddle adds it to the next renewal transaction.


You can see the one-time charge bygetting the subscriptionthat you billed the charge to, using theincludequery parameter to return thenext_transaction. One-time charges are detailed innext_transaction.details.line_items, along with any recurring items.

[getting the subscription](/api-reference/subscriptions/get-subscription)

Send aGETrequest to the/subscriptions/{subscription_id}endpoint.


Paddle ID of the subscription entity to work with.


Include related entities in the response. Use a comma-separated list to specify multiple entities.


#### Response

[Response](/build/subscriptions/bill-add-one-time-charge#response-get-charge-next-billing-period)

This example is a subscription entity withnext_transactionincluded. There's an object for "Custom domains" (pri_01gsz98e27ak2tyhexptwc58yk), a one-time charge, innext_transaction.details.line_items.


```json
171819202122232425262728293031323334353617    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-08-22T08:25:12.565118Z",
20      "ends_at": "2023-09-22T08:25:12.565118Z"
21    },
22    "billing_cycle": {
23      "frequency": 1,
24      "interval": "month"
25    },
26    "next_transaction": {
27      "billing_period": {
28        "starts_at": "2023-09-22T08:25:12.565118Z",
29        "ends_at": "2023-10-22T08:25:12.565118Z"
30      },
31      "details": {
32        "tax_rates_used": [
33          {
34            "tax_rate": "0.08875",
35            "totals": {
36              "subtotal": "119900",

```


### Immediately

[Immediately](/build/subscriptions/bill-add-one-time-charge#get-charge-immediately)

When you bill for a one-time charge witheffective_fromasimmediately, Paddle creates a transaction for it right away.


You can see the one-time charge bylisting transactions, filtering to see transactions for the subscription you billed the charge to. Theoriginagainst the transaction issubscription_charge, which you may also filter for.

[listing transactions](/api-reference/transactions/list-transactions)
> If you'vesubscribed to notificationsfor transaction events,transaction.createdoccurs when you bill for one-time charges. The notification includes the completetransaction entity. You can checktransaction.line_itemsto get information about one-time charges.


If you'vesubscribed to notificationsfor transaction events,transaction.createdoccurs when you bill for one-time charges. The notification includes the completetransaction entity. You can checktransaction.line_itemsto get information about one-time charges.

[subscribed to notifications](/webhooks/notification-destinations)
[transaction.created](/webhooks/transactions/transaction-created)
[transaction entity](/api-reference/transactions/overview)
`transaction.line_items`

Send aGETrequest to the/transactionsendpoint.


Return entities related to the specified subscription. Use a comma-separated list to specify multiple subscription IDs.


Return entities related to the specified origin. Use a comma-separated list to specify multiple origins.


#### Response

[Response](/build/subscriptions/bill-add-one-time-charge#response-get-charge-immediately)

This example is a list of transactions, filtered by subscription and origin. It includes one result for a transaction entity created for "Custom domains" (pri_01gsz98e27ak2tyhexptwc58yk), a one-time charge. Theoriginfor this transaction issubscription_chargebecause a one-time charge was billed to a subscription.


```json
12345678910111213141516171819201{
2  "data": [
3    {
4      "id": "txn_01h3kvj0hs5e3q1d53g5jnfbg3",
5      "status": "completed",
6      "customer_id": "ctm_01h3h38xn5c2701bb5eecy9m6a",
7      "address_id": "add_01h3h38xqmv1xy0tjsnj0g1ke5",
8      "business_id": null,
9      "custom_data": null,
10      "origin": "subscription_charge",
11      "collection_mode": "automatic",
12      "subscription_id": "sub_01h3h3a9sfpr5syq38tq0sd4sp",
13      "invoice_id": "inv_01h3kvj4zfm911d3p0qbtg5ksf",
14      "invoice_number": "325-10054",
15      "billing_details": null,
16      "billing_period": {
17        "starts_at": "2023-08-22T08:25:12.565118Z",
18        "ends_at": "2023-09-22T08:25:12.565118Z"
19      },
20      "currency_code": "USD",

```


## Events

[Events](/build/subscriptions/bill-add-one-time-charge#related-events)

| transaction.created | Occurs when a one-time charge is billed to a subscription immediately, and when a subscription renews. |
| subscription.updated | Occurs when a subscription renews. One-time charges billed to a subscription on the next billing period are included in the created transaction. |

[transaction.created](/webhooks/transactions/transaction-created)
[subscription.updated](/webhooks/subscriptions/subscription-updated)

## Related pages

[Related pages](/build/subscriptions/bill-add-one-time-charge#related-pages)
[Read more](/build/subscriptions/add-remove-products-prices-addons)
[Read more](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[Read more](/concepts/subscriptions/proration)
- Bill for one-time charges
[Bill for one-time charges](#bill-for-one-time-charges)
- How it works
[How it works](#background)
- Related subscription changes
[Related subscription changes](#background-other-tasks)
- Before you begin
[Before you begin](#prerequisites)
- Bill for one-time charges
[Bill for one-time charges](#create-charge)
- Build request
[Build request](#build-request-create-charge)
- Preview charge
[Preview charge](#preview-create-charge)
- Response
[Response](#response-preview-create-charge)
- Create one-time charge
[Create one-time charge](#post-create-charge)
- Get one-time charges
[Get one-time charges](#get-charge)
- Next billing period
[Next billing period](#get-charge-next-billing-period)
- Immediately
[Immediately](#get-charge-immediately)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:11*
