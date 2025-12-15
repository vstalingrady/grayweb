# Change collection mode for a transaction

**Source:** https://developer.paddle.com/build/transactions/change-collection-mode-transaction

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

# Change collection mode for a transaction

[Change collection mode for a transaction](/build/transactions/change-collection-mode-transaction#change-collection-mode-for-a-transaction)

Change collection mode to determine whether Paddle tries to collect payment for a transaction automatically using a saved payment method or sends an invoice that must be paid manually.


All purchases aretransactions. They hold all the information about a customer purchase, including customer details, items, calculated tax and localized pricing, and payments.

[transactions](/api-reference/transactions/overview)

Change collection mode for a transaction to determine whether Paddle tries to collect automatically using a saved payment method, or sends an invoice to a customer that they must pay manually.


## How it works

[How it works](/build/transactions/change-collection-mode-transaction#background)

You can create two kinds oftransactions:

[transactions](/api-reference/transactions/overview)
- Automatically-collected transactionsPaddle collects using a saved payment method. If no payment method is saved, customers must enter one usingPaddle Checkout. Typically part of a self-service workflow.

Automatically-collected transactions


Paddle collects using a saved payment method. If no payment method is saved, customers must enter one usingPaddle Checkout. Typically part of a self-service workflow.

[Paddle Checkout](/concepts/sell/self-serve-checkout)
- Manually-collected transactionsPaddle collects by sending an invoice that the customer must pay by bank transfer or using Paddle Checkout. Typically part of asales-assisted invoicing workflow.

Manually-collected transactions


Paddle collects by sending an invoice that the customer must pay by bank transfer or using Paddle Checkout. Typically part of asales-assisted invoicing workflow.

[sales-assisted invoicing workflow](/build/invoices/create-issue-invoices)

Before a transaction is billed, you can switch between automatic and manual collection modes. This means that you can do things like:

- Move higher-dollar deals to manually collected,sending invoicesto customers that they can pay by bank transfer.
[sending invoices](/build/invoices/create-issue-invoices)
- Automatically collect for smaller amounts for sales-assisted customers, like changes to seats or addons mid-billing cycle.

You can change a transaction collection mode fordraftandreadytransactions.

> Subscriptionsalso have acollection_modefield. Change the collection mode against a subscription to determine the collection mode for transactions created from that subscription.


Subscriptionsalso have acollection_modefield. Change the collection mode against a subscription to determine the collection mode for transactions created from that subscription.

[Subscriptions](/api-reference/subscriptions/overview)

## Before you begin

[Before you begin](/build/transactions/change-collection-mode-transaction#prerequisites)

To change collection mode for a transaction, you'll need to get an existing transaction that'sdraftorready.


You can't change collection mode for a transaction that'sbilledorcompleted:

- Billed transactions have been marked as finalized, so they're considered financial records.Cancel a billed transactionto say that it's no longer needed, then create another.
[Cancel a billed transaction](/build/invoices/create-issue-invoices)
- Completed transactions have payments against them, so there's no need to change their collection mode.

If you've not yet created a transaction, you can set a collection mode when creating a transaction. To learn more, see

- Create an automatically-collected transaction
[Create an automatically-collected transaction](/build/transactions/create-transaction)
- Create and issue an invoice (manually-collected transaction)
[Create and issue an invoice (manually-collected transaction)](/build/invoices/create-issue-invoices)

## Change from automatic to manual

[Change from automatic to manual](/build/transactions/change-collection-mode-transaction#automatic-to-manual)

Change an automatically-collected transaction to a manually-collected transaction when you want to send an invoice to customers. Collection for payment happens manually, which means customers must pay by bank transfer or Paddle Checkout. Paddle doesn't automatically collect for the balance.


You'll need tomark the transaction asbilledto issue your invoice. Paddle assigns an invoice number and sends an invoice document.

[mark the transaction asbilledto issue your invoice](/build/invoices/create-issue-invoices#issue-invoice)

Send a PATCH request to the/transactions/{transaction_id}endpoint.


Paddle ID of the transaction entity to work with.


API


List transactions by making a GET request to the/transactionsendpoint.Work your way through the resultsto find the transaction that you'd like to work with.

[Work your way through the results](/api-reference/about/pagination)

Paddle dashboard


Head toPaddle > Transactions, then use the search box to find the transaction you want to cancel. Copy the ID from the transaction page.


Manually-collected transactions require thebilling_detailsobject, which is where you can set information like payment terms and purchase order number.


Details for invoicing. Required ifcollection_modeismanual.


Whether the related transaction may be paid using a Paddle Checkout.


Customer purchase order number. Appears on invoice documents.


Notes or other information to include on this invoice. Appears on invoice documents.


How long a customer has to pay this invoice once issued.


### Request

[Request](/build/transactions/change-collection-mode-transaction#request-automatic-to-manual)

This example changes the collection mode for an automatically-billed transaction tomanual.


In your request, setbilling_detailsto manual and include thebilling_detailsobject. Billing details must includepayment_terms, but you may omit other fields.


Thebilling_details.enable_checkoutfield is omitted, which means that this transaction can't be paid using Paddle Checkout. Only bank transfers are accepted.


```json
123456789101{
2  "collection_mode": "manual",
3  "billing_details": {
4    "payment_terms": {
5      "interval": "day",
6      "frequency": 30
7    },
8    "purchase_order_number": "PO-1030"
9  }
10}
```


### Response

[Response](/build/transactions/change-collection-mode-transaction#response-automatic-to-manual)

If successful, Paddle responds with a copy of the updated transaction entity.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01h0j589qt1nee24210teqtz57",
4    "status": "ready",
5    "customer_id": "ctm_01gw1xk43eqy2rrf0cs93zvm6t",
6    "address_id": "add_01gwprnm56rxj8sbt0cb52972j",
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "manual",
11    "subscription_id": null,
12    "invoice_id": "inv_01h140bf2esng25zn13h5k4phe",
13    "invoice_number": null,
14    "billing_details": {
15      "enable_checkout": false,
16      "payment_terms": {
17        "interval": "day",
18        "frequency": 30
19      },
20      "purchase_order_number": "PO-1030",

```


### Request

[Request](/build/transactions/change-collection-mode-transaction#request-automatic-to-manual-checkout)

This example changes the collection mode for an automatically-billed transaction tomanual.


In your request, setbilling_detailsto manual andincludethebilling_detailsobject. Billing details must includepayment_terms, but you may omit other fields.


billing_details.enable_checkoutis included and set totrue, which means that you canpass this transaction to a checkoutto collect for it.

[pass this transaction to a checkout](/build/transactions/pass-transaction-checkout)

```json
12345678910111{
2  "collection_mode": "manual",
3  "billing_details": {
4    "enable_checkout": true,
5    "payment_terms": {
6      "interval": "day",
7      "frequency": 30
8    },
9    "purchase_order_number": "PO-1030"
10  }
11}
```


### Response

[Response](/build/transactions/change-collection-mode-transaction#response-automatic-to-manual-checkout)

If successful, Paddle responds with a copy of the updated transaction entity.


checkout.urlis included in the response, which you can send to customers to open a checkout to capture payment details for this transaction.


You can alsopass a transaction ID to a checkoutusing Paddle.js to collect for it.

[pass a transaction ID to a checkout](/build/transactions/pass-transaction-checkout)

```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01h0j589qt1nee24210teqtz57",
4    "status": "ready",
5    "customer_id": "ctm_01gw1xk43eqy2rrf0cs93zvm6t",
6    "address_id": "add_01gwprnm56rxj8sbt0cb52972j",
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "manual",
11    "subscription_id": null,
12    "invoice_id": "inv_01h14c70rkdej2ce47evkphbya",
13    "invoice_number": null,
14    "billing_details": {
15      "enable_checkout": true,
16      "payment_terms": {
17        "interval": "day",
18        "frequency": 30
19      },
20      "purchase_order_number": "PO-1030",

```


## Change from manual to automatic

[Change from manual to automatic](/build/transactions/change-collection-mode-transaction#manual-to-automatic)

Change a manually-collected transaction to an automatically-collected transaction when you want to collect using a saved payment method. If no payment method is saved, customers must enter one using Paddle Checkout.


Send a PATCH request to the/transactions/{transaction_id}endpoint.


Paddle ID of the transaction entity to work with.


Automatically-collected transactions don't need thebilling_detailsobject. Paddle automaticallynullsthis when you change collection mode to automatic.


### Request

[Request](/build/transactions/change-collection-mode-transaction#request-manual-to-automatic)

This example changes the collection mode for a manually-billed transaction toautomatic.


```json
1231{
2  "collection_mode": "automatic"
3}
```


### Response

[Response](/build/transactions/change-collection-mode-transaction#response-manual-to-automatic)

If successful, Paddle responds with a copy of the updated transaction entity.


billing_detailsis automatically set tonull.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01h0j589qt1nee24210teqtz57",
4    "status": "ready",
5    "customer_id": "ctm_01gw1xk43eqy2rrf0cs93zvm6t",
6    "address_id": "add_01gwprnm56rxj8sbt0cb52972j",
7    "business_id": null,
8    "custom_data": null,
9    "origin": "api",
10    "collection_mode": "automatic",
11    "subscription_id": null,
12    "invoice_id": "inv_01h14cfndr1pbkgbvc3bgz2gnn",
13    "invoice_number": null,
14    "billing_details": null,
15    "billing_period": {
16      "starts_at": "2023-03-29T12:45:08.730136Z",
17      "ends_at": "2024-03-29T12:45:08.730136Z"
18    },
19    "currency_code": "USD",
20    "discount_id": null,

```


## Events

[Events](/build/transactions/change-collection-mode-transaction#related-notifications)

| transaction.updated | Occurs when the collection mode for a transaction is updated. |

[transaction.updated](/webhooks/transactions/transaction-updated)

## Related pages

[Related pages](/build/transactions/change-collection-mode-transaction#related-pages)
[Read more](/build/transactions/create-transaction)
[Read more](/build/invoices/create-issue-invoices)
[Read more](/build/transactions/pass-transaction-checkout)
- Change collection mode for a transaction
[Change collection mode for a transaction](#change-collection-mode-for-a-transaction)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Change from automatic to manual
[Change from automatic to manual](#automatic-to-manual)
- Change from manual to automatic
[Change from manual to automatic](#manual-to-automatic)
- Request
[Request](#request-manual-to-automatic)
- Response
[Response](#response-manual-to-automatic)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:02*
