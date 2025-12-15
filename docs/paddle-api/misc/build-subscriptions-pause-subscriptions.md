# Pause a subscription

**Source:** https://developer.paddle.com/build/subscriptions/pause-subscriptions

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

# Pause a subscription

[Pause a subscription](/build/subscriptions/pause-subscriptions#pause-a-subscription)

Pause subscriptions when customers want to take a break and come back later. Offering the option to pause a subscription can lower voluntary churn and increase customer LTV.


Pause subscriptions to stop billing for them temporarily. Paddle doesn't bill for paused subscriptions until they're resumed.


You may wish to give customers some level of access to your software while paused to maintain a relationship and encourage them to return. For example, you might let customers download reports or access existing data, but restrict their access to create records.

> If a customer doesn't want to use your software at all,cancel instead. You can't reinstate a canceled subscription.


If a customer doesn't want to use your software at all,cancel instead. You can't reinstate a canceled subscription.

[cancel instead](/build/subscriptions/cancel-subscriptions)

## How it works

[How it works](/build/subscriptions/pause-subscriptions#background)

### Pause

[Pause](/build/subscriptions/pause-subscriptions#background-pause)

When you pause asubscription, itsstatusis set topausedand Paddle doesn't create anytransactionsor collect payment for it. You shouldprovision your appso customers don't have access, or have limited access, while paused.

[subscription](/api-reference/subscriptions/overview)
[transactions](/api-reference/transactions/overview)
[provision your app](/build/subscriptions/provision-access-webhooks)

When sending a request to pause, you can tell Paddle to:

- Pause at the end of the billing periodPaddle creates a scheduled change to say the subscription should be paused on the next billing date. The subscription remainsactiveuntil the next billing date, when the subscription status changes topaused.

Pause at the end of the billing period


Paddle creates a scheduled change to say the subscription should be paused on the next billing date. The subscription remainsactiveuntil the next billing date, when the subscription status changes topaused.

- Pause immediatelyPaddle pauses the subscription right away. Its status changes topaused.

Pause immediately


Paddle pauses the subscription right away. Its status changes topaused.


To avoid charging for overlapping billing periods, any past due transactions for subscription renewals, where the transactionoriginissubscription_recurring, are automatically canceled.


If you'vemade changes to a subscriptionorbilled for one-time chargesand set them to be chargedon the next billing period:

[made changes to a subscription](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[billed for one-time charges](/build/subscriptions/bill-add-one-time-charge)
[on the next billing period](/concepts/subscriptions/proration)
- When changes result in a credit, these are automatically forgiven.
- When changes result in a charge, these are applied to the transaction created on resume.

### Resume

[Resume](/build/subscriptions/pause-subscriptions#background-resume)

Subscriptions remain paused until they're resumed. Pauses can be open-ended, or you can set a resume date. We recommend giving customers a set of pause duration options in your frontend — for example, 30 days, 60 days, or 90 days.


You can resume a paused subscription at any time, even if there's a resume date already set, by sending a request to resume. It's good practice to make it as easy as possible for customers to resume their subscription, so we recommend building a way for self-serve customers to reactivate their account.


When sending a request to resume, you can tell Paddle to:

- Start a new billing periodPaddle starts a new billing period for the subscription. Thecurrent_billing_period.starts_atis set to the date and time that the subscription is resumed, and Paddle creates a transaction to collect for the new billing period immediately.

Start a new billing period


Paddle starts a new billing period for the subscription. Thecurrent_billing_period.starts_atis set to the date and time that the subscription is resumed, and Paddle creates a transaction to collect for the new billing period immediately.

- Continue the existing billing periodPaddle checks the end date of the existing billing period. If the resume date is within the existing billing period, Paddle continues the existing billing period. Thecurrent_billing_perioddates aren't changed, and there's no immediate charge.

Continue the existing billing period


Paddle checks the end date of the existing billing period. If the resume date is within the existing billing period, Paddle continues the existing billing period. Thecurrent_billing_perioddates aren't changed, and there's no immediate charge.


## Before you begin

[Before you begin](/build/subscriptions/pause-subscriptions#prerequisites)
> You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


To pause a subscription, you'll need toget the subscription IDfor the subscription you want to pause. You can only pause subscriptions that are active.

[get the subscription ID](/api-reference/subscriptions/list-subscriptions)

You can use thestatusquery parameter with the valueactivewhen listing subscriptions to get active subscriptions.


## Pause a subscription

[Pause a subscription](/build/subscriptions/pause-subscriptions#pause-subscription)

Pause a subscription using the API to build your own pause workflow into your app.


Pause in two steps:

1. Build a requestBuild a request that includeseffective_fromandresume_atto tell Paddle when you want a subscription to pause and resume.

Build a request

[Build a request](/build/subscriptions/pause-subscriptions#build-request-pause-subscription)

Build a request that includeseffective_fromandresume_atto tell Paddle when you want a subscription to pause and resume.

1. Pause subscriptionSend the request to pause your subscription. Paddle pauses your subscription now or in the future.

Pause subscription

[Pause subscription](/build/subscriptions/pause-subscriptions#post-pause-subscription)

Send the request to pause your subscription. Paddle pauses your subscription now or in the future.


### Build request

[Build request](/build/subscriptions/pause-subscriptions#build-request-pause-subscription)

Build a request that includeseffective_fromto tell Paddle when you want a subscription to pause.


You don't need to do this if you're pausing on the next billing period with no resume date. You can send an empty request.


When this subscription change should take effect from. Defaults tonext_billing_period, which creates ascheduled_changeto apply the subscription change at the end of the billing period.


To set a date when a subscription should resume, includeresume_atin your request. We recommend giving customers a set of pause duration options in your frontend.


Omit to create an open-ended pause. Subscriptions are paused indefinitely until they're explicitly resumed.


RFC 3339 datetime string of when the paused subscription should resume. Omit to pause indefinitely until resumed.


To determine how Paddle should handle charging, includeon_resumein your request.

> Defaults tostart_new_billing_period. The customer is charged immediately the full amount for the new billing period.


Defaults tostart_new_billing_period. The customer is charged immediately the full amount for the new billing period.


How Paddle should set the billing period for the subscription when resuming. If omitted, defaults tostart_new_billing_period.


#### Request

[Request](/build/subscriptions/pause-subscriptions#build-request-pause-subscription-next-billing-period-request)

This example pauses a subscription on the next billing period. Paddle creates a scheduled change with aneffective_atdate of thenext_billed_atdate for the subscription.


It's an open-ended pause, since there's noresume_atdate set.


```json
1231{
2  "effective_from": "next_billing_period"
3}
```


#### Request

[Request](/build/subscriptions/pause-subscriptions#build-request-pause-subscription-immediately-request)

This example pauses a subscription right away. The subscriptionstatuschanges topaused.


It's an open-ended pause, since there's noresume_atdate set.


```json
1231{
2  "effective_from": "immediately"
3}
```


#### Request

[Request](/build/subscriptions/pause-subscriptions#build-request-pause-subscription-resume-date-request)

This example pauses a subscription right away. The subscriptionstatuschanges topaused.


Aresume_atdate is included with the request, so Paddle creates ascheduled_changeto resume with aneffective_atof the resume date included with the request. The subscription automatically resumes on this date.


```json
12341{
2  "effective_from": "immediately",
3  "resume_at": "2023-11-01T00:00:00Z"
4}
```


### Pause subscription

[Pause subscription](/build/subscriptions/pause-subscriptions#post-pause-subscription)

Send aPOSTrequest to the/subscriptions/{subscription_id}/pauseendpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/pause-subscriptions#post-pause-subscription-next-billing-period-response)

If successful, Paddle returns a copy of the subscription entity with a scheduled change to pause.


There's noresume_atdate for the scheduled change because it's an open-ended pause.next_billed_atisnullas the subscription isn't set to be billed again until explicitly resumed.


```json
171819202122232425262728293031323334353617    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-09-21T11:31:08.689295Z",
20      "ends_at": "2023-10-21T11:31:08.689295Z"
21    },
22    "billing_cycle": {
23      "frequency": 1,
24      "interval": "month"
25    },
26    "scheduled_change": {
27      "action": "pause",
28      "effective_at": "2023-10-21T11:31:08.689295Z",
29      "resume_at": null
30    },
31    "items": [
32      {
33        "status": "active",
34        "quantity": 30,
35        "recurring": true,
36        "created_at": "2023-08-21T11:31:10.292Z",

```


#### Response

[Response](/build/subscriptions/pause-subscriptions#post-pause-subscription-immediately-response)

If successful, Paddle returns a copy of the subscription entity with thestatusofpaused.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01hbxebsqc7qg1fbqg5eqz1v82",
4    "status": "paused",
5    "customer_id": "ctm_01hbxeaqa73chfk9ants8gtrjf",
6    "address_id": "add_01hbxeaqb46zke464dwjjh7zab",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-10-04T13:34:45.484Z",
10    "updated_at": "2023-10-05T10:03:01.546Z",
11    "started_at": "2023-10-04T13:34:44.39169Z",
12    "first_billed_at": "2023-10-04T13:34:44.39169Z",
13    "next_billed_at": null,
14    "paused_at": "2023-10-05T10:03:01.544Z",
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": null,
19    "billing_cycle": {
20      "frequency": 1,

```


#### Response

[Response](/build/subscriptions/pause-subscriptions#post-pause-subscription-resume-date-response)

If successful, Paddle returns a copy of the subscription entity with thestatusofpaused.


It includes ascheduled_changeto resume effective theresume_atdate that you sent in your request.


```json
141516171819202122232425262728293031323314    "paused_at": "2023-10-05T12:50:16.963Z",
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": null,
19    "billing_cycle": {
20      "frequency": 1,
21      "interval": "month"
22    },
23    "scheduled_change": {
24      "action": "resume",
25      "effective_at": "2023-11-01T00:00:00Z",
26      "resume_at": null
27    },
28    "items": [
29      {
30        "status": "active",
31        "quantity": 10,
32        "recurring": true,
33        "created_at": "2023-10-05T12:43:53.059Z",

```


## Remove a scheduled change

[Remove a scheduled change](/build/subscriptions/pause-subscriptions#remove-scheduled-change)

You can stop a pause from going through at the end of the billing period by removing the scheduled change.


You might also do this to remove a scheduled resume from a paused subscription, so it's paused indefinitely until you resume.


Remove a scheduled pause using the API in two steps:

1. Build a requestBuild a request that removes the scheduled change.

Build a request

[Build a request](/build/subscriptions/pause-subscriptions#build-request-remove-scheduled-change)

Build a request that removes the scheduled change.

1. Remove scheduled changeSend the request to remove the scheduled change. If active, a subscription is no longer scheduled to pause. If paused, a subscription is no longer scheduled to resume.

Remove scheduled change

[Remove scheduled change](/build/subscriptions/pause-subscriptions#patch-remove-scheduled-change)

Send the request to remove the scheduled change. If active, a subscription is no longer scheduled to pause. If paused, a subscription is no longer scheduled to resume.


### Build request

[Build request](/build/subscriptions/pause-subscriptions#build-request-remove-scheduled-change)

Remove a scheduled pause using the API by sending a request that setsscheduled_changetonull.


Change that's scheduled to be applied to a subscription.nullif no scheduled changes.


#### Request

[Request](/build/subscriptions/pause-subscriptions#remove-scheduled-change-request)

```json
1231{
2  "scheduled_change": null
3}
```


### Remove scheduled change

[Remove scheduled change](/build/subscriptions/pause-subscriptions#patch-remove-scheduled-change)

Send aPATCHrequest to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/pause-subscriptions#remove-scheduled-change-response)

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


## Set or change a resume date

[Set or change a resume date](/build/subscriptions/pause-subscriptions#change-resume-date)

You can change when a subscription is set to resume, or set a resume date where a subscription is paused indefinitely.

> To change the future resume date for an active subscription that's scheduled to pause,remove the scheduled changethensend a request to pause with a resume date.


To change the future resume date for an active subscription that's scheduled to pause,remove the scheduled changethensend a request to pause with a resume date.

[remove the scheduled change](/build/subscriptions/pause-subscriptions#remove-scheduled-change)
[send a request to pause with a resume date](/build/subscriptions/pause-subscriptions#pause-subscription)

Set or change the resume date for a paused subscription using the API in two steps:

1. Build a requestBuild a request that includes the new resume date.

Build a request

[Build a request](/build/subscriptions/pause-subscriptions#build-request-change-resume-date)

Build a request that includes the new resume date.

1. Set or change the resume dateSend the request to change the resume date. Paddle updates the scheduled change to include the new or changed resume date.

Set or change the resume date

[Set or change the resume date](/build/subscriptions/pause-subscriptions#post-change-resume-date)

Send the request to change the resume date. Paddle updates the scheduled change to include the new or changed resume date.


### Build request

[Build request](/build/subscriptions/pause-subscriptions#build-request-change-resume-date)

Set or change the resume date for a subscription by building a request that includeseffective_from.


Pass either:

- An RFC 3339 timestamp to resume a subscription on a specific date and time.
- next_billing_periodto resume a subscription on the next billing period.

When this subscription change should take effect from. Defaults tonext_billing_periodfor active subscriptions,which creates ascheduled_changeto apply the subscription change at the end of the billing period.


To determine how Paddle should handle charging, includeon_resumein your request.

> Defaults tostart_new_billing_period. The customer is charged immediately the full amount for the new billing period.


Defaults tostart_new_billing_period. The customer is charged immediately the full amount for the new billing period.


How Paddle should set the billing period for the subscription when resuming. If omitted, defaults tostart_new_billing_period.


#### Request

[Request](/build/subscriptions/pause-subscriptions#request-build-request-change-resume-date)

```json
1231{
2  "effective_from": "2023-11-01T00:00:00.000000Z"
3}
```


### Set or change resume date

[Set or change resume date](/build/subscriptions/pause-subscriptions#post-change-resume-date)

Send aPOSTrequest to the/subscriptions/{subscription_id}/resumeendpoint with the request that you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/pause-subscriptions#response-post-change-resume-date)

If successful, Paddle returns a copy of the subscription entity with a scheduled change set toresume_atthe date in your request.


Theresume_atdate is the newnext_billed_atdate for the subscription.


```json
141516171819202122232425262728293031323314    "paused_at": "2023-10-21T11:32:03.228295Z",
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": null,
19    "billing_cycle": {
20      "frequency": 1,
21      "interval": "month"
22    },
23    "scheduled_change": {
24      "action": "resume",
25      "effective_at": "2023-11-01T00:00:00Z",
26      "resume_at": null
27    },
28    "items": [
29      {
30        "status": "inactive",
31        "quantity": 30,
32        "recurring": true,
33        "created_at": "2023-08-21T11:31:10.292Z",

```


## Resume a paused subscription

[Resume a paused subscription](/build/subscriptions/pause-subscriptions#resume-subscription)

Resume a subscription to start billing for it again. You should grant the customer access to your app once resumed.


When resumed, Paddle bills for the subscription immediately. The subscription billing date is recalculated based on the resume date.

> To resume on a particular date, seeSet or change a resume date


To resume on a particular date, seeSet or change a resume date

[Set or change a resume date](/build/subscriptions/pause-subscriptions#change-resume-date)

Resume a paused subscription using the API in three steps:

1. Preview resumed subscriptionPreview charging for the subscription. This is optional, but recommended — you should present charge information to a customer if you let them resume a subscription in your frontend.

Preview resumed subscription

[Preview resumed subscription](/build/subscriptions/pause-subscriptions#preview-resume-subscription)

Preview charging for the subscription. This is optional, but recommended — you should present charge information to a customer if you let them resume a subscription in your frontend.

1. Resume subscriptionSend a request to resume the subscription. Paddle updates the subscription and starts charging for it.

Resume subscription

[Resume subscription](/build/subscriptions/pause-subscriptions#post-resume-subscription)

Send a request to resume the subscription. Paddle updates the subscription and starts charging for it.

1. Update payment method— optionalFor automatically-collected subscriptions, the payment method on file may be expired or no longer valid. Present customers with a way to update their payment method.

Update payment method— optional

[Update payment method— optional](/build/subscriptions/pause-subscriptions#payment-update-resume-subscription)

For automatically-collected subscriptions, the payment method on file may be expired or no longer valid. Present customers with a way to update their payment method.


### Preview charging

[Preview charging](/build/subscriptions/pause-subscriptions#preview-resume-subscription)

Send aGETrequest to the/subscriptions/{subscription_id}endpoint, using theincludequery parameter with the valuerecurring_transaction_details.


Paddle ID of the subscription entity to work with.


Include related entities in the response. Use a comma-separated list to specify multiple entities.


### Response

[Response](/build/subscriptions/pause-subscriptions#response-preview-resume-subscription)

If successful, Paddle returns the paused subscription entity with an object that contains a preview of the recurring transaction for this subscription.


```json
141516171819202122232425262728293031323314    "paused_at": "2023-10-27T11:32:34.146969Z",
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": null,
19    "billing_cycle": {
20      "frequency": 1,
21      "interval": "month"
22    },
23    "recurring_transaction_details": {
24      "tax_rates_used": [
25        {
26          "tax_rate": "0.08875",
27          "totals": {
28            "subtotal": "40000",
29            "discount": "0",
30            "tax": "3549",
31            "total": "43549"
32          }
33        }

```


### Resume subscription

[Resume subscription](/build/subscriptions/pause-subscriptions#post-resume-subscription)

Send aPOSTrequest to the/subscriptions/{subscription_id}/resumeendpoint. Send an empty request body.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/pause-subscriptions#response-post-resume-subscription)

If successful, Paddle returns a copy of the updated subscription entity. Billing dates on the subscription reflect the resume date, with a new billing cycle starting.


If automatically collected and collection is successful, or if manually collected, the subscription status isactive. If collection fails, status ispast_dueand Paddle Retain starts dunning.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01hv959anj4zrw503h2acawb3p",
4    "status": "active",
5    "customer_id": "ctm_01hv8wt8nffez4p2t6typn4a5j",
6    "address_id": "add_01hv958rbhm5n0r6h3tmna4gtv",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2024-04-12T12:42:27.89Z",
10    "updated_at": "2024-04-12T12:44:51.309Z",
11    "started_at": "2024-04-12T12:42:27.185672Z",
12    "first_billed_at": "2024-04-12T12:42:27.185672Z",
13    "next_billed_at": "2024-05-12T12:44:51.27Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2024-04-12T12:44:51.27Z",
20      "ends_at": "2024-05-12T12:44:51.27Z"

```


### Update payment methodOptional

[Update payment methodOptional](/build/subscriptions/pause-subscriptions#payment-update-resume-subscription)

When resumed, Paddle creates a transaction to collect for the new billing period. If automatically collected, Paddle automatically attempts to collect using a payment method on file immediately on resume. This may have expired or no longer be valid, especially when resuming after a long period of time.


If collection fails, the subscription and related transaction becomepast_dueandevents for subscription past due occur. As collection is attempted immediately, if a subscription becomes past due then we recommendpresenting a way for customers to update their payment methodas part of your resume workflow.

[events for subscription past due occur](/build/lifecycle/subscription-renewal-dunning)
[presenting a way for customers to update their payment method](/build/subscriptions/update-payment-details)

## Events

[Events](/build/subscriptions/pause-subscriptions#related-notifications)

For a full list of events that occur when a subscription is paused or resumed, seeSubscription pause or resume

[Subscription pause or resume](/build/lifecycle/subscription-pause-resume)

## Related pages

[Related pages](/build/subscriptions/pause-subscriptions#related-pages)
[Read more](/build/subscriptions/cancel-subscriptions)
[Read more](/build/lifecycle/subscription-pause-resume)
[Read more](/api-reference/subscriptions/pause-subscription)
- Pause a subscription
[Pause a subscription](#pause-a-subscription)
- How it works
[How it works](#background)
- Pause
[Pause](#background-pause)
- Resume
[Resume](#background-resume)
- Before you begin
[Before you begin](#prerequisites)
- Pause a subscription
[Pause a subscription](#pause-subscription)
- Remove a scheduled change
[Remove a scheduled change](#remove-scheduled-change)
- Set or change a resume date
[Set or change a resume date](#change-resume-date)
- Resume a paused subscription
[Resume a paused subscription](#resume-subscription)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:30*
