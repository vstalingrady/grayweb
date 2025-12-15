# Create a transaction

**Source:** https://developer.paddle.com/build/transactions/create-transaction

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

# Create a transaction

[Create a transaction](/build/transactions/create-transaction#create-a-transaction)

Transactions are the central billing entity in Paddle. Create a transaction to collect using checkout or invoice. Paddle automatically creates transactions for subscription lifecycle events.


All purchases aretransactions. They hold all the information about a customer purchase, including customer details, items, calculated tax and localized pricing, and payments.

[transactions](/api-reference/transactions/overview)

Paddle automatically creates transactions for subscription lifecycle events and when checkouts are opened, but you can create your own transactions using the API or Paddle dashboard.


## How it works

[How it works](/build/transactions/create-transaction#background)

Transactionsare at the heart of Paddle. They tie together products, prices, and discounts with customers to calculate and capture revenue for checkouts, invoices, and subscriptions.

[Transactions](/api-reference/transactions/overview)

All revenue in Paddle is calculated and captured using transactions. Paddle creates transactions automatically for subscription lifecycle events and when checkouts are opened, and you may also create your own transactions using the API or Paddle dashboard.


### Transaction lifecycle

[Transaction lifecycle](/build/transactions/create-transaction#background-lifecycle)

Transactions are initially created asdraftorready, depending on the information supplied. As you work with a transaction entity, they move tocompleted:

1. Draftdrafttransactions are missing required fields for billing. Checkouts opened byPaddle.jswith only items createdrafttransactions, since they're missing customer and address information initially.

Draft


drafttransactions are missing required fields for billing. Checkouts opened byPaddle.jswith only items createdrafttransactions, since they're missing customer and address information initially.

[Paddle.js](/paddlejs/overview)
1. ReadyTransactions arereadywhen they have all the required fields for billing. When Paddle Checkout captures customer name, country, and (in some regions) ZIP or postal code, then transactions move toready.

Ready


Transactions arereadywhen they have all the required fields for billing. When Paddle Checkout captures customer name, country, and (in some regions) ZIP or postal code, then transactions move toready.

1. BilledYou may optionally mark a transaction asbilled. At this point, it's considered a financial record and can't be changed. This is typically used as part ofan invoicing workflow to issue an invoice, or toprevent a customer from changing items or quantitiesat checkout.

Billed


You may optionally mark a transaction asbilled. At this point, it's considered a financial record and can't be changed. This is typically used as part ofan invoicing workflow to issue an invoice, or toprevent a customer from changing items or quantitiesat checkout.

[an invoicing workflow to issue an invoice](/build/invoices/create-issue-invoices)
[prevent a customer from changing items or quantities](/build/checkout/pass-update-checkout-items#prevent-changes-to-items-on-a-checkout)
1. PaidWhen Paddle collects payment successfully, transactions are automaticallypaid. This is an interim status while completed transaction processing happens. Paddle updates the transaction with information about fees, earnings, and totals for payouts. It also adds the relatedsubscription_idandinvoice_numberfor automatically-collected transactions.Completed transaction processing often takes less than a second, so you won't typically encounter transactions that arepaidwhen working with the API.

Paid


When Paddle collects payment successfully, transactions are automaticallypaid. This is an interim status while completed transaction processing happens. Paddle updates the transaction with information about fees, earnings, and totals for payouts. It also adds the relatedsubscription_idandinvoice_numberfor automatically-collected transactions.

> Completed transaction processing often takes less than a second, so you won't typically encounter transactions that arepaidwhen working with the API.


Completed transaction processing often takes less than a second, so you won't typically encounter transactions that arepaidwhen working with the API.

1. CompletedAfter all transaction processing is completed, transactions are automaticallycompleted.

Completed


After all transaction processing is completed, transactions are automaticallycompleted.


Paddle automatically sets transactions asdraft,ready,paid, andcompleted. You can set transactions asbilledorcanceledusing the API.

> This guide focuses on creatingautomatically-collected transactions. You can alsocreate manually-collected transactions, meaning Paddle sends an invoice document that must be paid manually.


This guide focuses on creatingautomatically-collected transactions. You can alsocreate manually-collected transactions, meaning Paddle sends an invoice document that must be paid manually.

[create manually-collected transactions](/build/invoices/create-issue-invoices)

## Before you begin

[Before you begin](/build/transactions/create-transaction#prerequisites)

### Set your default payment link

[Set your default payment link](/build/transactions/create-transaction#prerequisites-default-payment-link)

Before creating a transaction, you'll need to:

- Set your default payment linkunderPaddle > Checkout > Checkout settings > Default payment link.
[Set your default payment link](/build/transactions/default-payment-link)
- Get your default payment link domain approved, if you're working with the live environment.
> We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go live.


We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go live.


### Create customers

[Create customers](/build/transactions/create-transaction#prerequisites-customers)

If you're working with the Paddle dashboard, you can create all the entities that you'll be working with as you create a transaction.


If you're working with the API, you'll need to:

- Create a customeranda related address
[Create a customer](/build/customers/create-update-customers#create-customer)
[a related address](/build/customers/create-update-customers#create-address)
- Optionally createa related business
[a related business](/build/customers/create-update-customers#create-business)

### Create products and prices

[Create products and prices](/build/transactions/create-transaction#prerequisites-catalog)

Transactions work with products and prices to say what a customer is purchasing. You can create a transaction for items from your catalog, ornon-catalog itemsfor one-off or bespoke items.

[non-catalog items](/build/transactions/bill-create-custom-items-prices-products)

To bill for an item in your catalog,create a product and a related price.

[create a product and a related price](/build/products/create-products-prices)

## Create a draft or ready transaction

[Create a draft or ready transaction](/build/transactions/create-transaction#create-draft-transaction)

Draft transactions contain anitemslist, but don't include address or customer details which are required for billing. Ready transactions contain anitemslist and all required fields for billing, including address and customer details.


You maypass a draft or ready transaction to a checkoutto capture customer or address information, and collect for payment.

[pass a draft or ready transaction to a checkout](/build/transactions/pass-transaction-checkout)

Create a draft or transaction using the API in three steps:

1. Build requestBuild a request with information about who a transaction is for and what they're purchasing.

Build request

[Build request](/build/transactions/create-transaction#build-request-create-draft)

Build a request with information about who a transaction is for and what they're purchasing.

1. Preview the transaction (optional)Preview the transaction. Paddle returns a preview of the transaction, including tax and localized pricing. You may like to present this information to a customer, depending on your workflow.

Preview the transaction (optional)

[Preview the transaction (optional)](/build/transactions/create-transaction#preview-request-draft)

Preview the transaction. Paddle returns a preview of the transaction, including tax and localized pricing. You may like to present this information to a customer, depending on your workflow.

1. Create the transactionSend the request to create the transaction. Paddle creates it. Its status isdraftorreadydepending on the information you supplied.

Create the transaction

[Create the transaction](/build/transactions/create-transaction#post-create-draft)

Send the request to create the transaction. Paddle creates it. Its status isdraftorreadydepending on the information you supplied.


### Build request

[Build request](/build/transactions/create-transaction#build-request-create-draft)

Build an array ofitems, with an object containing either:

- An item from your catalogInclude a price ID and quantity for each item.

An item from your catalog


Include a price ID and quantity for each item.

- A non-catalog itemInclude a price object and quantity for each item.

A non-catalog item


Include a price object and quantity for each item.


Non-catalog items are one-off or bespoke items that are specific to that transaction. To learn more, seeBill for non-catalog items

[Bill for non-catalog items](/build/transactions/bill-create-custom-items-prices-products)
> Recurring items on a transaction must have the same billing interval. For example, you can't have a transaction with some prices that are billed monthly and some products that are billed annually.


Recurring items on a transaction must have the same billing interval. For example, you can't have a transaction with some prices that are billed monthly and some products that are billed annually.


List of items to charge for.


Quantity of this item on the transaction.


Paddle ID of an existing catalog price to add to this transaction, prefixed withpri_.


List of items to charge for.


Price object for a non-catalog item to charge for. Include aproduct_idto relate this non-catalog price to an existing catalog price.


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


Quantity of this item on the transaction.


Includecustomer_idandaddress_idto say who this invoice is for.


If you're working with a business, includebusiness_idtoo.


Transactions are automatically marked asreadywhen they havecustomer_id,address_id, anditems. This means that they're ready to be issued (marked asbilled).


Paddle ID of the customer that this invoice is for, prefixed withctm_.


Paddle ID of the address that this invoice is for, prefixed withadd_.


Paddle ID of the business that this invoice is for, prefixed withbiz_.


#### Request

[Request](/build/transactions/create-transaction#draft-build-request-draft)

```json
123456781{
2  "items": [
3    {
4      "quantity": 10,
5      "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke"
6    }
7  ]
8}
```


#### Request

[Request](/build/transactions/create-transaction#ready-build-request-ready)

```json
123456789101{
2  "items": [
3    {
4      "quantity": 10,
5      "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke"
6    }
7  ],
8  "customer_id": "ctm_01h8441jn5pcwrfhwh78jqt8hk",
9  "address_id": "add_01h848pep46enq8y372x7maj0p"
10}
```


### Preview request

[Preview request](/build/transactions/create-transaction#preview-request-draft)

Send aPOSTrequest to the/transactions/previewendpoint with the request you built.


#### Response

[Response](/build/transactions/create-transaction#draft-preview-request-draft)

If successful, Paddle returns a preview of the new transaction entity.


There are no calculated taxes, since Paddle doesn't have address information.


```json
12345678910111213141516171819201{
2  "data": {
3    "customer_id": null,
4    "address_id": null,
5    "business_id": null,
6    "subscription_id": null,
7    "currency_code": "USD",
8    "address": null,
9    "customer_ip_address": null,
10    "discount_id": null,
11    "items": [
12      {
13        "price": {
14          "id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
15          "description": "Monthly (per seat)",
16          "name": "Monthly (per seat)",
17          "product_id": "pro_01gsz4t5hdjse780zja8vvr7jg",
18          "billing_cycle": {
19            "interval": "month",
20            "frequency": 1

```


#### Response

[Response](/build/transactions/create-transaction#ready-preview-request-ready)

If successful, Paddle returns a preview of the new transaction entity.


```json
12345678910111213141516171819201{
2  "data": {
3    "customer_id": "ctm_01h8441jn5pcwrfhwh78jqt8hk",
4    "address_id": "add_01h848pep46enq8y372x7maj0p",
5    "business_id": null,
6    "subscription_id": null,
7    "currency_code": "USD",
8    "address": {
9      "postal_code": "10021",
10      "country_code": "US"
11    },
12    "customer_ip_address": null,
13    "discount_id": null,
14    "items": [
15      {
16        "price": {
17          "id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
18          "description": "Monthly (per seat)",
19          "name": "Monthly (per seat)",
20          "product_id": "pro_01gsz4t5hdjse780zja8vvr7jg",

```


### Send request

[Send request](/build/transactions/create-transaction#post-create-draft)

Send aPOSTrequest to the/transactionsendpoint with the request you built.


#### Response

[Response](/build/transactions/create-transaction#draft-post-request-draft)

If successful, Paddle responds with a copy of the new transaction entity with the status ofdraft.


The new transaction hascollection_modeasautomatic, which means Paddle collects automatically using a saved payment method. If no payment method is saved, you canpass this transaction to Paddle.jsto open a checkout for it.

[pass this transaction to Paddle.js](/build/transactions/pass-transaction-checkout)

There are no calculated taxes, since Paddle doesn't have address information.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01hgk4aer7mejqsgzs8bgvp1ke",
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
18    "created_at": "2023-12-01T16:45:20.594624214Z",
19    "updated_at": "2023-12-01T16:45:20.594624214Z",
20    "billed_at": null,

```


#### Response

[Response](/build/transactions/create-transaction#ready-post-request-ready)

If successful, Paddle responds with a copy of the new transaction entity with the status ofready.


The new transaction hascollection_modeasautomatic, which means Paddle collects automatically using a saved payment method. If no payment method is saved, you canpass this transaction to Paddle.jsto open a checkout for it.

[pass this transaction to Paddle.js](/build/transactions/pass-transaction-checkout)

```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01hgk505qdyvbrmhpp14b97jgz",
4    "status": "ready",
5    "customer_id": "ctm_01h8441jn5pcwrfhwh78jqt8hk",
6    "address_id": "add_01h848pep46enq8y372x7maj0p",
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
18    "created_at": "2023-12-01T16:57:12.591685111Z",
19    "updated_at": "2023-12-01T16:57:12.591685111Z",
20    "billed_at": null,

```


## Update a transaction

[Update a transaction](/build/transactions/create-transaction#update-transaction)

While a transaction isdraftorready, you can make changes to it and the items on it. You can work with items,apply a discount, change customer information, oradd or remove custom data.

[apply a discount](/build/products/offer-discounts-promotions-coupons#apply-discount)
[add or remove custom data](/build/transactions/custom-data)

If you're working with adrafttransaction, Paddle automatically marks it asreadywhen you addcustomer_idandaddress_id.

> Transactions are financial records. You can't edit them if they're billed, canceled, or completed.Cancel a transactionand create another orcreate an adjustmentif you need to make changes to a billed or completed transaction.


Transactions are financial records. You can't edit them if they're billed, canceled, or completed.Cancel a transactionand create another orcreate an adjustmentif you need to make changes to a billed or completed transaction.

[Cancel a transaction](/build/invoices/cancel-invoices)
[create an adjustment](/build/transactions/create-transaction-adjustments)

Update a transaction using the API in two steps:

1. Build requestBuild a request with information about who a transaction is for and what they're purchasing. If you're adding new items, your request should include any existing items that you want to keep.

Build request

[Build request](/build/transactions/create-transaction#build-request-update-transaction)

Build a request with information about who a transaction is for and what they're purchasing. If you're adding new items, your request should include any existing items that you want to keep.

1. Update your invoiceSend the request to update the transaction. Paddle updates it.

Update your invoice

[Update your invoice](/build/transactions/create-transaction#patch-update-transaction)

Send the request to update the transaction. Paddle updates it.


### Build request

[Build request](/build/transactions/create-transaction#build-request-update-transaction)

Build a request with any data that you want to change. You can change any writeable fields at this point, including address, customer, and items.


When working withitems, you should send the complete list of items that you want to be against your invoice — including any existing items. If you omit an item, it's removed from the items list. To learn more, seeWork with lists

[Work with lists](/api-reference/about/lists)

#### Request

[Request](/build/transactions/create-transaction#request-build-request-update-transaction)

This example adds a discount to a transaction. Apply a discount by includingdiscount_idin your request.


```json
1231{
2  "discount_id": "dsc_01gy7qp5pqhnyd22yspwane77h"
3}
```


### Send request

[Send request](/build/transactions/create-transaction#patch-update-transaction)

Send aPATCHrequest to the/transactions/{transaction_id}endpoint.


Paddle ID of the transaction entity to work with.


#### Response

[Response](/build/transactions/create-transaction#request-patch-update-transaction)

If successful, Paddle responds with a copy of the updated transaction entity.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01gzkcdstcwq4cj8waj812v9my",
4    "status": "ready",
5    "customer_id": "ctm_01gzgmxdmgkgc7p94b5kgqq82p",
6    "address_id": "add_01gzkce0amtjsqv8xxd1rv3dna",
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "automatic",
11    "subscription_id": null,
12    "invoice_id": null,
13    "invoice_number": null,
14    "billing_details": null,
15    "billing_period": null,
16    "currency_code": "GBP",
17    "discount_id": "dsc_01gy7qp5pqhnyd22yspwane77h",
18    "created_at": "2025-05-04T12:40:07.834144Z",
19    "updated_at": "2025-05-18T13:59:56.611406607Z",
20    "billed_at": null,

```


## Change collection mode

[Change collection mode](/build/transactions/create-transaction#change-collection-mode)

While a transaction isdraftorready, you can switch between automatic and manual collection modes.


To learn more, seeChange transaction collection mode

[Change transaction collection mode](/build/transactions/change-collection-mode-transaction)

## Mark a transaction as billed

[Mark a transaction as billed](/build/transactions/create-transaction#create-billed-transaction)

You can mark a transaction asbilledusing the API to say it's finalized, meaning it's considered a financial record and can't be changed.


This is typically used formanually-collected transactions (invoices), as part of an invoicing workflow. Marking a transaction as billed is the same as issuing an invoice. It gets an invoice number and is sent to the customer.

[manually-collected transactions (invoices)](/build/invoices/create-issue-invoices)

You don't need to mark an automatically-collected transaction asbilled, and it's not typically part of a self-service workflow. However, you may like to do this if you plan to create a checkout for this transaction toprevent a customer from changing items or quantities at checkout.

[prevent a customer from changing items or quantities at checkout](/build/checkout/pass-update-checkout-items#prevent-changes-to-items-on-a-checkout)

To learn more, seeIssue an invoice

[Issue an invoice](/build/invoices/create-issue-invoices#issue-invoice)
> You can create a transaction and mark it asbilledby including"status": "billed"in your initial request, along with the other required fields — no need to make a separate request.


You can create a transaction and mark it asbilledby including"status": "billed"in your initial request, along with the other required fields — no need to make a separate request.


## Pass a transaction to a checkout

[Pass a transaction to a checkout](/build/transactions/create-transaction#pass-transaction-checkout)

Automatically-collected transactions includecheckout.url, which you can send to customers to open a checkout to capture customer information and collect payment for this transaction.


You can alsopass a transaction to a checkoutusing Paddle.js to collect for it.

[pass a transaction to a checkout](/build/transactions/pass-transaction-checkout)

## Revise customer information for billed or completed transactions

[Revise customer information for billed or completed transactions](/build/transactions/create-transaction#revise-transaction)

Billed and completed transactions are considered financial records for compliance purposes. This means they can't be deleted or changed directly. You can revise customer information for billed or completed transactions to update information like tax or VAT number, address details, or customer name.


To learn more, seeRevise customer details on a billed or completed transaction

[Revise customer details on a billed or completed transaction](/build/sell/transactions/revise-transaction-customer-details#background)

## Events

[Events](/build/transactions/create-transaction#related-notifications)

| transaction.created | Occurs when a transaction is created initially. |
| transaction.updated | Occurs when a transaction is updated. |
| transaction.ready | Occurs when a transaction is ready to be billed. It has all the required fields for billing. |
| transaction.billed | Occurs when a transaction is marked as billed. |

[transaction.created](/webhooks/transactions/transaction-created)
[transaction.updated](/webhooks/transactions/transaction-updated)
[transaction.ready](/webhooks/transactions/transaction-ready)
[transaction.billed](/webhooks/transactions/transaction-billed)

## Related pages

[Related pages](/build/transactions/create-transaction#related-pages)
[Read more](/build/invoices/create-issue-invoices)
[Read more](/build/transactions/pass-transaction-checkout)
[Read more](/build/sell/transactions/revise-transaction-customer-details)
- Create a transaction
[Create a transaction](#create-a-transaction)
- How it works
[How it works](#background)
- Transaction lifecycle
[Transaction lifecycle](#background-lifecycle)
- Before you begin
[Before you begin](#prerequisites)
- Set your default payment link
[Set your default payment link](#prerequisites-default-payment-link)
- Create customers
[Create customers](#prerequisites-customers)
- Create products and prices
[Create products and prices](#prerequisites-catalog)
- Create a draft or ready transaction
[Create a draft or ready transaction](#create-draft-transaction)
- Update a transaction
[Update a transaction](#update-transaction)
- Change collection mode
[Change collection mode](#change-collection-mode)
- Mark a transaction as billed
[Mark a transaction as billed](#create-billed-transaction)
- Pass a transaction to a checkout
[Pass a transaction to a checkout](#pass-transaction-checkout)
- Revise customer information for billed or completed transactions
[Revise customer information for billed or completed transactions](#revise-transaction)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:18*
