# Upgrade or downgrade

**Source:** https://developer.paddle.com/build/subscriptions/replace-products-prices-upgrade-downgrade

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

# Upgrade or downgrade

[Upgrade or downgrade](/build/subscriptions/replace-products-prices-upgrade-downgrade#upgrade-or-downgrade)

Upgrade or downgrade subscriptions by replacing items on a subscription.


Depending on your billing model, you might let customers upgrade or downgrade their plan. This could mean:

- Customers want to change their base plan, for example going from Pro to Enterprise
- Customers want to change their billing frequency, for example going from monthly to annual
> Add items for new users, modules, or other addonsAdding or removing users, modules, one-off fees, or other addons typically involves adding or removing items. For example, you might offer a module called "Advanced Reporting" across all plans. To learn more, seeAdd or remove items


#### Add items for new users, modules, or other addons

[Add items for new users, modules, or other addons](/build/subscriptions/replace-products-prices-upgrade-downgrade#add-items-for-new-users-modules-or-other-addons)

Adding or removing users, modules, one-off fees, or other addons typically involves adding or removing items. For example, you might offer a module called "Advanced Reporting" across all plans. To learn more, seeAdd or remove items

[Add or remove items](/build/subscriptions/add-remove-products-prices-addons)
> You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


You can't make changes to a subscription if the next billing period is within 30 minutes, or the subscription status ispast_due.


## How it works

[How it works](/build/subscriptions/replace-products-prices-upgrade-downgrade#background)

In Paddle, there's no rigid hierarchy of products. This means there's no formal distinction between products that you consider base plans and products that you consider addons.


When customers upgrade or downgrade, they're technically replacing items on their subscription. For example, if a customer moves from Pro to Enterprise, you'd remove the Pro product and replace it with the Enterprise one. You can do this in one API call, or on one screen in the Paddle dashboard.


Customers might also say that they're upgrading or downgrading when they change their billing frequency. For example, a customer might say that they'd like to "upgrade to the annual plan." In this case, you'd swap all monthly prices for annual prices.


When you make changes to items, you can determine how Paddle should bill for those changes. This is calledproration. Paddle's subscription billing engine calculates proration to the minute, allowing for precise billing.

[proration](/concepts/subscriptions/proration)
> Recurring items on a subscription must have the same billing interval. For example, you can't have a subscription with some prices that are billed monthly and some products that are billed annually.


Recurring items on a subscription must have the same billing interval. For example, you can't have a subscription with some prices that are billed monthly and some products that are billed annually.


## Get existing items

[Get existing items](/build/subscriptions/replace-products-prices-upgrade-downgrade#get-existing-items)

If you're working with the API, you'll need to get existing items on a subscription first.


This is because when updating subscription items, Paddle expects the complete list of items that you want to be on the subscription — including existing items. If you don't include an existing item, it's removed from the subscription.


Send aGETrequest to the/subscriptions/{subscription_id}endpoint.


Paddle ID of the subscription to get.


API


List subscriptions by making a GET request to the/subscriptionsendpoint.Work your way through the resultsto find the subscriptions that you want to work with.

[Work your way through the results](/api-reference/about/pagination)

Use thecustomer_idparameter to return only subscriptions for a specific customer.


Paddle ID of the customer to get subscriptions for.


Customers may have more than one subscription, so check the details of each returned subscription to find the one you want to pause.


Paddle dashboard


Head toPaddle > Customers, and find the customer whose subscription you want to change.


Find the subscription under the Subscriptions heading, then click theoverflow buttonbutton and chooseCopy IDfrom the menu.


### Response

[Response](/build/subscriptions/replace-products-prices-upgrade-downgrade#response)

Paddle returns the complete subscription entity for the ID you specified.


Extract the price IDs and quantities from thepriceobject for eachitemin the items array. Keep those for the next step.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01gvne45dvdhg5gdxrz6hh511r",
4    "status": "active",
5    "customer_id": "ctm_01gvcz30f4d77tfnn60snnyxfd",
6    "address_id": "add_01gvczbeepz72bfgsvbcmy1vpg",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-03-16T14:45:30.683934Z",
10    "updated_at": "2023-03-16T14:45:30.683934Z",
11    "started_at": "2023-03-16T14:45:30.683929Z",
12    "first_billed_at": "2023-03-16T14:45:30.683929Z",
13    "next_billed_at": "2023-04-16T14:45:30.683929Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "manual",
17    "billing_details": {
18      "enable_checkout": false,
19      "purchase_order_number": "",
20      "additional_information": "",

```


## Change base plan

[Change base plan](/build/subscriptions/replace-products-prices-upgrade-downgrade#change-base-plan)

Change the base plan when customers want to move from one plan to another. For example, from Pro to Enterprise.


You can choose anyproration billing mode.

[proration billing mode](/concepts/subscriptions/proration)

Build a request that includes an array of price IDs. Remove the price ID for the existing base plan, then add:

- Existing items that you want to keep on the subscription, like any addons.
- The price ID for the new base plan.

API


List prices by making a GET request to the/pricesendpoint.Work your way through the resultsto find the price that you'd like to work with.

[Work your way through the results](/api-reference/about/pagination)

Paddle dashboard


Head toPaddle > Catalog > Products, click on a product in the list, then click the…menu next to a price and chooseCopy ID.


Send a PATCH request to the/subscriptions/{subscription_id}endpoint that includes the newitemsarray.


Paddle ID of the subscription to update.


### Request

[Request](/build/subscriptions/replace-products-prices-upgrade-downgrade#request)

In the request:

- Includeproration_billing_modeto tell Paddle how to handle billing for changes.
- itemsshould include aprice_idandquantityfor each item.
- New items must include aquantity.
- You may omitquantityfor existing items if you're not making changes.
- Optionally includeon_payment_failureto tell Paddle how to handle this change if payment fails.

```json
1234567891{
2  "proration_billing_mode": "prorated_immediately",
3  "items": [
4    {
5      "price_id": "pri_01gvne87kv8vbqa9jkfbmgtsed",
6      "quantity": 1
7    }
8  ]
9}
```


### Response

[Response](/build/subscriptions/replace-products-prices-upgrade-downgrade#response)

If successful, Paddle returns a copy of the updated subscription entity. Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01gvne45dvdhg5gdxrz6hh511r",
4    "status": "active",
5    "customer_id": "ctm_01gvcz30f4d77tfnn60snnyxfd",
6    "address_id": "add_01gvczbeepz72bfgsvbcmy1vpg",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-03-16T14:45:30.683934Z",
10    "updated_at": "2023-03-16T14:45:30.683934Z",
11    "started_at": "2023-03-16T14:45:30.683929Z",
12    "first_billed_at": "2023-03-16T14:45:30.683929Z",
13    "next_billed_at": "2023-04-16T14:45:30.683929Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "manual",
17    "billing_details": {
18      "enable_checkout": false,
19      "purchase_order_number": "",
20      "additional_information": "",

```


## Change billing frequency

[Change billing frequency](/build/subscriptions/replace-products-prices-upgrade-downgrade#change-billing-frequency)

Change the billing frequency when customers want to change from paying in one interval to another. For example, from monthly to annually.


When you change billing frequency, you may need to replace multiple items — including addons — so they all have the same frequency. For example, if customers can purchase a Premium Support addon for $200 a month, replace this with a price for Premium Support that bills yearly when moving to an annual base plan.


You can useprorated_immediately,full_immediately, anddo_not_billwhenchanging billing frequency.

[changing billing frequency](/concepts/subscriptions/proration)

Build a request that includes an array of price IDs. Remove the price ID for the existing base plan and any recurring addons, then add:

- Existing items that you want to keep on the subscription, like one-time charges.
- The price ID for the new base plan.
- The price IDs for any new addons.

API


List prices by making a GET request to the/pricesendpoint.Work your way through the resultsto find the price that you'd like to work with.

[Work your way through the results](/api-reference/about/pagination)

Paddle dashboard


Head toPaddle > Catalog > Products, click on a product in the list, then click the…menu next to a price and chooseCopy ID.


Send a PATCH request to the/subscriptions/{subscription_id}endpoint that includes the newitemsarray.


Paddle ID of the subscription to update.


### Request

[Request](/build/subscriptions/replace-products-prices-upgrade-downgrade#request)

In the request:

- Includeproration_billing_modeto tell Paddle how to handle billing for changes.
- itemsshould include aprice_idandquantityfor each item.
- New items must include aquantity.
- You may omitquantityfor existing items if you're not making changes.
- Optionally includeon_payment_failureto tell Paddle how to handle this change if payment fails.

```json
1234567891{
2  "proration_billing_mode": "prorated_immediately",
3  "items": [
4    {
5      "price_id": "pro_01gsz4vmqbjk3x4vvtafffd540",
6      "quantity": 1
7    }
8  ]
9}
```


### Response

[Response](/build/subscriptions/replace-products-prices-upgrade-downgrade#response)

If successful, Paddle returns a copy of the updated subscription entity. Theitemslist contains complete objects for items on the subscription, including billing information and information about the related price.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "sub_01gvne45dvdhg5gdxrz6hh511r",
4    "status": "active",
5    "customer_id": "ctm_01gvcz30f4d77tfnn60snnyxfd",
6    "address_id": "add_01gvczbeepz72bfgsvbcmy1vpg",
7    "business_id": null,
8    "currency_code": "USD",
9    "created_at": "2023-03-16T14:45:30.683934Z",
10    "updated_at": "2023-03-16T14:45:30.683934Z",
11    "started_at": "2023-03-16T14:45:30.683929Z",
12    "first_billed_at": "2023-03-16T14:45:30.683929Z",
13    "next_billed_at": "2023-04-16T14:45:30.683929Z",
14    "paused_at": null,
15    "canceled_at": null,
16    "collection_mode": "manual",
17    "billing_details": {
18      "enable_checkout": false,
19      "purchase_order_number": "",
20      "additional_information": "",

```


## Events

[Events](/build/subscriptions/replace-products-prices-upgrade-downgrade#related-notifications)

| subscription.updated | Occurs when you update items on a subscription. |
| transaction.created | Occurs when you choose a proration billing mode that bills the customer for changes. |

- Upgrade or downgrade
[Upgrade or downgrade](#upgrade-or-downgrade)
- How it works
[How it works](#background)
- Get existing items
[Get existing items](#get-existing-items)
- Response
[Response](#response)
- Change base plan
[Change base plan](#change-base-plan)
- Change billing frequency
[Change billing frequency](#change-billing-frequency)
- Events
[Events](#related-notifications)

---

*Last scraped: 2025-12-15 20:18:02*
