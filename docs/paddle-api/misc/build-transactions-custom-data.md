# Work with custom data

**Source:** https://developer.paddle.com/build/transactions/custom-data

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

# Work with custom data

[Work with custom data](/build/transactions/custom-data#work-with-custom-data)

Include your own custom information when working with checkouts and some entities in the Paddle API. Great for storing metadata or other useful information when working with third-party solutions.


Custom data lets you add your own key-value data to subscriptions, transactions, and some other entities in the Paddle API created using Paddle Checkout or the API.


You can use custom data for things like:

- Capturing UTM source or marketing campaign information
- Storing metadata or other useful information for third-party integrations

## How it works

[How it works](/build/transactions/custom-data#background)

You can add custom data totransactionsandsubscriptionsusing the API orPaddle.js. Both entities have acustom_dataobject against them, which accepts valid key-value JSON data.

[transactions](/api-reference/transactions/overview)
[subscriptions](/api-reference/transactions/overview)
[Paddle.js](/paddlejs/overview)
`custom_data`

When working with a checkout, you can pass custom data in a similar way toprefilling properties. Any custom data is held against the related transaction.

[prefilling properties](/build/checkout/prefill-checkout-properties)

Paddle shares custom data between transactions and subscriptions:

- Paddle automatically creates a subscription for transactions with recurring prices on them. Where a transaction has custom data against it, that data is copied to the created subscription for your reference.
- Where a subscription has custom data against it, that data is copied to any transactions created from it for things like renewals, upgrades and downgrades, and one-time charges.
> We recommend against nesting custom data. Though there's no limitations on having objects inside thecustom_dataobject, you might find this information isn't displayed in the Paddle dashboard correctly.


We recommend against nesting custom data. Though there's no limitations on having objects inside thecustom_dataobject, you might find this information isn't displayed in the Paddle dashboard correctly.


## Before you begin

[Before you begin](/build/transactions/custom-data#prerequisites)

To pass custom data to a checkout, you'll need to use Paddle.js to build a checkout:

- Build an overlay checkout
[Build an overlay checkout](/build/checkout/build-overlay-checkout)
- Build an inline checkout
[Build an inline checkout](/build/checkout/build-branded-inline-checkout)

You'll need to createproducts and pricesto add them to a checkout or transaction.

[products and prices](/build/products/create-products-prices)

If you're working with the API, you'll needa customeranda related address. Checkout automatically creates customers and addresses for you as part of the journey.

[a customer](/build/customers/create-update-customers)
[a related address](/build/customers/create-update-customers)

## Pass custom data to checkout

[Pass custom data to checkout](/build/transactions/custom-data#pass-custom-data-to-checkout)

Pass custom data to a checkout using an HTML data attribute or JavaScript property.


Add adata-custom-dataHTML attribute to your checkout launcher to add custom data to the created transaction.


```html
12345678910111213141516171819201<a 
2  href='#' 
3  class='paddle_button'
4  data-theme='light'
5  data-custom-data='{
6    "utm_medium": "social",
7    "utm_source": "linkedin",
8    "utm_content": "launch-video",
9    "integration_id": "AA-123"
10  }'
11  data-customer-address-country-code='US'
12  data-customer-email='weloveyourproduct@paddle.com'
13  data-items='[
14    {
15      "priceId": "pri_01gs59hve0hrz6nyybj56z04eq",
16      "quantity": 1
17    },
18    {
19      "priceId": "pri_01gs59p7rcxmzab2dm3gfqq00a",
20      "quantity": 1

```


For a full list of HTML data attributes, seeHTML data attributes

[HTML data attributes](/paddlejs/html-data-attributes)

## Add custom data to a transaction

[Add custom data to a transaction](/build/transactions/custom-data#add-custom-data-to-a-transaction)

You can add custom data when creating or updating a transaction. You might do this when setting up a transaction to pass to a checkout, orwhen working with an invoice (a manually-collected transaction).

[when working with an invoice (a manually-collected transaction)](/build/invoices/create-issue-invoices)

To create, send a POST request to the/transactionsendpoint, including a JSON object ofcustom_data.


To update, send a PATCH request to the/transactions/{transaction_id}endpoint, including a JSON object ofcustom_data.


Paddle ID of the transaction entity to work with.


### Request

[Request](/build/transactions/custom-data#request-txn-custom-data)

This example adds UTM information to new automatically-collected transaction.


```json
12345678910111213141516171{
2  "items": [
3    {
4      "quantity": 10,
5      "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke"
6    }
7  ],
8  "customer_id": "ctm_01gywfmzk8038netxxbhk80vwe",
9  "address_id": "add_01gywfmzn2dwxry2rhry1b5gj4",
10  "custom_data": {
11    "utm_source": "crm",
12    "utm_medium": "email",
13    "utm_content": "closed-deal",
14    "integration_id": "AA-123"
15  },
16  "collection_mode": "automatic"
17}
```


### Response

[Response](/build/transactions/custom-data#response-txn-custom-data)

If successful, Paddle responds with the complete transaction entity includingcustom_data.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01gyyw3j6khyc2fpy3ttapzf9v",
4    "status": "ready",
5    "customer_id": "ctm_01gywfmzk8038netxxbhk80vwe",
6    "address_id": "add_01gywfmzn2dwxry2rhry1b5gj4",
7    "business_id": null,
8    "custom_data": {
9      "utm_source": "crm",
10      "utm_medium": "email",
11      "utm_content": "closed-deal",
12      "integration_id": "AA-123"
13    },
14    "origin": "api",
15    "collection_mode": "automatic",
16    "subscription_id": null,
17    "invoice_id": null,
18    "invoice_number": null,
19    "billing_details": null,
20    "billing_period": null,

```


## Get custom data

[Get custom data](/build/transactions/custom-data#get-custom-data)

Once added to a transaction, you can see custom data:

- In the Paddle dashboard against a transaction
- Using the API by gettinga transaction entity
[a transaction entity](/api-reference/transactions/overview)
- In webhooks fortransaction events
[transaction events](/webhooks/transactions/transaction-created)

If a transaction creates a new subscription, the custom data is copied to the new subscription. You can see it against the subscription in the Paddle dashboard or when working witha subscription entityusing the API.

[a subscription entity](/api-reference/subscriptions/overview)

Send a GET request to the/transactions/{transaction_id}endpoint.


Paddle ID of the transaction entity to work with.


### Response

[Response](/build/transactions/custom-data#response-get-custom-data)

If successful, Paddle responds with the complete transaction entity includingcustom_data.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01gyyw3j6khyc2fpy3ttapzf9v",
4    "status": "ready",
5    "customer_id": "ctm_01gywfmzk8038netxxbhk80vwe",
6    "address_id": "add_01gywfmzn2dwxry2rhry1b5gj4",
7    "business_id": null,
8    "custom_data": {
9      "utm_source": "crm",
10      "utm_medium": "email",
11      "utm_content": "closed-deal",
12      "integration_id": "AA-123"
13    },
14    "origin": "api",
15    "collection_mode": "automatic",
16    "subscription_id": null,
17    "invoice_id": null,
18    "invoice_number": null,
19    "billing_details": null,
20    "billing_period": null,

```


## Update or remove custom data

[Update or remove custom data](/build/transactions/custom-data#update-or-remove-custom-data)

You can update or remove custom data against a transaction or subscription using the API.

> Transactions are financial records. You can't edit them if they're billed, canceled, or completed.


Transactions are financial records. You can't edit them if they're billed, canceled, or completed.


To update, send a PATCH request to the/transactions/{transaction_id}endpoint, including a JSON object ofcustom_data.


Paddle ID of the transaction entity to work with.


### Request

[Request](/build/transactions/custom-data#request-txn-update-custom-data)

```json
123451{
2  "custom_data": {
3    "integration_id": "BB-456"
4  }
5}
```


### Remove custom data

[Remove custom data](/build/transactions/custom-data#remove-custom-data)

To remove custom data, setcustom_datatonullwhen updating.


```json
1231{
2  "custom_data": null
3}
```


## Related pages

[Related pages](/build/transactions/custom-data#related-pages)
[Read more](/build/checkout/prefill-checkout-properties)
[Read more](/api-reference/transactions/overview)
- Work with custom data
[Work with custom data](#work-with-custom-data)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Pass custom data to checkout
[Pass custom data to checkout](#pass-custom-data-to-checkout)
- Add custom data to a transaction
[Add custom data to a transaction](#add-custom-data-to-a-transaction)
- Request
[Request](#request-txn-custom-data)
- Response
[Response](#response-txn-custom-data)
- Get custom data
[Get custom data](#get-custom-data)
- Update or remove custom data
[Update or remove custom data](#update-or-remove-custom-data)
- Remove custom data
[Remove custom data](#remove-custom-data)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:48*
