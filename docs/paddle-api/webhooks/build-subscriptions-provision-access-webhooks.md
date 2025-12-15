# Handle provisioning and fulfillment

**Source:** https://developer.paddle.com/build/subscriptions/provision-access-webhooks

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

# Handle provisioning and fulfillment

[Handle provisioning and fulfillment](/build/subscriptions/provision-access-webhooks#handle-provisioning-and-fulfillment)

Use webhooks to keep your app in sync with Paddle and determine what access customers have.


Provisioning is how you grant customers access to your app, as well as determining which features they should have access to. It's sometimes called fulfillment. For example:

- When customers sign up, set them up with an account for your app.
- If customers add or remove products for additional modules, give them access to relevant features in your app.
- Where subscriptions are paused or canceled, limit or stop access to your app.

You can use webhooks in Paddle to notify your app when an event happens that means you need to change customer access.


## How it works

[How it works](/build/subscriptions/provision-access-webhooks#background)

When integrating with Paddle, you should store some Paddle data in your own database to keep your app in sync with changes that happen to customer subscriptions. For example, you should store theidof a related subscription in your database so you can work with that subscription using the Paddle API in the future.


While your app might initiate some changes, like sending a call tothe Paddle APIto add items whena customer upgrades, some changes can happen asynchronously at any time. For example, a subscription may become past due when there's a problem with a customer payment method.

[the Paddle API](/api-reference/overview)
[a customer upgrades](/build/subscriptions/replace-products-prices-upgrade-downgrade)

You cansubscribe to webhooksto get notified when changes happen to a subscription to keep your app in sync with Paddle.

[subscribe to webhooks](/webhooks/overview)

### Core entities

[Core entities](/build/subscriptions/provision-access-webhooks#background-core-entities)

Transactionsandsubscriptionsare the core entities involved in the subscription lifecycle, and the most important events for provisioning. They're closely related, and subscription and transaction events often happen together. For example:

[Transactions](/api-reference/transactions/overview)
[subscriptions](/api-reference/subscriptions/overview)
- Transactions are how subscriptions are created initiallyPaddle automatically creates subscriptions when an automatically-collected transactions (checkouts) are completed, or when manually collected transactions (invoices) are issued.

Transactions are how subscriptions are created initially


Paddle automatically creates subscriptions when an automatically-collected transactions (checkouts) are completed, or when manually collected transactions (invoices) are issued.

[checkouts](/concepts/sell/self-serve-checkout)
[invoices](/concepts/sell/sales-assisted-invoice)
- Subscriptions create transactions to collect for paymentPaddle automatically creates transactions for subscription lifecycle events, like renewals,upgrades or downgrades, or whenone-time charges are billedto a subscription.

Subscriptions create transactions to collect for payment


Paddle automatically creates transactions for subscription lifecycle events, like renewals,upgrades or downgrades, or whenone-time charges are billedto a subscription.

[upgrades or downgrades](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[one-time charges are billed](/build/subscriptions/bill-add-one-time-charge)

## Overview

[Overview](/build/subscriptions/provision-access-webhooks#get-started)

To handle provisioning, you should:

1. Subscribe to webhooks for subscription eventsCreate notification destinationsfor subscriptions, transactions, or other events in Paddle that you want to use to keep your app in sync with Paddle.

Subscribe to webhooks for subscription events


Create notification destinationsfor subscriptions, transactions, or other events in Paddle that you want to use to keep your app in sync with Paddle.

[Create notification destinations](/webhooks/notification-destinations)
1. Check received webhooks for changes and update fields in your databaseWhen you receive webhooks from Paddle, check the returned data object for changes to fields that you're keeping in sync with your app. Update those fields in your database.

Check received webhooks for changes and update fields in your database


When you receive webhooks from Paddle, check the returned data object for changes to fields that you're keeping in sync with your app. Update those fields in your database.

1. Handle changes and provisionRun workflows that you've built to handle subscription changes or change the level of access that a customer has to your app.

Handle changes and provision


Run workflows that you've built to handle subscription changes or change the level of access that a customer has to your app.


## Recommended events

[Recommended events](/build/subscriptions/provision-access-webhooks#recommended-webhooks)

### For a basic integration

[For a basic integration](/build/subscriptions/provision-access-webhooks#recommended-webhooks-minimum)

At a minimum, we recommend that you subscribe to webhooks for:


| transaction.created | Occurs when a transaction is created. |
| subscription.created | Occurs when a subscription is created. |
| transaction.updated | Occurs any time a change happens to a transaction, including status changes. |
| subscription.updated | Occurs any time a change happens to a subscription, including status changes. |

[transaction.created](/webhooks/transactions/transaction-created)
[subscription.created](/webhooks/subscriptions/subscription-created)
[transaction.updated](/webhooks/transactions/transaction-updated)
[subscription.updated](/webhooks/subscriptions/subscription-updated)
> Transactions created by subscriptions include asubscription_idfield that you can use to match a transaction with a subscription.subscription.createdincludes atransaction_idfield, too.


Transactions created by subscriptions include asubscription_idfield that you can use to match a transaction with a subscription.subscription.createdincludes atransaction_idfield, too.

[subscription.created](/webhooks/subscriptions/subscription-created)

### For a more comprehensive integration

[For a more comprehensive integration](/build/subscriptions/provision-access-webhooks#recommended-webhooks-best)

subscription.updatedandtransaction.updatedevents occur for every change to a subscription or a transaction after they've been created.

[subscription.updated](/webhooks/subscriptions/subscription-updated)
[transaction.updated](/webhooks/transactions/transaction-updated)

However, you can subscribe to more granular events for all parts of the subscription lifecycle. For example, you can get notified when payment fails for a transaction, when a subscription moves out of trial, or when a subscription is canceled.


For specific recommendations on which events to subscribe to for subscription lifecycle events, check outour subscription lifecycle guides (below).

[our subscription lifecycle guides (below)](/build/subscriptions/provision-access-webhooks#key-events)

## Recommended fields to store

[Recommended fields to store](/build/subscriptions/provision-access-webhooks#recommended-fields)

### For a basic integration

[For a basic integration](/build/subscriptions/provision-access-webhooks#recommended-fields-minimum)

At a minimum, we recommend storing:


| Description | Field name | Reason to store |
| --- | --- | --- |
| Occurred at | notification.occurred_at | Used to check when an event occurred. The order of delivery for notifications isn't guaranteed, so you should check when an event occurred before making a change. |
| Subscription ID | subscription.id | Used to identify this subscription in webhook responses and work with this subscription using the API. |
| Subscription status | subscription.status | Used to limit or stop access when paused or canceled, or determine if a subscription is past due or trialing. |
| Subscription items | subscription.items[].price.id,subscription.items[].quantity | Used to change items on a subscription as part of an upgrade or downgrade workflow. |
| Subscription products | subscription.items[].price.product_id | Used to determine which features in your app a customer should have access to. |
| Collection mode | subscription.collection_mode | Used to determine whether a subscription bills automatically or whether Paddle sends an invoice for charges that customers must pay manually. |
| Scheduled change | subscription.scheduled_change | Used to determine whether a subscription is scheduled to pause or cancel. You can't change items on a subscription when there's a pending scheduled change. |


### For a more comprehensive integration

[For a more comprehensive integration](/build/subscriptions/provision-access-webhooks#recommended-fields-best)

For the best user experience, you might like to build a subscription billing overview page. This should let customers see information about their subscription and make changes to it.


As well as the minimum recommended fields, we recommend storing:


| Description | Field name | Reason to store |
| --- | --- | --- |
| Next billing date | subscription.next_billed_at | Used to determine when a subscription renews if active, or when it's scheduled to resume if paused. |
| Billing period | subscription.current_billing_period | Used to determine when a billing period starts and ends. May be used as part of a workflow to change billing dates. |
| Last successful transaction totals | transaction.details.totals | Used to present information about a customer's last subscription payment. |
| Last successful payment information | transaction.payments[].method_details | For automatically-collected subscriptions, used to present information about the saved payment method and handle a payment method update workflow. |
| Payment method details | subscription.billing_details | For manually-collected subscriptions, used to present and update information that's included on invoices generated by Paddle. |


For specific recommendations on which fields to store to for subscription lifecycle events, check outour subscription lifecycle guides (below).

[our subscription lifecycle guides (below)](/build/subscriptions/provision-access-webhooks#key-events)

## Recommended events and fields for lifecycle events

[Recommended events and fields for lifecycle events](/build/subscriptions/provision-access-webhooks#key-events)

These guides walk through what happens for each part of the subscription lifecycle, including which events occur, recommended workflow, and fields that you may like to store or update.

[Read more](/build/lifecycle/subscription-creation)
[Read more](/build/lifecycle/subscription-renewal)
[Read more](/build/lifecycle/subscription-renewal-dunning)
[Read more](/build/lifecycle/subscription-pause-resume)
[Read more](/build/lifecycle/subscription-cancellation)
[Read more](/build/lifecycle/payment-details-update)

## Build a stateless integration

[Build a stateless integration](/build/subscriptions/provision-access-webhooks#stateless-integration)

For performance and scalability, we strongly recommend storing information about subscriptions in a database and using webhooks to keep that information up-to-date.


If you can't store information, you can make direct requests tothe Paddle APIto get information and work with subscriptions and transactions provided you have the ID for a customer. For example:

[the Paddle API](/api-reference/overview)
- Whenlisting transactionsorsubscriptions, you can use thecustomer_idquery parameter to return entities related to a customer.
[listing transactions](/api-reference/transactions/list-transactions)
[subscriptions](/api-reference/subscriptions/list-subscriptions)
- Whenlisting transactions, you can use thesubscription_idquery parameter to return transactions related to a subscription.
[listing transactions](/api-reference/transactions/list-transactions)
- Whengetting a transaction, you can include the related customer, address, business, and other entities to avoid making another call to the API.
[getting a transaction](/api-reference/transactions/get-transaction)
- Whengetting a subscription, you can include a preview of the next transaction and recurring transaction.
[getting a subscription](/api-reference/subscriptions/get-subscription)

## Related pages

[Related pages](/build/subscriptions/provision-access-webhooks#related-pages)
[Read more](/webhooks/overview)
[Read more](/concepts/sell/self-serve-checkout)
[Read more](/concepts/sell/sales-assisted-invoice)
- Handle provisioning and fulfillment
[Handle provisioning and fulfillment](#handle-provisioning-and-fulfillment)
- How it works
[How it works](#background)
- Core entities
[Core entities](#background-core-entities)
- Overview
[Overview](#get-started)
- Recommended events
[Recommended events](#recommended-webhooks)
- For a basic integration
[For a basic integration](#recommended-webhooks-minimum)
- For a more comprehensive integration
[For a more comprehensive integration](#recommended-webhooks-best)
- Recommended fields to store
[Recommended fields to store](#recommended-fields)
- For a basic integration
[For a basic integration](#recommended-fields-minimum)
- For a more comprehensive integration
[For a more comprehensive integration](#recommended-fields-best)
- Recommended events and fields for lifecycle events
[Recommended events and fields for lifecycle events](#key-events)
- Build a stateless integration
[Build a stateless integration](#stateless-integration)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:54*
