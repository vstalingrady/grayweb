# Change billing dates

**Source:** https://developer.paddle.com/build/subscriptions/change-billing-dates

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

# Change billing dates

[Change billing dates](/build/subscriptions/change-billing-dates#change-billing-dates)

Change the billing date of a subscription to change when a customer next pays, and when their subscription renews in the future.


Subscriptions renew automatically when their billing period elapses. For example, a subscription might renew every week, month, or year.


Change the billing date of a subscription when customers want their subscription to renew on a certain day or time every period, like the first of the month or the first day of the financial year.

> Working with trialing subscriptions? You can extend a trial or cut a trial short to bill for it right away, seeExtend or activate a trial


Working with trialing subscriptions? You can extend a trial or cut a trial short to bill for it right away, seeExtend or activate a trial

[Extend or activate a trial](/build/subscriptions/extend-activate-change-date-trials)

## How it works

[How it works](/build/subscriptions/change-billing-dates#background)

Paddle automatically creates subscriptions when customers pay for recurring items usingthe checkout, or when youcreate and issue invoicesusing manually-collected transactions.

[the checkout](/concepts/sell/self-serve-checkout)
[create and issue invoices](/build/invoices/create-issue-invoices)

By default, the billing date for each renewal is based on the date that the subscription was created. For example, if a subscription bills annually then its billing date is every year on the anniversary of its creation.


Change the billing date against a subscription to change when the subscription renews. This changes the next billing date of the subscription, and the day and time that it renews in the future.


When you change a subscription billing date, you can determine how Paddle should bill for any changes. This is calledproration. Paddle's subscription billing engine calculates proration to the minute, allowing for precise billing.

[proration](/concepts/subscriptions/proration)

If you choose to prorate:

- When a customer moves their billing datelaterthan their renewal, Paddle calculates the proratedamount that they oweandbillsfor it.
- When a customer moves their billing datesoonerthan their renewal, Paddle calculates the proratedamount that they already paidfor andcreates a creditfor it.

You can also choosedo_not_billto change the billing date without charging or crediting.

> You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


## Change billing dates

[Change billing dates](/build/subscriptions/change-billing-dates#change-dates)

Change the next billing date for a subscription using the API in three steps:

1. Build a requestCreate a request that includes your new next billing date as thenext_billed_atdate, along with aproration_billing_modeto say how Paddle should handle proration.

Build a request

[Build a request](/build/subscriptions/change-billing-dates#build-request-change-dates)

Create a request that includes your new next billing date as thenext_billed_atdate, along with aproration_billing_modeto say how Paddle should handle proration.

1. Preview your changesPreview the impact that changing the billing date has on the regular amount the customer pays and the next renewal, as well as any immediate charges. This is optional, but recommended — you should present charge information to the customer.

Preview your changes

[Preview your changes](/build/subscriptions/change-billing-dates#preview-change-dates)

Preview the impact that changing the billing date has on the regular amount the customer pays and the next renewal, as well as any immediate charges. This is optional, but recommended — you should present charge information to the customer.

1. Update the subscriptionSend the request to apply the changes. Paddle updates the subscription.

Update the subscription

[Update the subscription](/build/subscriptions/change-billing-dates#patch-change-dates)

Send the request to apply the changes. Paddle updates the subscription.


### Build request

[Build request](/build/subscriptions/change-billing-dates#build-request-change-dates)

Build a request that includesnext_billed_atwith the date and time the subscription should next bill.


RFC 3339 datetime string of when this subscription is next scheduled to be billed. Include to change the next billing date.


Along with thenext_billed_atfield, you must include theproration_billing_modefield to tell Paddle how to bill for the changed date.

[proration_billing_mode](/concepts/subscriptions/proration)

You can only useprorated_immediately,prorated_next_billing_period, anddo_not_billwhen changing billing dates for a subscription.


How Paddle should handle proration calculation for changes made to a subscription or its items. Required when makingchanges that impact billing.


For automatically-collected subscriptions, responses may take longer than usual if a proration billing mode thatcollects for payment immediately is used.


When changing billing dates for automatically-collected subscriptions where theproration_billing_modeisprorated_immediately, Paddle tries to collect for the amount due right away.


You can optionally includeon_payment_failureto tell Paddle how to handle failed payment when updating a subscription.


If omitted, this defaults toprevent_changemeaning that Paddle returns an error and doesn't apply subscription changes when payment fails.


How Paddle should handle changes made to a subscription or its items if the payment fails during update. If omitted, defaults toprevent_change.


#### Request

[Request](/build/subscriptions/change-billing-dates#request-change-dates)

This example changes the billing date for a subscription to January 1, 2024.


```json
12341{
2  "next_billed_at": "2024-01-01T00:00:00Z",
3  "proration_billing_mode": "prorated_next_billing_period"
4}
```


### Preview changes

[Preview changes](/build/subscriptions/change-billing-dates#preview-change-dates)

Send a PATCH request to the/subscriptions/{subscription_id}/previewendpoint with the request you built.


Paddle ID of the subscription entity to work with.


### Response

[Response](/build/subscriptions/change-billing-dates#response-change-dates)

If successful, Paddle returns a preview of the updated subscription entity. It includes thenext_billed_atdate that you set.


Previews includeimmediate_transaction,next_transaction, andrecurring_transaction_detailsthat give you information about upcoming transactions impacted as a result of this change. In this example,proration_billing_modeisprorated_next_billing, meaning:

- Paddle doesn't create a charge immediately, soimmediate_transactionisnull
- Paddle calculates proration and charges for them on the next renewal, detailed innext_transaction

```json
12345678910111213141516171819201{
2  "data": {
3    "status": "active",
4    "customer_id": "ctm_01hj3289s46amtzv8vr57xtnxp",
5    "address_id": "add_01hj3289stgx73kjryne7pwzh7",
6    "business_id": null,
7    "currency_code": "USD",
8    "created_at": "2023-12-20T07:33:50.521Z",
9    "updated_at": "2023-12-20T11:36:26.56Z",
10    "started_at": "2023-12-20T07:33:49.542313Z",
11    "first_billed_at": "2023-12-20T07:33:49.542313Z",
12    "next_billed_at": "2024-01-01T00:00:00Z",
13    "paused_at": null,
14    "canceled_at": null,
15    "collection_mode": "automatic",
16    "billing_details": null,
17    "current_billing_period": {
18      "starts_at": "2023-12-20T07:33:49.542313Z",
19      "ends_at": "2024-01-01T00:00:00Z"
20    },

```


### Update subscription

[Update subscription](/build/subscriptions/change-billing-dates#patch-change-dates)

Send a PATCH request to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription entity to work with.


### Response

[Response](/build/subscriptions/change-billing-dates#response-change-dates)

If successful, Paddle returns the updated subscription entity. It includes thenext_billed_atdate that you set.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01hj32a99syawqhdkkbpxacwgb",
4    "status": "active",
5    "customer_id": "ctm_01hj3289s46amtzv8vr57xtnxp",
6    "address_id": "add_01hj3289stgx73kjryne7pwzh7",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-12-20T07:33:50.521Z",
10    "updated_at": "2023-12-20T11:42:29.714Z",
11    "started_at": "2023-12-20T07:33:49.542313Z",
12    "first_billed_at": "2023-12-20T07:33:49.542313Z",
13    "next_billed_at": "2024-01-01T00:00:00Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-12-20T07:33:49.542313Z",
20      "ends_at": "2024-01-01T00:00:00Z"

```


## Events

[Events](/build/subscriptions/change-billing-dates#related-notifications)

| transaction.created | Occurs ifprorated_immediatelyis included and Paddle creates a transaction for a prorated amount that a customer owes. |
| transaction.completed | Occurs when payment for a prorated transaction is completed successfully. |
| subscription.updated | Occurs when thenext_billed_atdate is changed against a subscription. |

[transaction.created](/webhooks/transactions/transaction-created)
[transaction.completed](/webhooks/transactions/transaction-completed)
[subscription.updated](/webhooks/subscriptions/subscription-updated)
`next_billed_at`

## Related pages

[Related pages](/build/subscriptions/change-billing-dates#related-pages)
[Read more](/api-reference/subscriptions/overview)
[Read more](/concepts/subscriptions/proration)
- Change billing dates
[Change billing dates](#change-billing-dates)
- How it works
[How it works](#background)
- Change billing dates
[Change billing dates](#change-dates)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:32*
