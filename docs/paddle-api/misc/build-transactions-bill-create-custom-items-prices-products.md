# Bill for non-catalog items

**Source:** https://developer.paddle.com/build/transactions/bill-create-custom-items-prices-products

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

# Bill for non-catalog items

[Bill for non-catalog items](/build/transactions/bill-create-custom-items-prices-products#bill-for-non-catalog-items)

Charge for an item without adding it to your product catalog by passing price or product attributes when working with a transaction or a subscription.


As well as creating transactions for items inyour product catalog, you can create transactions for non-catalog items. This is useful for one-off or bespoke items that are specific to that transaction. For example, you may agree a custom price with an enterprise customer.

[your product catalog](/build/products/create-products-prices)

You may also like to bill for non-catalog items if you work with products where the price changes often, or where you need to manage your product catalog outside of Paddle. For example, games companies typically manage their product catalog centrally because they need to work with app stores.


## How it works

[How it works](/build/transactions/bill-create-custom-items-prices-products#background)

Transactionscalculate and capture revenue in Paddle. To bill for an item, you add it to a transaction. You can do this in two ways:

[Transactions](/api-reference/transactions/overview)

#### Using your product catalog

[Using your product catalog](/build/transactions/bill-create-custom-items-prices-products#background-catalog)

Create products and prices in Paddle, thenpass prices IDs to transactionsorPaddle.jsto bill for them.

[Create products and prices in Paddle](/build/products/create-products-prices)
[pass prices IDs to transactions](/build/transactions/create-transaction)
[Paddle.js](/build/checkout/pass-update-checkout-items)
- Manage items using the product catalog in Paddle.
- Items can be reused across transactions easily.
- Useful for companies who sell a set of digital products at the same price points.

For example:

- SaaS companies who sell subscription plans and addons. Prices mayvary by country, but items remain the same.
[vary by country](/build/products/offer-localized-pricing)
- Companies who sell a selection of digital products or software licenses where the items remain the same.

#### Billing for non-catalog items

[Billing for non-catalog items](/build/transactions/bill-create-custom-items-prices-products#background-custom)

Pass price and product attributes directly to atransaction when creating or updatingto bill for them.

[transaction when creating or updating](/build/transactions/create-transaction)
- Manage items using your own product database.
- Items are specific to a transaction.
- Useful for companies with lots of items, or where item prices may change a lot.

For example:

- Games companies who maintain a large catalog of items and may show different prices to different user segments.
- eBook retailers, where publishers set prices and they may change daily.

### How do non-catalog items relate to catalog items?

[How do non-catalog items relate to catalog items?](/build/transactions/bill-create-custom-items-prices-products#background-impact)

Acomplete productin Paddle is made up of aproduct entitythat describes the item, and arelated price entitythat describes how much and how often a product is billed.

[complete product](/build/products/create-products-prices)
[product entity](/api-reference/products/overview)
[related price entity](/api-reference/prices/overview)

You can add non-catalog items to a transaction where:

- Only the price is custom.This is great where the products you offer stay the same, but you might offer bespoke pricing from time to time. Your non-catalog price relates an existing catalog product entity in Paddle, sharing the same product name, image, and tax category.

Only the price is custom.


This is great where the products you offer stay the same, but you might offer bespoke pricing from time to time. Your non-catalog price relates an existing catalog product entity in Paddle, sharing the same product name, image, and tax category.

- Both the price and the product are custom.Where you manage your product catalog outside of Paddle, you can create entirely custom products. Your item uses a non-catalog price and a non-catalog product.

Both the price and the product are custom.


Where you manage your product catalog outside of Paddle, you can create entirely custom products. Your item uses a non-catalog price and a non-catalog product.


When youcreate or update a transactionwith non-catalog items, Paddle creates a price entity and (optionally) a related product entity. They have aPaddle IDas normal, meaning you can use theget a productorget a priceoperations to work with them, but they're not added to your product catalog.

[create or update a transaction](/build/transactions/create-transaction)
[Paddle ID](/api-reference/about/paddle-ids)
[get a product](/api-reference/products/get-product)
[get a price](/api-reference/prices/get-price)

This means they're not returned by default whenlisting productsorprices, and they're not shown in the Paddle dashboard.

[listing products](/api-reference/products/list-products)
[prices](/api-reference/prices/list-prices)

Non-catalog price and product entities have atypeofcustom, so you can differentiate between entities in your catalog.


### Subscriptions

[Subscriptions](/build/transactions/bill-create-custom-items-prices-products#background-subscriptions)

This guide walks through adding non-catalog items to transactions, but you can also:

- Bill one-time non-catalog items to a subscription
[Bill one-time non-catalog items to a subscription](/build/subscriptions/bill-add-one-time-charge)
- Update a subscription to add recurring non-catalog items
[Update a subscription to add recurring non-catalog items](/build/subscriptions/add-remove-products-prices-addons)

You can configure non-catalog items for a subscriptions in the same way as transactions.


## Before you begin

[Before you begin](/build/transactions/bill-create-custom-items-prices-products#prerequisites)

### Set your default payment link

[Set your default payment link](/build/transactions/bill-create-custom-items-prices-products#prerequisites-default-payment-link)

To create a transaction, you'll need to first:

- Set your default payment linkunderPaddle > Checkout > Checkout settings > Default payment link.
[Set your default payment link](/build/transactions/default-payment-link)
- Get your default payment link domain approved, if you're working with the live environment.
> We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go live.


We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go live.


## Bill for a non-catalog price for an existing product

[Bill for a non-catalog price for an existing product](/build/transactions/bill-create-custom-items-prices-products#custom-price)

You can add a non-catalog price for an existing product in your catalog to a transaction. In this case, the product a customer is purchasing is the same, but you have a specific price for it.


Add a custom price for a product to a transaction using the API in three steps:

1. Build requestBuild a request that includes a list of items, where your item includes a price object.

Build request

[Build request](/build/transactions/bill-create-custom-items-prices-products#build-request-custom-price)

Build a request that includes a list of items, where your item includes a price object.

1. Preview the transaction (optional)Preview the transaction. Paddle returns a preview of the transaction, including tax and localized pricing. You may like to present this information to a customer, depending on your workflow.

Preview the transaction (optional)

[Preview the transaction (optional)](/build/transactions/bill-create-custom-items-prices-products#preview-custom-price)

Preview the transaction. Paddle returns a preview of the transaction, including tax and localized pricing. You may like to present this information to a customer, depending on your workflow.

1. Create the transactionSend the request to create the transaction. Paddle creates it. Its status isdraftorreadydepending on the information you supplied.

Create the transaction

[Create the transaction](/build/transactions/bill-create-custom-items-prices-products#post-custom-price)

Send the request to create the transaction. Paddle creates it. Its status isdraftorreadydepending on the information you supplied.


### Build request

[Build request](/build/transactions/bill-create-custom-items-prices-products#build-request-custom-price)

Build an array ofitems, with an object containing apriceobject andquantityfor each item.


Relate your custom price to an existing product in your catalog by includingproduct_idwith the Paddle ID of a product entity.

> Recurring items on a transaction must have the same billing interval. For example, you can't have a transaction with some prices that are billed monthly and some products that are billed annually.


Recurring items on a transaction must have the same billing interval. For example, you can't have a transaction with some prices that are billed monthly and some products that are billed annually.


You may also include existing items by passing an object containing aprice_idandquantity.


If you like, you can include customer, address, and business information to create a transaction that's ready for billing.


For a full list of the fields you can send when creating a transaction, seeCreate a transaction

[Create a transaction](/build/transactions/create-transaction)

List of items to charge for.


Quantity of this item on the transaction.


Price object for a non-catalog item to charge for. Include aproduct_idto relate this non-catalog price to an existing catalog price.


#### Request

[Request](/build/transactions/bill-create-custom-items-prices-products#one-time-request-build-request-custom-price)

This example creates a draft transaction for a one-time non-catalog item. It's for an existing product, related using theproduct_idfield.


```json
12345678910111213141516171{
2  "items": [
3    {
4      "quantity": 1,
5      "price": {
6        "product_id": "pro_01he5kwnnvgdv2chtpgavk2rf8",
7        "description": "New user price (FTUE)",
8        "name": "Invigaron Berries welcome price",
9        "unit_price": {
10          "amount": "999",
11          "currency_code": "USD"
12        }
13      }
14    }
15  ],
16  "currency_code": "USD"
17}
```


#### Request

[Request](/build/transactions/bill-create-custom-items-prices-products#manual-invoice-request-build-request-custom-price)

This example creates a draft invoice for a 50-user enterprise plan. It's for an existing product, related using theproduct_idfield. It includes a customer and an address.


Collection mode ismanual, meaning this transaction is an invoice. Onceissued, Paddle sends an invoice to the customer for manual collection.

[issued](/build/invoices/create-issue-invoices)

```json
12345678910111213141516171819201{
2  "items": [
3    {
4      "quantity": 50,
5      "price": {
6        "product_id": "pro_01gsz4vmqbjk3x4vvtafffd540",
7        "description": "Globex annual 2024",
8        "name": "Annual (per seat) deal for Globex",
9        "billing_cycle": {
10          "interval": "year",
11          "frequency": 1
12        },
13        "unit_price": {
14          "amount": "50000",
15          "currency_code": "USD"
16        }
17      }
18    }
19  ],
20  "customer_id": "ctm_01h8441jn5pcwrfhwh78jqt8hk",

```


### Preview request

[Preview request](/build/transactions/bill-create-custom-items-prices-products#preview-custom-price)

Send aPOSTrequest to the/transactions/previewendpoint with the request you built.


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#one-time-response-preview-custom-price)

If successful, Paddle returns a preview of the new transaction entity.


```json
12345678910111213141516171819201{
2  "data": {
3    "customer_id": null,
4    "address_id": null,
5    "business_id": null,
6    "currency_code": "USD",
7    "address": null,
8    "customer_ip_address": null,
9    "discount_id": null,
10    "items": [
11      {
12        "price": {
13          "id": null,
14          "description": "New user price (FTUE)",
15          "type": "custom",
16          "name": "Invigaron Berries welcome price",
17          "product_id": "pro_01he5kwnnvgdv2chtpgavk2rf8",
18          "billing_cycle": null,
19          "trial_period": null,
20          "tax_mode": "account_setting",

```


### Send request

[Send request](/build/transactions/bill-create-custom-items-prices-products#post-custom-price)

Send aPOSTrequest to the/transactionsendpoint with the request you built.


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#one-time-response-send-request-custom-price)

If successful, Paddle responds with a copy of the new transaction entity.


The created transaction isdraft. You canpass this transaction to a checkoutto capture customer and address information, and collect for payment.

[pass this transaction to a checkout](/build/transactions/pass-transaction-checkout)

```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01hj3rtynv8rdn1zbcjk42z05j",
4    "status": "draft",
5    "customer_id": null,
6    "address_id": null,
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "automatic",
11    "subscription_id": null,
12    "invoice_id": null,
13    "invoice_number": null,
14    "billing_details": null,
15    "billing_period": null,
16    "currency_code": "USD",
17    "discount_id": null,
18    "created_at": "2023-12-20T14:07:25.454915616Z",
19    "updated_at": "2023-12-20T14:07:25.454915616Z",
20    "billed_at": null,

```


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#manual-invoice-response-send-request-custom-price)

If successful, Paddle responds with a copy of the new transaction entity.


The created invoice isready, since it includes all the required fields for it to be issued.Issue itto send it the customer.

[Issue it](/build/invoices/create-issue-invoices#issue-invoice)

```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01hj3ryktw234aj7s0wt5sp69g",
4    "status": "ready",
5    "customer_id": "ctm_01h8441jn5pcwrfhwh78jqt8hk",
6    "address_id": "add_01h848pep46enq8y372x7maj0p",
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "manual",
11    "subscription_id": null,
12    "invoice_id": null,
13    "invoice_number": null,
14    "billing_details": {
15      "enable_checkout": false,
16      "payment_terms": {
17        "interval": "day",
18        "frequency": 14
19      },
20      "purchase_order_number": "PO-2400",

```


## Bill for a non-catalog price and a non-catalog-product

[Bill for a non-catalog price and a non-catalog-product](/build/transactions/bill-create-custom-items-prices-products#custom-product)

You can add a non-catalog price for a non-catalog product in your catalog to a transaction. This is useful if you manage your product catalog outside of Paddle, or you want to sell something entirely bespoke.


Add a custom price for a custom product to a transaction using the API in three steps:

1. Build requestBuild a request that includes a list of items, where your item includes a price object with a product object.

Build request

[Build request](/build/transactions/bill-create-custom-items-prices-products#build-request-custom-product)

Build a request that includes a list of items, where your item includes a price object with a product object.

1. Preview your transaction (optional)Preview your transaction. Paddle returns a preview of the transaction, including tax and localized pricing. You may like to present this information to a customer, depending on your workflow.

Preview your transaction (optional)

[Preview your transaction (optional)](/build/transactions/bill-create-custom-items-prices-products#preview-custom-product)

Preview your transaction. Paddle returns a preview of the transaction, including tax and localized pricing. You may like to present this information to a customer, depending on your workflow.

1. Create your transactionSend the request to create your transaction. Paddle creates it. Its status isdraftorreadydepending on the information you supplied.

Create your transaction

[Create your transaction](/build/transactions/bill-create-custom-items-prices-products#post-custom-product)

Send the request to create your transaction. Paddle creates it. Its status isdraftorreadydepending on the information you supplied.


### Build request

[Build request](/build/transactions/bill-create-custom-items-prices-products#build-request-custom-product)

Build an array ofitems, with an object containing apriceobject andquantityfor each item.


Include aproductobject in yourpriceobject, with information about the product for this custom price.

> Recurring items on a transaction must have the same billing interval. For example, you can't have a transaction with some prices that are billed monthly and some products that are billed annually.


Recurring items on a transaction must have the same billing interval. For example, you can't have a transaction with some prices that are billed monthly and some products that are billed annually.


You may also include existing items by passing an object containing aprice_idandquantity.


If you like, you can include customer, address, and business information to create a transaction that's ready for billing.


For a full list of the fields you can send when creating a transaction, seeCreate a transaction

[Create a transaction](/build/transactions/create-transaction)

List of items to charge for.


Quantity of this item on the transaction.


Price object for a non-catalog item to charge for. Include aproductobject to create a non-catalog product for this non-catalog price.


#### Request

[Request](/build/transactions/bill-create-custom-items-prices-products#one-time-request-build-request-custom-product)

This example creates a ready transaction for a one-time non-catalog item. It's for a non-catalog product.


```json
12345678910111213141516171819201{
2  "items": [
3    {
4      "quantity": 1,
5      "price": {
6        "description": "New user price (FTUE)",
7        "name": "Welcome price",
8        "unit_price": {
9          "amount": "999",
10          "currency_code": "USD"
11        },
12        "product": {
13          "name": "Invigaron Berries Hoard",
14          "tax_category": "standard",
15          "description": "Start the game with 20 extra seconds play time!"
16        }
17      }
18    }
19  ],
20  "currency_code": "USD"

```


#### Request

[Request](/build/transactions/bill-create-custom-items-prices-products#recurring-request-build-request-custom-product)

This example creates a ready transaction for a recurring non-catalog item. It's for a non-catalog product.


```json
12345678910111213141516171819201{
2  "items": [
3    {
4      "quantity": 1,
5      "price": {
6        "description": "Battle pass",
7        "name": "Monthly",
8        "billing_cycle": {
9          "interval": "month",
10          "frequency": 1
11        },
12        "unit_price": {
13          "amount": "1099",
14          "currency_code": "USD"
15        },
16        "product": {
17          "name": "Invigaron VIP pass",
18          "tax_category": "standard",
19          "description": "Lock in 200x Invigaron Berries a month, plus faster gem spawns, exclusive skins, and early access to the leaderboard."
20        }

```


### Preview request

[Preview request](/build/transactions/bill-create-custom-items-prices-products#preview-custom-product)

Send aPOSTrequest to the/transactions/previewendpoint with the request you built.


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#one-time-response-preview-custom-product)

If successful, Paddle returns a preview of the new transaction entity.


```json
12345678910111213141516171819201{
2  "data": {
3    "customer_id": null,
4    "address_id": null,
5    "business_id": null,
6    "currency_code": "USD",
7    "address": null,
8    "customer_ip_address": null,
9    "discount_id": null,
10    "items": [
11      {
12        "price": {
13          "id": null,
14          "description": "New user price (FTUE)",
15          "type": "custom",
16          "name": "Welcome price",
17          "product_id": null,
18          "billing_cycle": null,
19          "trial_period": null,
20          "tax_mode": "account_setting",

```


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#recurring-response-preview-custom-product)

If successful, Paddle returns a preview of the new transaction entity.


```json
12345678910111213141516171819201{
2  "data": {
3    "customer_id": null,
4    "address_id": null,
5    "business_id": null,
6    "currency_code": "USD",
7    "address": null,
8    "customer_ip_address": null,
9    "discount_id": null,
10    "items": [
11      {
12        "price": {
13          "id": null,
14          "description": "Battle pass",
15          "type": "custom",
16          "name": "Monthly",
17          "product_id": null,
18          "billing_cycle": {
19            "interval": "month",
20            "frequency": 1

```


### Send request

[Send request](/build/transactions/bill-create-custom-items-prices-products#post-custom-product)

Send aPOSTrequest to the/transactionsendpoint with the request you built.


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#one-time-response-send-request-custom-price)

If successful, Paddle responds with a copy of the new transaction entity.


The created transaction isdraft. You canpass this transaction to a checkoutto capture customer and address information, and collect for payment.

[pass this transaction to a checkout](/build/transactions/pass-transaction-checkout)

```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01hj3s8yt41c6kaqm8rx9zfgtf",
4    "status": "draft",
5    "customer_id": null,
6    "address_id": null,
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "automatic",
11    "subscription_id": null,
12    "invoice_id": null,
13    "invoice_number": null,
14    "billing_details": null,
15    "billing_period": null,
16    "currency_code": "USD",
17    "discount_id": null,
18    "created_at": "2023-12-20T14:15:04.47996325Z",
19    "updated_at": "2023-12-20T14:15:04.47996325Z",
20    "billed_at": null,

```


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#recurring-response-send-request-custom-price)

If successful, Paddle responds with a copy of the new transaction entity.


The created transaction isdraft. You canpass this transaction to a checkoutto capture customer and address information, and collect for payment.

[pass this transaction to a checkout](/build/transactions/pass-transaction-checkout)

Paddle automatically creates a subscription for recurring items. Use webhooks toprovision your appand create a related record in your backend.

[provision your app](/build/subscriptions/provision-access-webhooks)

```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01hj3sct9my6jsx9zt55thzpfw",
4    "status": "draft",
5    "customer_id": null,
6    "address_id": null,
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "automatic",
11    "subscription_id": null,
12    "invoice_id": null,
13    "invoice_number": null,
14    "billing_details": null,
15    "billing_period": null,
16    "currency_code": "USD",
17    "discount_id": null,
18    "created_at": "2023-12-20T14:17:10.858871798Z",
19    "updated_at": "2023-12-20T14:17:10.858871798Z",
20    "billed_at": null,

```


## Update a non-catalog price or product

[Update a non-catalog price or product](/build/transactions/bill-create-custom-items-prices-products#update-custom-price)

Non-catalog products and prices are created for specific transactions. They're not considered part of your product catalog. You shouldn't ordinarily need to update them.


Non-catalog products and prices have Paddle IDs, so you can update them using theupdate a productorupdate a priceoperations if needed. For example, you might correct a spelling error in anameordescription— especially where an item is recurring.

[update a product](/api-reference/products/update-product)
[update a price](/api-reference/prices/update-price)

To learn more, seeCreate products and prices

[Create products and prices](/build/products/create-products-prices)

## Add a non-catalog item to your catalog

[Add a non-catalog item to your catalog](/build/transactions/bill-create-custom-items-prices-products#convert-custom-price)

If you find yourself adding similar non-catalog prices or products to transactions, you might like to add a custom item you've previously worked with to your product catalog.


We recommend that youcreate a new product or pricein your catalog where you're adding an item to your standard offering.

[create a new product or price](/build/products/create-products-prices)

You can also get an existing custom price or product using its ID, then change the type tostandard.


### Build request

[Build request](/build/transactions/bill-create-custom-items-prices-products#build-request-convert-custom-price)

Build a request that includes thetypeasstandard.


Thetypefield exists against both product and price entities.


Type of product or price. Standard products and prices are considered part of your product catalog and are shown on the Paddle dashboard.


#### Request

[Request](/build/transactions/bill-create-custom-items-prices-products#request-convert-custom-price)

```json
1231{
2  "type": "standard"
3}
```


### Send request

[Send request](/build/transactions/bill-create-custom-items-prices-products#patch-convert-custom-price)

Send aPATCHrequest to the/products/{product_id}endpoint or the/prices/{price_id}endpoint with the request you built.


Paddle ID of the product entity to work with.


Paddle ID of the price entity to work with.


#### Response

[Response](/build/transactions/bill-create-custom-items-prices-products#response-convert-custom-price)

If successful, Paddle returns a copy of the updated product or price entity. Thetypeisstandard, and it's now considered part of your product catalog.


```json
1234567891011121314151617181{
2  "data": {
3    "id": "pro_01hj3sctbh6r2hyga7qg29dznq",
4    "name": "Invigaron VIP pass",
5    "tax_category": "standard",
6    "type": "standard",
7    "description": "Lock in 200x Invigaron Berries a month, plus faster gem spawns, exclusive skins, and early access to the leaderboard.",
8    "image_url": null,
9    "custom_data": null,
10    "status": "active",
11    "import_meta": null,
12    "created_at": "2023-12-20T14:17:10.769Z",
13    "updated_at": "2023-12-20T14:18:35.093Z"
14  },
15  "meta": {
16    "request_id": "dc625fb7-38b8-47b5-8497-fe51e5c1a2e3"
17  }
18}
```


## Events

[Events](/build/transactions/bill-create-custom-items-prices-products#related-notifications)

| transaction.created | Occurs when a transaction is created initially. Other transaction events may follow, depending on the information included with your request. |
| price.created | Occurs when a custom price is created. |
| product.created | Occurs when a custom product is created. |

[transaction.created](/webhooks/transactions/transaction-created)
[price.created](/webhooks/prices/price-created)
[product.created](/webhooks/products/product-created)

## Related pages

[Related pages](/build/transactions/bill-create-custom-items-prices-products#related-pages)
[Read more](/build/transactions/create-transaction)
[Read more](/build/transactions/pass-transaction-checkout)
[Read more](/build/invoices/create-issue-invoices)
- Bill for non-catalog items
[Bill for non-catalog items](#bill-for-non-catalog-items)
- How it works
[How it works](#background)
- How do non-catalog items relate to catalog items?
[How do non-catalog items relate to catalog items?](#background-impact)
- Subscriptions
[Subscriptions](#background-subscriptions)
- Before you begin
[Before you begin](#prerequisites)
- Set your default payment link
[Set your default payment link](#prerequisites-default-payment-link)
- Bill for a non-catalog price for an existing product
[Bill for a non-catalog price for an existing product](#custom-price)
- Build request
[Build request](#build-request-custom-price)
- Preview request
[Preview request](#preview-custom-price)
- Send request
[Send request](#post-custom-price)
- Bill for a non-catalog price and a non-catalog-product
[Bill for a non-catalog price and a non-catalog-product](#custom-product)
- Build request
[Build request](#build-request-custom-product)
- Preview request
[Preview request](#preview-custom-product)
- Send request
[Send request](#post-custom-product)
- Update a non-catalog price or product
[Update a non-catalog price or product](#update-custom-price)
- Add a non-catalog item to your catalog
[Add a non-catalog item to your catalog](#convert-custom-price)
- Build request
[Build request](#build-request-convert-custom-price)
- Send request
[Send request](#patch-convert-custom-price)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:50*
