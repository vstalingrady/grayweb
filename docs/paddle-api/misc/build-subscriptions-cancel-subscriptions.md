# Cancel a subscription

**Source:** https://developer.paddle.com/build/subscriptions/cancel-subscriptions

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

# Cancel a subscription

[Cancel a subscription](/build/subscriptions/cancel-subscriptions#cancel-a-subscription)

Cancel subscriptions when a customer no longer wants to use your software. Customers must sign up again if they wish to use your software in the future.


Cancel subscriptions to stop billing for them permanently. Paddle stops billing customers indefinitely.


You should restrict access to your app when a customer has canceled their subscription.


If a customer just wants to stop using your software temporarily,pause a subscription instead.

[pause a subscription instead](/build/subscriptions/pause-subscriptions)
> Paddle supports subscriptions with multiple products. Customers might say they want to cancel when they want to remove items for an addon or users. To learn more, seeAdd or remove products on a subscription


Paddle supports subscriptions with multiple products. Customers might say they want to cancel when they want to remove items for an addon or users. To learn more, seeAdd or remove products on a subscription

[Add or remove products on a subscription](/build/subscriptions/add-remove-products-prices-addons)

## How it works

[How it works](/build/subscriptions/cancel-subscriptions#background)

When you cancel asubscription, itsstatusis set tocanceled. Paddle stops billing for it, meaning no furthertransactionsare created for the subscription. You shouldprovision your appso customers don't have access when canceled.

[subscription](/api-reference/subscriptions/overview)
[transactions](/api-reference/transactions/overview)
[provision your app](/build/subscriptions/bill-add-one-time-charge)

For compliance reasons, subscription-related emails sent from Paddle to customers include a link to cancel. This is handled by Paddle — you don't need to build your own logic for this. When customers cancel using the link in the email from Paddle, their subscription remains active until the end of the current billing period.


You can also cancel a subscription using the API. When sending a request to cancel, you can tell Paddle to:

- Cancel at the end of the billing periodPaddle creates a scheduled change to say the subscription should be canceled on the next billing date. The subscription remainsactiveuntil the next billing date, when the subscription status changes tocanceled.

Cancel at the end of the billing period


Paddle creates a scheduled change to say the subscription should be canceled on the next billing date. The subscription remainsactiveuntil the next billing date, when the subscription status changes tocanceled.

- Cancel immediatelyPaddle cancels the subscription right away. Its status changes tocanceled.

Cancel immediately


Paddle cancels the subscription right away. Its status changes tocanceled.


If you'vemade changes to a subscriptionorbilled for one-time chargesand set them to be chargedon the next billing period, these are automatically forgiven.

[made changes to a subscription](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[billed for one-time charges](/build/subscriptions/bill-add-one-time-charge)
[on the next billing period](/concepts/subscriptions/proration)
> Canceled subscriptions can't be reinstated. Create a new subscription for customers who have canceled if they want to return.


Canceled subscriptions can't be reinstated. Create a new subscription for customers who have canceled if they want to return.


## Before you begin

[Before you begin](/build/subscriptions/cancel-subscriptions#prerequisites)
> You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


To cancel a subscription, you'll need toget the subscription IDfor the subscription you want to cancel. You can only cancel subscriptions that are active or paused.

[get the subscription ID](/api-reference/subscriptions/list-subscriptions)

You can use thestatusquery parameter with the valueactive,pausedwhen listing subscriptions to get active and paused subscriptions.


## Use the subscription management URL

[Use the subscription management URL](/build/subscriptions/cancel-subscriptions#cancel-subscription-management-url)

When working with subscriptions using the API, Paddle returns amanagement_urlsobject that includes links that you can use to update a payment method or cancel a subscription.


The simplest way to cancel a subscription is to use theget a subscription operationand returnmanagement_urls.cancelto the customer. When customers click this link, they're taken tothe customer portalwhere they can cancel the subscription.

[get a subscription operation](/api-reference/subscriptions/get-subscription)
[the customer portal](/concepts/customer-portal)

If confirmed, Paddle creates a scheduled change against the subscription to cancel on next renewal. Subscriptions remainactiveuntil the end of the billing period, at which point their status changes tocanceled.

> For security, subscription management URLs include atokenparameter. This token is temporary, so you shouldn't store these URLs. Themanagement_urlsobject isn't returned in events for this reason, too.


For security, subscription management URLs include atokenparameter. This token is temporary, so you shouldn't store these URLs. Themanagement_urlsobject isn't returned in events for this reason, too.


## Cancel a subscription

[Cancel a subscription](/build/subscriptions/cancel-subscriptions#cancel-subscription)

Cancel a subscription using the API to build your own cancellation workflow into your app.


Cancel in two steps:

1. Build a requestBuild a request that includeseffective_fromto tell Paddle when you want a subscription to cancel.

Build a request

[Build a request](/build/subscriptions/cancel-subscriptions#build-request-cancel-subscription)

Build a request that includeseffective_fromto tell Paddle when you want a subscription to cancel.

1. Cancel subscriptionSend the request to cancel your subscription. Paddle cancels your subscription now or in the future.

Cancel subscription

[Cancel subscription](/build/subscriptions/cancel-subscriptions#post-cancel-subscription)

Send the request to cancel your subscription. Paddle cancels your subscription now or in the future.


### Build request

[Build request](/build/subscriptions/cancel-subscriptions#build-request-cancel-subscription)

Build a request that includeseffective_fromto tell Paddle when you want a subscription to cancel.


You don't need to do this if you'd to cancel a subscription on the next billing period. You can send an empty request.


When this subscription change should take effect from. Defaults tonext_billing_period, which creates ascheduled_changeto apply the subscription change at the end of the billing period.


#### Request

[Request](/build/subscriptions/cancel-subscriptions#build-request-cancel-subscription-next-billing-period-request)

This example cancels a subscription on the next billing period. Paddle creates a scheduled change with aneffective_atdate of thenext_billed_atdate for the subscription.


effective_fromdefaults tonext_billing_period, so you may also send an empty request body.


```json
1231{
2  "effective_from": "next_billing_period"
3}
```


#### Request

[Request](/build/subscriptions/cancel-subscriptions#build-request-cancel-subscription-immediately-request)

This example cancels a subscription right away. The subscriptionstatuschanges tocanceled.


```json
1231{
2  "effective_from": "immediately"
3}
```


### Cancel subscription

[Cancel subscription](/build/subscriptions/cancel-subscriptions#post-cancel-subscription)

Send aPOSTrequest to the/subscriptions/{subscription_id}/cancelendpoint with the request body you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/cancel-subscriptions#post-cancel-subscription-next-billing-period-response)

If successful, Paddle returns a copy of the subscription entity with a scheduled change to cancel. The scheduled change is effective on the originalnext_billed_atdate.


next_billed_atisnullas the subscription isn't set to be billed again.


```json
171819202122232425262728293031323334353617    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2024-04-08T10:38:57.97967Z",
20      "ends_at": "2024-05-08T10:38:57.97967Z"
21    },
22    "billing_cycle": {
23      "frequency": 1,
24      "interval": "month"
25    },
26    "scheduled_change": {
27      "action": "cancel",
28      "effective_at": "2024-05-08T10:38:57.97967Z",
29      "resume_at": null
30    },
31    "items": [
32      {
33        "status": "active",
34        "quantity": 10,
35        "recurring": true,
36        "created_at": "2024-04-08T10:38:58.673Z",

```


#### Response

[Response](/build/subscriptions/cancel-subscriptions#post-cancel-subscription-immediately-response)

If successful, Paddle returns a copy of the subscription entity with thestatusofcanceled.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01hv8y5ehszzq0yv20ttx3166y",
4    "status": "canceled",
5    "customer_id": "ctm_01hv8wt8nffez4p2t6typn4a5j",
6    "address_id": "add_01hv8y4jk511j9g2n9a2mexjbx",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2024-04-12T10:38:00.761Z",
10    "updated_at": "2024-04-12T11:24:54.873Z",
11    "started_at": "2024-04-12T10:37:59.556997Z",
12    "first_billed_at": "2024-04-12T10:37:59.556997Z",
13    "next_billed_at": null,
14    "paused_at": null,
15    "canceled_at": "2024-04-12T11:24:54.868Z",
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": null,
19    "billing_cycle": {
20      "frequency": 1,

```


## Remove a scheduled change

[Remove a scheduled change](/build/subscriptions/cancel-subscriptions#remove-scheduled-change)

You can stop a cancellation from going through at the end of the billing period by removing the scheduled change.


Remove a scheduled cancellation using the API in two steps:

1. Build a requestBuild a request that removes the scheduled change.

Build a request

[Build a request](/build/subscriptions/cancel-subscriptions#build-request-remove-scheduled-change)

Build a request that removes the scheduled change.

1. Remove scheduled changeSend the request to remove the scheduled change. The subscription is no longer scheduled to cancel.

Remove scheduled change

[Remove scheduled change](/build/subscriptions/cancel-subscriptions#patch-remove-scheduled-change)

Send the request to remove the scheduled change. The subscription is no longer scheduled to cancel.


### Build request

[Build request](/build/subscriptions/cancel-subscriptions#build-request-remove-scheduled-change)

Remove a scheduled cancellation using the API by sending a request that setsscheduled_changetonull.


Change that's scheduled to be applied to a subscription.nullif no scheduled changes.


#### Request

[Request](/build/subscriptions/cancel-subscriptions#remove-scheduled-change-request)

```json
1231{
2  "scheduled_change": null
3}
```


### Remove scheduled change

[Remove scheduled change](/build/subscriptions/cancel-subscriptions#patch-remove-scheduled-change)

Send aPATCHrequest to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/cancel-subscriptions#remove-scheduled-change-response)

If successful, Paddle responds with the updated subscription entity. Scheduled change is set tonulland the status isactive.


```json
171819202122232425262728293031323334353617    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2024-04-08T10:38:57.97967Z",
20      "ends_at": "2024-05-08T10:38:57.97967Z"
21    },
22    "billing_cycle": {
23      "frequency": 1,
24      "interval": "month"
25    },
26    "scheduled_change": null,
27    "items": [
28      {
29        "status": "active",
30        "quantity": 10,
31        "recurring": true,
32        "created_at": "2024-04-08T10:38:58.673Z",
33        "updated_at": "2024-04-08T10:38:58.673Z",
34        "previously_billed_at": "2024-04-08T10:38:57.97967Z",
35        "next_billed_at": "2024-05-08T10:38:57.97967Z",
36        "trial_dates": null,

```


## Reinstate a cancelled subscription

[Reinstate a cancelled subscription](/build/subscriptions/cancel-subscriptions#reinstate-cancelled-subscription)

Canceled subscriptions can't be reinstated. Create a new subscription for customers who have canceled if they want to return.


To streamline this process, create a transaction with the same items and other information as on the previous subscription:

1. Get the previous subscriptionList subscriptionsusing thecustomer_idquery parameter, passing the Paddle ID for the customer as the value. This returns a list of all subscriptions for this customer. Get the subscription that they previously canceled.

Get the previous subscription


List subscriptionsusing thecustomer_idquery parameter, passing the Paddle ID for the customer as the value. This returns a list of all subscriptions for this customer. Get the subscription that they previously canceled.

[List subscriptions](/api-reference/subscriptions/list-subscriptions)
1. Extract price IDs and quantitiesExtract the price ID from thepriceobject and thequantityfor each item in theitemsarray against the canceled subscription entity. You may also like to extract thecurrency_code,address_id, andbusiness_idif they're going to be the same.

Extract price IDs and quantities


Extract the price ID from thepriceobject and thequantityfor each item in theitemsarray against the canceled subscription entity. You may also like to extract thecurrency_code,address_id, andbusiness_idif they're going to be the same.

1. Build a request to create a transactionBuild a requestwith anitemsarray with an object for each price that contains a price ID and a quantity, along with the customer ID and any other information you extracted from the canceled subscription.

Build a request to create a transaction


Build a requestwith anitemsarray with an object for each price that contains a price ID and a quantity, along with the customer ID and any other information you extracted from the canceled subscription.

[Build a request](/build/transactions/create-transaction)
1. Create a transactionSend aPOSTrequest to the/transactionsendpointto create a transaction. Paddle returns a new transaction for the customer, items, and other details you passed.

Create a transaction


Send aPOSTrequest to the/transactionsendpointto create a transaction. Paddle returns a new transaction for the customer, items, and other details you passed.

[POSTrequest to the/transactionsendpoint](/api-reference/transactions/create-transaction)
1. Pass to Paddle CheckoutCollect payment and create a new subscription by getting thecheckout.urlagainst the created transaction and returning it to the customer, orpass a transaction ID to Paddle.jsto open a checkout for the transaction you created.

Pass to Paddle Checkout


Collect payment and create a new subscription by getting thecheckout.urlagainst the created transaction and returning it to the customer, orpass a transaction ID to Paddle.jsto open a checkout for the transaction you created.

[pass a transaction ID to Paddle.js](/build/transactions/pass-transaction-checkout)

## Events

[Events](/build/subscriptions/cancel-subscriptions#related-notifications)

For a full list of events that occur when a subscription is canceled, seeSubscription cancellation

[Subscription cancellation](/build/lifecycle/subscription-cancellation)

## Related pages

[Related pages](/build/subscriptions/cancel-subscriptions#related-pages)
[Read more](/build/subscriptions/pause-subscriptions)
[Read more](/build/lifecycle/subscription-cancellation)
[Read more](/api-reference/subscriptions/cancel-subscription)
- Cancel a subscription
[Cancel a subscription](#cancel-a-subscription)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Use the subscription management URL
[Use the subscription management URL](#cancel-subscription-management-url)
- Cancel a subscription
[Cancel a subscription](#cancel-subscription)
- Remove a scheduled change
[Remove a scheduled change](#remove-scheduled-change)
- Reinstate a cancelled subscription
[Reinstate a cancelled subscription](#reinstate-cancelled-subscription)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:26*
