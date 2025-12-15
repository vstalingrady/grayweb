# Add or remove items from a subscription

**Source:** https://developer.paddle.com/build/subscriptions/add-remove-products-prices-addons

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

# Add or remove items from a subscription

[Add or remove items from a subscription](/build/subscriptions/add-remove-products-prices-addons#add-or-remove-items-from-a-subscription)

Add items to subscriptions when customers want to take additional users, modules, or other kinds of recurring addons. Remove items when customers want to change or cancel them.


Paddle supports multi-product subscriptions, letting you build complex pricing models. Add or remove items from a subscription to make changes to customer plans.


Add or remove items from a subscription when:

- Customers pay per user, and they add users to their subscription
- A customer wants to stop paying for ("cancel") an additional recurring product, like a reporting module
- You have a tiered or volume pricing model and need to set the tier to bill for

You can add items, remove items, and change quantities in the same request. We've split them into separate examples here for simplicity.


## How it works

[How it works](/build/subscriptions/add-remove-products-prices-addons#background)

You might have a subscription billing model that's made up of multiple components. For example, you might offer a base plan and additional modules or users.


In Paddle, you don't need to create multiple subscriptions for multiple products. Each subscription holds anitemslist that can contain multiple products. When a customer does something like takes on a new module or decreases their user count, you can make changes to the items list on their subscription bill for the changes.


Keep in mind that customers might say:

- They're "canceling" a product, like a module or other recurring addon, when they'd like to remove it. Canceling items doesn'tcancel a subscription entirely.
[cancel a subscription entirely](/build/subscriptions/cancel-subscriptions)
- They're "subscribing" or "upgrading" when they add a product or change quantities. You don't need to create a new subscription to bill for new products.
> Recurring items on a subscription must have the same billing interval. For example, you can't have a subscription with some prices that are billed monthly and some products that are billed annually.


Recurring items on a subscription must have the same billing interval. For example, you can't have a subscription with some prices that are billed monthly and some products that are billed annually.


### Proration

[Proration](/build/subscriptions/add-remove-products-prices-addons#background-proration)

When you make changes to items, you can determine how Paddle should bill for those changes. This is calledproration. Paddle's subscription billing engine calculates proration to the minute, allowing for precise billing.

[proration](/concepts/subscriptions/proration)

Before you add or remove items on a subscription, you can preview the changes first. This lets you see prorated charges for any changes that you're making before charging for them. You might present this to the customer in your frontend.


### Related subscription changes

[Related subscription changes](/build/subscriptions/add-remove-products-prices-addons#background-other-tasks)

Adding or removing items is typically used when you want to make changes to recurring addons, like optional modules or seats.


Depending on what you're looking to do, you might also like to:

- Replace items to upgrade or downgrade a subscriptionUpgrading or downgrading a subscription plan typically involves replacing products. For example, you might replace a "Starter plan" product with a "Premium plan" product to upgrade.

Replace items to upgrade or downgrade a subscription

[Replace items to upgrade or downgrade a subscription](/build/subscriptions/replace-products-prices-upgrade-downgrade)

Upgrading or downgrading a subscription plan typically involves replacing products. For example, you might replace a "Starter plan" product with a "Premium plan" product to upgrade.

- Create one-time charges for non-recurring itemsOne-time charges aren't included in theitemslist for a subscription, since they aren't recurring. Create a one-time charge instead. For example, you might bill for an "Out of hours support incident" as and when it happens.

Create one-time charges for non-recurring items

[Create one-time charges for non-recurring items](/build/subscriptions/bill-add-one-time-charge)

One-time charges aren't included in theitemslist for a subscription, since they aren't recurring. Create a one-time charge instead. For example, you might bill for an "Out of hours support incident" as and when it happens.


## Before you begin

[Before you begin](/build/subscriptions/add-remove-products-prices-addons#prerequisites)
> You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


### Get subscription and extract existing prices

[Get subscription and extract existing prices](/build/subscriptions/add-remove-products-prices-addons#prerequisites-get-subscription)

If you're working with the API, you'll need to get and extract existing items on a subscription first.


This is because when updating subscription items, Paddle expects the complete list of items that you want to be on the subscription — including existing items. If you don't include an existing item, it's removed from the subscription.


To learn more, seeWork with lists

[Work with lists](/api-reference/about/lists)

Send aGETrequest to the/subscriptions/{subscription_id}endpoint.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/add-remove-products-prices-addons#response-get-subscription)

Paddle returns the complete subscription entity for the ID you specified.


Extract the price ID from thepriceobject and thequantityfor eachitemin the items array. Keep those for the next step.


```json
212223242526272829303132333435363738394021    },
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
32        "created_at": "2023-06-22T08:25:14.287456Z",
33        "updated_at": "2023-06-22T08:25:14.287456Z",
34        "previously_billed_at": "2023-06-22T08:25:12.565118Z",
35        "next_billed_at": "2023-07-22T08:25:12.565118Z",
36        "price": {
37          "id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
38          "product_id": "pro_01gsz4t5hdjse780zja8vvr7jg",
39          "description": "Monthly (per seat)",
40          "tax_mode": "account_setting",

```


## Add items to a subscription

[Add items to a subscription](/build/subscriptions/add-remove-products-prices-addons#add-item)

Add items to subscriptions when customers want to take additional modules or services. They might call this "upgrading."


You can only add recurring items. Recurring items are prices that have abilling_cycleset against them.


You can use anyproration billing mode.

[proration billing mode](/concepts/subscriptions/proration)
> Recurring items on a subscription must have the same billing interval. For example, you can't have a subscription with some products that are billed monthly and some products that are billed annually.


Recurring items on a subscription must have the same billing interval. For example, you can't have a subscription with some products that are billed monthly and some products that are billed annually.


Add recurring items to a subscription using the API in three steps:

1. Build a requestCreate an items list that includes existing items and new items, then choose your proration mode.

Build a request

[Build a request](/build/subscriptions/add-remove-products-prices-addons#build-request-add-item)

Create an items list that includes existing items and new items, then choose your proration mode.

1. Preview your changesPreview the impact of the new items on the regular amount the customer pays and the next renewal, as well as any immediate charges. This is optional, but recommended — you should present charge information to a customer.

Preview your changes

[Preview your changes](/build/subscriptions/add-remove-products-prices-addons#preview-add-item)

Preview the impact of the new items on the regular amount the customer pays and the next renewal, as well as any immediate charges. This is optional, but recommended — you should present charge information to a customer.

1. Update the subscriptionSend the request to apply the changes you previewed. Paddle updates the subscription.

Update the subscription

[Update the subscription](/build/subscriptions/add-remove-products-prices-addons#post-add-item)

Send the request to apply the changes you previewed. Paddle updates the subscription.


### Build request

[Build request](/build/subscriptions/add-remove-products-prices-addons#build-request-add-item)

Build a request that includes anitemsarray. Your array should include an object for each item, where each object contains a price ID and a quantity.


Include existing price IDs that you extractedin the previous step, as well as any new items that you want to add.

[in the previous step](/build/subscriptions/add-remove-products-prices-addons#prerequisites)

You may omitquantityfor existing items where you're not making changes to the quantity.


List of items on this subscription. Only recurring items may be added. Send the complete list of items that should be on this subscription, including existing items that you'd like to keep.


Quantity to bill for.


Paddle ID of an an existing catalog price to bill for.


List of items on this subscription. Only recurring items may be added. Send the complete list of items that should be on this subscription, including existing items that you'd like to keep.


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


Along with youritemsarray, you must include theproration_billing_modefield to tell Paddle how to bill for the added items.

[proration_billing_mode](/concepts/subscriptions/proration)

How Paddle should handle proration calculation for changes made to a subscription or its items. Required when makingchanges that impact billing.


For automatically-collected subscriptions, responses may take longer than usual if a proration billing mode thatcollects for payment immediately is used.


When making changes to automatically-collected subscriptions where theproration_billing_modeisprorated_immediatelyorfull_immediately, Paddle tries to collect for the amount due right away.


You can optionally includeon_payment_failureto tell Paddle how to handle failed payment when updating a subscription.


If omitted, this defaults toprevent_changemeaning that Paddle returns an error and doesn't apply subscription changes when payment fails.


How Paddle should handle changes made to a subscription or its items if the payment fails during update. If omitted, defaults toprevent_change.


#### Request

[Request](/build/subscriptions/add-remove-products-prices-addons#request-add-item)

This example adds two new items with a quantity of1each. There's noquantityfor the final item because it already exists on the subscription. Its quantity won't be changed.


It includesprorated_immediatelyas the billing mode, meaning Paddle calculates a prorated charge for the new items and bills for it on the next renewal.


```json
123456789101112131415161{
2  "proration_billing_mode": "prorated_next_billing_period",
3  "items": [
4    {
5      "price_id": "pri_01gsz95g2zrkagg294kpstx54r",
6      "quantity": 1
7    },
8    {
9      "price_id": "pri_01h1vjfevh5etwq3rb416a23h2",
10      "quantity": 1
11    },
12    {
13      "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke"
14    }
15  ]
16}
```


### Preview change

[Preview change](/build/subscriptions/add-remove-products-prices-addons#preview-add-item)

Send aPATCHrequest to the/subscriptions/{subscription_id}/previewendpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/add-remove-products-prices-addons#response-preview-add-item)

If successful, Paddle returns a preview of the updated subscription entity.


Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


Previews includeimmediate_transaction,next_transaction, andrecurring_transaction_detailsthat give you information about upcoming transactions impacted as a result of this change. In this example,proration_billing_modeisprorated_next_billing, meaning:

- Paddle doesn't create a charge immediately, soimmediate_transactionisnull
- Paddle calculates proration and charges for them on the next renewal, detailed innext_transaction

```json
118119120121122123124125126127128129130131132133134135136137118          "unit_totals": {
119            "subtotal": "28500",
120            "discount": "0",
121            "tax": "2529",
122            "total": "31029"
123          }
124        }
125      ]
126    },
127    "next_transaction": {
128      "billing_period": {
129        "starts_at": "2023-07-22T08:25:12.565118Z",
130        "ends_at": "2023-08-22T08:25:12.565118Z"
131      },
132      "details": {
133        "tax_rates_used": [
134          {
135            "tax_rate": "0.08875",
136            "totals": {
137              "subtotal": "106996",

```


### Update subscription

[Update subscription](/build/subscriptions/add-remove-products-prices-addons#post-add-item)

Send aPATCHrequest to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/add-remove-products-prices-addons#response-post-add-item)

If successful, Paddle returns a copy of the updated subscription entity.


Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01h3h3a9sfpr5syq38tq0sd4sp",
4    "status": "active",
5    "customer_id": "ctm_01h3h38xn5c2701bb5eecy9m6a",
6    "address_id": "add_01h3h38xqmv1xy0tjsnj0g1ke5",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-06-22T08:25:14.287455Z",
10    "updated_at": "2023-06-22T08:40:46.295638Z",
11    "started_at": "2023-06-22T08:25:12.565118Z",
12    "first_billed_at": "2023-06-22T08:25:12.565118Z",
13    "next_billed_at": "2023-07-22T08:25:12.565118Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-06-22T08:25:12.565118Z",
20      "ends_at": "2023-07-22T08:25:12.565118Z"

```


## Remove items from a subscription

[Remove items from a subscription](/build/subscriptions/add-remove-products-prices-addons#remove-items)

Remove items from subscriptions when customers no longer want additional modules or other addons. They might call this "canceling" those modules or addons.


Depending on your pricing model, you might also do this as part ofan upgrade or downgrade workflow, too. For example, some items might be incompatible with entry-level plans, or might be included in higher-level plans.

[an upgrade or downgrade workflow](/build/subscriptions/replace-products-prices-upgrade-downgrade)

You can choose anyproration billing mode.

[proration billing mode](/concepts/subscriptions/proration)

Remove recurring items from a subscription using the API in three steps:

1. Build a requestCreate an items list that has the list of items that you want to keep on the subscription, then choose your proration mode.

Build a request

[Build a request](/build/subscriptions/add-remove-products-prices-addons#build-request-remove-item)

Create an items list that has the list of items that you want to keep on the subscription, then choose your proration mode.

1. Preview your changesPreview the impact of removing the items on the regular amount the customer pays and the next renewal. This is optional, but recommended — you should present charge information to a customer.

Preview your changes

[Preview your changes](/build/subscriptions/add-remove-products-prices-addons#preview-remove-item)

Preview the impact of removing the items on the regular amount the customer pays and the next renewal. This is optional, but recommended — you should present charge information to a customer.

1. Update the subscriptionSend the request to apply the changes you previewed. Paddle updates the subscription.

Update the subscription

[Update the subscription](/build/subscriptions/add-remove-products-prices-addons#post-remove-item)

Send the request to apply the changes you previewed. Paddle updates the subscription.


### Build request

[Build request](/build/subscriptions/add-remove-products-prices-addons#build-request-remove-item)

Build an array ofitems, with an object containing either:

- An item from your catalogInclude a price ID and quantity for each item.

An item from your catalog


Include a price ID and quantity for each item.

- A non-catalog itemInclude a price object and quantity for each item.

A non-catalog item


Include a price object and quantity for each item.


Non-catalog items are one-off or bespoke items that are specific to that transaction. To learn more, seeBill for non-catalog items

[Bill for non-catalog items](/build/transactions/bill-create-custom-items-prices-products)

To remove items, don't include them in the array.


You may omitquantityfor existing items where you're not making changes to the quantity.

> Subscriptions must have at least one item. Considercanceling a subscription entirely, orpausingto stop billing temporarily.


Subscriptions must have at least one item. Considercanceling a subscription entirely, orpausingto stop billing temporarily.

[canceling a subscription entirely](/build/subscriptions/cancel-subscriptions)
[pausing](/build/subscriptions/pause-subscriptions)

List of items on this subscription. Only recurring items may be added. Send the complete list of items that should be on this subscription, including existing items that you'd like to keep.


Quantity to bill for.


Paddle ID of an an existing catalog price to bill for.


List of items on this subscription. Only recurring items may be added. Send the complete list of items that should be on this subscription, including existing items that you'd like to keep.


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


Along with youritemsarray, you must include theproration_billing_modefield to tell Paddle how to bill for the removed items.

[proration_billing_mode](/concepts/subscriptions/proration)

How Paddle should handle proration calculation for changes made to a subscription or its items. Required when makingchanges that impact billing.


For automatically-collected subscriptions, responses may take longer than usual if a proration billing mode thatcollects for payment immediately is used.


When making changes to automatically-collected subscriptions where theproration_billing_modeisprorated_immediatelyorfull_immediately, Paddle tries to collect for the amount due right away.


You can optionally includeon_payment_failureto tell Paddle how to handle failed payment when updating a subscription.


If omitted, this defaults toprevent_changemeaning that Paddle returns an error and doesn't apply subscription changes when payment fails.


How Paddle should handle changes made to a subscription or its items if the payment fails during update. If omitted, defaults toprevent_change.


#### Request

[Request](/build/subscriptions/add-remove-products-prices-addons#request-remove-item)

This example includes two items with a quantity of1each. There's noquantityfor either item because they already exist on the subscription. Their quantities won't be changed.


It includesprorated_next_billingas the billing mode, meaning Paddle calculates a prorated credit for the removed items and applies it to the next transaction.


```json
12345678910111{
2  "proration_billing_mode": "prorated_next_billing_period",
3  "items": [
4    {
5      "price_id": "pri_01h1vjfevh5etwq3rb416a23h2"
6    },
7    {
8      "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke"
9    }
10  ]
11}
```


### Preview change

[Preview change](/build/subscriptions/add-remove-products-prices-addons#preview-remove-item)

Send aPATCHrequest to the/subscriptions/{subscription_id}/previewendpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/add-remove-products-prices-addons#response-preview-remove-item)

If successful, Paddle returns a preview of the updated subscription entity.


Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


Previews includeimmediate_transaction,next_transaction, andrecurring_transaction_detailsthat give you information about upcoming transactions impacted as a result of this change. In this example,proration_billing_modeisprorated_next_billing, meaning:

- Paddle doesn't create a charge immediately, soimmediate_transactionisnull
- Paddle calculates proration and charges for them on the next renewal, detailed innext_transaction

As an item was removed, Paddle calculates a credit and deducts this from the next renewal.


```json
9394959697989910010110210310410510610710810911011111293          "unit_totals": {
94            "subtotal": "10000",
95            "discount": "0",
96            "tax": "887",
97            "total": "10887"
98          }
99        }
100      ]
101    },
102    "next_transaction": {
103      "billing_period": {
104        "starts_at": "2023-08-22T08:25:12.565118Z",
105        "ends_at": "2023-09-22T08:25:12.565118Z"
106      },
107      "details": {
108        "tax_rates_used": [
109          {
110            "tax_rate": "0.08875",
111            "totals": {
112              "subtotal": "40000",

```


### Update subscription

[Update subscription](/build/subscriptions/add-remove-products-prices-addons#post-remove-item)

Send aPATCHrequest to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription to update.


#### Response

[Response](/build/subscriptions/add-remove-products-prices-addons#response-post-remove-item)

If successful, Paddle returns a copy of the updated subscription entity.


Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01h3h3a9sfpr5syq38tq0sd4sp",
4    "status": "active",
5    "customer_id": "ctm_01h3h38xn5c2701bb5eecy9m6a",
6    "address_id": "add_01h3h38xqmv1xy0tjsnj0g1ke5",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-06-22T08:25:14.287455Z",
10    "updated_at": "2023-07-22T09:33:24.427246Z",
11    "started_at": "2023-06-22T08:25:12.565118Z",
12    "first_billed_at": "2023-06-22T08:25:12.565118Z",
13    "next_billed_at": "2023-08-22T08:25:12.565118Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-07-22T08:25:12.565118Z",
20      "ends_at": "2023-08-22T08:25:12.565118Z"

```


## Change quantities

[Change quantities](/build/subscriptions/add-remove-products-prices-addons#change-quantities)

Change quantities when customers want to increase or decrease the number of units of an item that they pay for. You might change quantities if your pricing is per user or seat. They might call it "upgrading" when increasing units, and "downgrading" when decreasing units.


You can choose anyproration billing mode.

[proration billing mode](/concepts/subscriptions/proration)

Change quantities for recurring items on a subscription using the API in three steps:

1. Build a requestCreate an items list that includes the items and their new quantities, then choose your proration mode.

Build a request

[Build a request](/build/subscriptions/add-remove-products-prices-addons#build-request-change-quantities)

Create an items list that includes the items and their new quantities, then choose your proration mode.

1. Preview your changesPreview the impact of the changed quantities on the regular amount the customer pays and the next renewal, as well as any immediate charges. This is optional, but recommended — you should present charge information to a customer.

Preview your changes

[Preview your changes](/build/subscriptions/add-remove-products-prices-addons#preview-change-quantities)

Preview the impact of the changed quantities on the regular amount the customer pays and the next renewal, as well as any immediate charges. This is optional, but recommended — you should present charge information to a customer.

1. Update the subscriptionSend the request to apply the changes you previewed. Paddle updates the subscription.

Update the subscription

[Update the subscription](/build/subscriptions/add-remove-products-prices-addons#post-change-quantities)

Send the request to apply the changes you previewed. Paddle updates the subscription.


### Build request

[Build request](/build/subscriptions/add-remove-products-prices-addons#build-request-change-quantities)

Build an array ofitems, with an object containing either:

- An item from your catalogInclude a price ID and quantity for each item.

An item from your catalog


Include a price ID and quantity for each item.

- A non-catalog itemInclude a price object and quantity for each item.

A non-catalog item


Include a price object and quantity for each item.


Non-catalog items are one-off or bespoke items that are specific to that transaction. To learn more, seeBill for non-catalog items

[Bill for non-catalog items](/build/transactions/bill-create-custom-items-prices-products)

If you're just changing quantities, your items array should include the same price IDs with different quantities.


You may omitquantityfor existing items where you're not making changes to the quantity.


List of items on this subscription. Only recurring items may be added. Send the complete list of items that should be on this subscription, including existing items that you'd like to keep.


Quantity to bill for.


Paddle ID of an an existing catalog price to bill for.


List of items on this subscription. Only recurring items may be added. Send the complete list of items that should be on this subscription, including existing items that you'd like to keep.


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


Along with youritemsarray, you must include theproration_billing_modefield to tell Paddle how to bill for the quantity changes.

[proration_billing_mode](/concepts/subscriptions/proration)

How Paddle should handle proration calculation for changes made to a subscription or its items. Required when makingchanges that impact billing.


For automatically-collected subscriptions, responses may take longer than usual if a proration billing mode thatcollects for payment immediately is used.


When making changes to automatically-collected subscriptions where theproration_billing_modeisprorated_immediatelyorfull_immediately, Paddle tries to collect for the amount due right away.


You can optionally includeon_payment_failureto tell Paddle how to handle failed payment when updating a subscription.


If omitted, this defaults toprevent_changemeaning that Paddle returns an error and doesn't apply subscription changes when payment fails.


How Paddle should handle changes made to a subscription or its items if the payment fails during update. If omitted, defaults toprevent_change.


#### Request

[Request](/build/subscriptions/add-remove-products-prices-addons#request-change-quantities)

This example includes two items. There's noquantityfor the first item, which already exists on the subscription. Its quantity won't be changed. The quantity for the second item has been increased to30from10.


It includesprorated_immediatelyas the billing mode, meaning Paddle calculates a prorated charge for the additional units and bills for it on the next renewal.


```json
1234567891011121{
2  "proration_billing_mode": "prorated_immediately",
3  "items": [
4    {
5      "price_id": "pri_01h1vjfevh5etwq3rb416a23h2"
6    },
7    {
8      "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
9      "quantity": 30
10    }
11  ]
12}
```


### Preview change

[Preview change](/build/subscriptions/add-remove-products-prices-addons#preview-change-quantities)

Send aPATCHrequest to the/subscriptions/{subscription_id}/previewendpoint with the request you built.


Paddle ID of the subscription entity to work with.


#### Response

[Response](/build/subscriptions/add-remove-products-prices-addons#response-preview-change-quantities)

If successful, Paddle returns a preview of the updated subscription entity.


Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


Previews includeimmediate_transaction,next_transaction, andrecurring_transaction_detailsthat give you information about upcoming transactions impacted as a result of this change. In this example,proration_billing_modeisprorated_immedidately, meaning Paddle calculates proration and charges immediately, detailedimmediate_transaction.


```json
177178179180181182183184185186187188189190191192193194195196177              "discount": "0",
178              "tax": "887",
179              "total": "10887"
180            }
181          }
182        ]
183      },
184      "adjustments": []
185    },
186    "immediate_transaction": {
187      "billing_period": {
188        "starts_at": "2023-08-22T08:28:31.678675268Z",
189        "ends_at": "2023-09-22T08:25:12.565118Z"
190      },
191      "details": {
192        "tax_rates_used": [
193          {
194            "tax_rate": "0.08875",
195            "totals": {
196              "subtotal": "89994",

```


### Update subscription

[Update subscription](/build/subscriptions/add-remove-products-prices-addons#post-change-quantities)

Send aPATCHrequest to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription to update.


#### Response

[Response](/build/subscriptions/add-remove-products-prices-addons#response-post-change-quantities)

If successful, Paddle returns a copy of the updated subscription entity.


Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01h3h3a9sfpr5syq38tq0sd4sp",
4    "status": "active",
5    "customer_id": "ctm_01h3h38xn5c2701bb5eecy9m6a",
6    "address_id": "add_01h3h38xqmv1xy0tjsnj0g1ke5",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-06-22T08:25:14.287455Z",
10    "updated_at": "2023-08-22T08:32:24.559129Z",
11    "started_at": "2023-06-22T08:25:12.565118Z",
12    "first_billed_at": "2023-06-22T08:25:12.565118Z",
13    "next_billed_at": "2023-09-22T08:25:12.565118Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "automatic",
17    "billing_details": null,
18    "current_billing_period": {
19      "starts_at": "2023-08-22T08:25:12.565118Z",
20      "ends_at": "2023-09-22T08:25:12.565118Z"

```


## Events

[Events](/build/subscriptions/add-remove-products-prices-addons#related-events)

| subscription.updated | Occurs when you update items on a subscription. |
| adjustment.created | Occurs when you choose a proration billing mode that prorates and bills for changes immediately. |
| transaction.created | Occurs when you choose a proration billing mode that bills the customer for changes immediately. |

[subscription.updated](/webhooks/subscriptions/subscription-updated)
[adjustment.created](/webhooks/adjustments/adjustment-created)
[transaction.created](/webhooks/transactions/transaction-created)

## Related pages

[Related pages](/build/subscriptions/add-remove-products-prices-addons#related-pages)
[Read more](/build/subscriptions/bill-add-one-time-charge)
[Read more](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[Read more](/concepts/subscriptions/proration)
- Add or remove items from a subscription
[Add or remove items from a subscription](#add-or-remove-items-from-a-subscription)
- How it works
[How it works](#background)
- Proration
[Proration](#background-proration)
- Related subscription changes
[Related subscription changes](#background-other-tasks)
- Before you begin
[Before you begin](#prerequisites)
- Get subscription and extract existing prices
[Get subscription and extract existing prices](#prerequisites-get-subscription)
- Add items to a subscription
[Add items to a subscription](#add-item)
- Remove items from a subscription
[Remove items from a subscription](#remove-items)
- Change quantities
[Change quantities](#change-quantities)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:14*
