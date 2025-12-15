# Extend or activate a trial

**Source:** https://developer.paddle.com/build/subscriptions/extend-activate-change-date-trials

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

# Extend or activate a trial

[Extend or activate a trial](/build/subscriptions/extend-activate-change-date-trials#extend-or-activate-a-trial)

Extend a trial to give customers longer to evaluate, or cut a trial short to transition a customer to paying.


Trials let customers try your app or service before paying for it. You can extend trials to give customers more time to evaluate your app, or activate a subscription before a trial is up to transition a customer to paying.


Making it as easy as possible for trialing customers to transition to a paid plan is a simple way to reduce your CAC (customer acquisition cost).

> Change the items list against a subscription to add or remove items, update quantities, and bill for one-time charges. To learn more, seeWork with trials


Change the items list against a subscription to add or remove items, update quantities, and bill for one-time charges. To learn more, seeWork with trials

[Work with trials](/build/subscriptions/update-trials)

## How it works

[How it works](/build/subscriptions/extend-activate-change-date-trials#background)

Whencustomers complete checkoutfor recurring items with a trial period, Paddle creates a subscription with the statustrialing. The customer isn't charged right away. Instead, they're charged on thenext_billed_atdate against the subscription.

[customers complete checkout](/build/checkout/pass-update-checkout-items)

When thenext_billed_atdate elapses, Paddle charges thepayment methodon file and the subscription changes toactive. Thecurrent_billing_periodfor trialing subscriptions is based on the trial period. On activation, it's updated so that it's based on thebilling_cycle.

[payment method](/concepts/payment-methods/overview)

You can extend a trial by changing thenext_billed_atdate against a subscription to a date after this date.


You can cut a trial period short by either:

- Changing thenext_billed_atdate against a subscription to an earlier date.
- Sending a request to the/subscriptions/{subscription_id}/activateendpoint to activate a subscription immediately.
[/subscriptions/{subscription_id}/activate](/api-reference/subscriptions/activate-subscription)

Both options work for automatically-collected subscriptions. Theactivate a trialing subscription operationonly works for automatically-collected subscriptions, so you should move the billing date for manually-collected subscriptions.

[activate a trialing subscription operation](/api-reference/subscriptions/activate-subscription)

Since customers aren't yet paying,prorationdoesn't apply when changing billing dates for a trial. You must usedo_not_billas theproration_billing_modewhen sending requests.

[proration](/concepts/subscriptions/proration)
> Only theitemsandnext_billed_atfields can be updated for a subscription in trial. You can't update other fields against a subscription until it's activated.


Only theitemsandnext_billed_atfields can be updated for a subscription in trial. You can't update other fields against a subscription until it's activated.


## Before you begin

[Before you begin](/build/subscriptions/extend-activate-change-date-trials#prerequisites)

To extend or activate a trialing subscription, you'll need toget the subscription IDfor the subscription you want to change.

[get the subscription ID](/api-reference/subscriptions/list-subscriptions)

You can use thestatusquery parameter when listing with the valuetrialingto get a list of subscriptions in trial.


## Extend or cut short a trial

[Extend or cut short a trial](/build/subscriptions/extend-activate-change-date-trials#extend-trial)

Extend or cut short a trial using the API in two steps:

1. Build a requestCreate a request that includes your new trial end date as thenext_billed_atdate, withdo_not_billas the proration billing mode.

Build a request

[Build a request](/build/subscriptions/extend-activate-change-date-trials#build-request-extend-trial)

Create a request that includes your new trial end date as thenext_billed_atdate, withdo_not_billas the proration billing mode.

1. Update the subscriptionSend the request to apply the changes. Paddle updates the subscription.

Update the subscription

[Update the subscription](/build/subscriptions/extend-activate-change-date-trials#patch-extend-trial)

Send the request to apply the changes. Paddle updates the subscription.


### Build request

[Build request](/build/subscriptions/extend-activate-change-date-trials#build-request-extend-trial)

Build a request that includesnext_billed_atwith the date and time the trial should end.


The new date and time must be at least 30 minutes after your request. You can't make changes to a subscription if the next billing period is within 30 minutes.


RFC 3339 datetime string of when this subscription is next scheduled to be billed.


Along with thenext_billed_atfield, you must include theproration_billing_modefield to tell Paddle how to bill for the changed date.

[proration_billing_mode](/concepts/subscriptions/proration)

The only allowed value when changing thenext_billed_atfor a trialing subscription isdo_not_bill.


How Paddle should handle proration calculation for changes made to a subscription or its items. Required when makingchanges that impact billing.


For automatically-collected subscriptions, responses may take longer than usual if a proration billing mode thatcollects for payment immediately is used.


#### Request

[Request](/build/subscriptions/extend-activate-change-date-trials#request-extend-trial)

This example sets the next billing date for a subscription in trial. It includesdo_not_billas the proration billing mode.


```json
12341{
2  "next_billed_at": "2023-10-01T00:00:00Z",
3  "proration_billing_mode": "do_not_bill"
4}
```


### Update subscription

[Update subscription](/build/subscriptions/extend-activate-change-date-trials#patch-extend-trial)

Send aPATCHrequest to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/extend-activate-change-date-trials#response-patch-extend-trial)

If successful, Paddle returns a copy of the updated subscription entity.


next_billed_atis updated for the subscription and against any items. Paddle also updates thecurrent_billing_periodanditems[].trial_dates.ends_atso you can see total trial period for a subscription.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01h90n6j4k325zxf9rasr9rsb3",
4    "status": "trialing",
5    "customer_id": "ctm_01h84cjfwmdph1k8kgsyjt3k7g",
6    "address_id": "add_01h90n5k7r3gzznv46h2nta7z0",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-08-29T12:44:51.731Z",
10    "updated_at": "2023-08-29T12:53:28.538Z",
11    "started_at": "2023-08-29T12:44:51.731Z",
12    "first_billed_at": null,
13    "next_billed_at": "2023-10-01T00:00:00Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-08-29T12:44:51.731Z",
20      "ends_at": "2023-10-01T00:00:00Z"

```


## Activate a trialing subscription

[Activate a trialing subscription](/build/subscriptions/extend-activate-change-date-trials#activate-trial)

Activate a subscription to cut the trial period short and start charging a customer for it.

> Only automatically-collected subscriptions can be activated using the activate a subscription operation. For manually-collected subscriptions, follow the steps toextend or cut short a trial.


Only automatically-collected subscriptions can be activated using the activate a subscription operation. For manually-collected subscriptions, follow the steps toextend or cut short a trial.

[extend or cut short a trial](/build/subscriptions/extend-activate-change-date-trials#extend-trial)

Activate a trialing subscription using the API in two steps:

1. Preview charging for the subscriptionPreview charging for the subscription, including the regular amount the customer pays and any immediate charges. This is optional, but recommended — you should present charge information to a customer if you let them activate a subscription in your frontend.

Preview charging for the subscription

[Preview charging for the subscription](/build/subscriptions/extend-activate-change-date-trials#preview-activate-trial)

Preview charging for the subscription, including the regular amount the customer pays and any immediate charges. This is optional, but recommended — you should present charge information to a customer if you let them activate a subscription in your frontend.

1. Activate the subscriptionSend a request to activate the subscription. Paddle updates the subscription and starts charging for it.

Activate the subscription

[Activate the subscription](/build/subscriptions/extend-activate-change-date-trials#post-activate-subscription)

Send a request to activate the subscription. Paddle updates the subscription and starts charging for it.


### Preview charging

[Preview charging](/build/subscriptions/extend-activate-change-date-trials#preview-activate-trial)

Send aGETrequest to the/subscriptions/{subscription_id}endpoint, using theincludeparameter with thenext_transactionandrecurring_transaction_detailsvalues.


Paddle ID of the subscription entity to work with.


Include related entities in the response. Use a comma-separated list to specify multiple entities.


#### Response

[Response](/build/subscriptions/extend-activate-change-date-trials#response-preview-add-item)

If successful, Paddle returns a copy of your subscription entity including:

- next_transaction: An object with a preview of the next transaction for this subscription. May include charges that aren't yet billed.
- recurring_transaction_details: An object with a preview of the recurring transaction for this subscription. This is what the customer can expect to be billed when there's no prorated or one-time charges.

You might like to present a customer with charging information in your frontend if you provide a way for them to activate a trialing subscription themselves.


```json
171819202122232425262728293031323334353617    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-08-29T12:44:51.731Z",
20      "ends_at": "2023-10-01T00:00:00Z"
21    },
22    "billing_cycle": {
23      "frequency": 1,
24      "interval": "year"
25    },
26    "recurring_transaction_details": {
27      "tax_rates_used": [
28        {
29          "tax_rate": "0.08875",
30          "totals": {
31            "subtotal": "1000000",
32            "discount": "0",
33            "tax": "88750",
34            "total": "1088750"
35          }
36        }

```


### Activate subscription

[Activate subscription](/build/subscriptions/extend-activate-change-date-trials#post-activate-subscription)

Send aPOSTrequest to the/subscriptions/{subscription_id}/activateendpoint to activate a subscription.


You don't need to include a request body. The subscription is activated immediately.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/extend-activate-change-date-trials#response-activate-subscription)

If successful, Paddle returns a copy of the activated subscription entity.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01hv915hmgnwqd9n5yxgy8t60c",
4    "status": "active",
5    "customer_id": "ctm_01hv8wt8nffez4p2t6typn4a5j",
6    "address_id": "add_01hv914saqwe9wk1sbxyy9q7kq",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2024-04-12T11:30:29.648Z",
10    "updated_at": "2024-04-12T11:31:10.027Z",
11    "started_at": "2024-04-12T11:30:29.637Z",
12    "first_billed_at": "2024-04-12T11:31:09.996Z",
13    "next_billed_at": "2024-05-12T11:31:09.996Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2024-04-12T11:31:09.996Z",
20      "ends_at": "2024-05-12T11:31:09.996Z"

```


## Events

[Events](/build/subscriptions/extend-activate-change-date-trials#related-events)

| subscription.updated | Occurs when thenext_billed_atdate for a subscription is changed. |
| subscription.activated | Occurs when the trial end date for a subscription elapses and it becomes active, or when the active a trialing subscription operation is used to activate a subscription immediately. |

[subscription.updated](/webhooks/subscriptions/subscription-updated)
[subscription.activated](/webhooks/subscriptions/subscription-activated)

## Related pages

[Related pages](/build/subscriptions/extend-activate-change-date-trials#related-pages)
[Read more](/build/subscriptions/update-trials)
[Read more](/build/subscriptions/change-billing-dates)
- Extend or activate a trial
[Extend or activate a trial](#extend-or-activate-a-trial)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Extend or cut short a trial
[Extend or cut short a trial](#extend-trial)
- Build request
[Build request](#build-request-extend-trial)
- Update subscription
[Update subscription](#patch-extend-trial)
- Activate a trialing subscription
[Activate a trialing subscription](#activate-trial)
- Preview charging
[Preview charging](#preview-activate-trial)
- Activate subscription
[Activate subscription](#post-activate-subscription)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:08*
