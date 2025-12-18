# Refund or credit a transaction

**Source:** https://developer.paddle.com/build/transactions/create-transaction-adjustments

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

# Refund or credit a transaction

[Refund or credit a transaction](/build/transactions/create-transaction-adjustments#refund-or-credit-a-transaction)

Create an adjustment to record a change to a billed or completed transaction, like a refund or credit. Most refunds for live accounts have to be approved by Paddle.


If you need to change a billed or completed transaction, you can create an adjustment. Adjustments let you refund or credit a transaction after it's been billed or completed.


Adjustments sit alongside transactions. The existingtransaction entityremains on your system unchanged for recordkeeping purposes.

[transaction entity](/api-reference/transactions/overview)

## How it works

[How it works](/build/transactions/create-transaction-adjustments#background)

Billed and completed transactions are financial records, so they can't be deleted or changed. This is especially important when working withmanually-collected transactionsbecause they're considered issued invoices. Paddle assigns them an invoice number and sends them to customers, so any financial adjustments must be correctly recorded.

[manually-collected transactions](/build/invoices/create-issue-invoices)

Use adjustments to refund or credit all or part of a transaction and its items. A transaction may have multiple adjustments where you've refunded or credited different items.


Paddle automatically sends a credit note to customers as a PDF so they have a record of a refund or credit. You can also download credit notes from the Paddle dashboard or generate a URL to them using the API.


### Refunds

[Refunds](/build/transactions/create-transaction-adjustments#background-refunds)

Refunds let you return some or the total a transaction amount to customers. The money is returned to the original payment method that the customer used.


To keep the platform safe for everyone, most refunds for live accounts require approval from Paddle. They're created with the status ofpending_approval, before moving toapprovedorrejectedonce reviewed.


For live accounts, Paddle automatically approves refunds when:

- Your account has been throughPaddle account verificationand is active.
[Paddle account verification](https://www.paddle.com/help/start/account-verification)
- The refund amount is less than or equal to 400USD, or equivalentin another currency.
[in another currency](/concepts/sell/supported-currencies)
- The refund amount is less than your balance.
- The customer paid using apayment methodother thanbank transfer.
[payment method](/concepts/payment-methods/overview)
[bank transfer](/concepts/payment-methods/wire-transfer)

Forsandbox accounts, Paddle automatically approves all refunds every ten minutes.

[sandbox accounts](/build/tools/sandbox)

### Credits

[Credits](/build/transactions/create-transaction-adjustments#background-credits)

Credits let you give customers some or the total of a transaction amount as a credit. You can create credits for manually-collected transactions (invoices) to reduce the amount due on issued invoices.


For example, if youcreate and issue an invoicethen want to remove an item, you can create an adjustment for the item you want to remove. Paddle automatically applies the credit to the issued invoice, reducing the amount the customer owes.

[create and issue an invoice](/build/invoices/create-issue-invoices)

When you credit the full value of a transaction, it's marked ascompleted. It's no longer due.


Credits don't need approval from Paddle.

> Credits in Paddle are always related to existing transactions.They adjust an amountthat's been paid, or an amount that's due on an issued invoice. They're not promotional credits, which are credits given to customers for things like referral schemes or promotions.


Credits in Paddle are always related to existing transactions.They adjust an amountthat's been paid, or an amount that's due on an issued invoice. They're not promotional credits, which are credits given to customers for things like referral schemes or promotions.

[They adjust an amount](/build/transactions/create-transaction-adjustments)

### Chargebacks

[Chargebacks](/build/transactions/create-transaction-adjustments#background-chargebacks)

When paying bycardand some other kinds ofpayment methods, customers may dispute a charge with their payment method issuer. Issuers investigate disputes and may choose to reverse a charge. This is called a chargeback.

[card](/concepts/payment-methods/credit-debit-card)
[payment methods](/concepts/payment-methods/overview)

Paddle automatically creates adjustments for chargeback events for you:

- For some kinds of chargebacks, we get an early warning and create an adjustment with the typechargeback_warningfor the disputed amount. The amount is refunded.
- For chargebacks where we don't get an early warning, we create an adjustment with the typechargebackfor the disputed amount. The amount is refunded.
- The Paddle team contests chargebacks for you. Where a chargeback is contested successfully, Paddle creates an adjustment with the typechargeback_reverseto return the amount held.

### Revise customer information

[Revise customer information](/build/transactions/create-transaction-adjustments#background-revise-transaction)

Revising customer information for a transactionis another way you can describe updates to a transaction after it's been billed or completed. However, revising a transaction is for updating customer, address, and business information against a transaction.

[Revising customer information for a transaction](/build/sell/transactions/revise-transaction-customer-details)

When you revise customer information for a transaction, Paddle may create an adjustment if there are financial changes. For example, if you add a valid tax or VAT number, Paddle automatically creates an adjustment to refund any tax where applicable.


#### Revise a transaction

[Revise a transaction](/build/transactions/create-transaction-adjustments#revise-a-transaction)
- Describes customer information updates to a billed or completed transaction.
- For example, adding extra address details or adding a tax number.
- Revises customer, address, and business entities for the transaction.
- Customer receives a revised invoice PDF.

To learn more, seeRevise a transaction

[Revise a transaction](/build/sell/transactions/revise-transaction-customer-details)

#### Create an adjustment

[Create an adjustment](/build/transactions/create-transaction-adjustments#create-an-adjustment)
- Describes financial updates to a billed or completed transaction.
- For example, refunding or crediting some or all line items for a transaction.
- Creates a new, separate adjustment entity related to the transaction.
- Customer receives a credit note PDF.

To learn more, seeRefund or credit a transaction

[Refund or credit a transaction](/build/transactions/create-transaction-adjustments)

In both cases, the existingtransaction entityremains on your system unchanged for recordkeeping purposes.

[transaction entity](/api-reference/transactions/overview)

## Create a refund

[Create a refund](/build/transactions/create-transaction-adjustments#create-refund)

Create an adjustment with theactionofrefundto return some or the total a transaction amount to customers.


Create a refund for a transaction using the API in four steps:

1. Get a transaction and extract items— optionalGet the transaction that you want to refund. Extract some information about transaction items if you only want to refund some line items.

Get a transaction and extract items— optional

[Get a transaction and extract items— optional](/build/transactions/create-transaction-adjustments#extract-transaction-items-create-refund)

Get the transaction that you want to refund. Extract some information about transaction items if you only want to refund some line items.

1. Build requestBuild a request that includes a list of transaction items and the amount to refund for each.

Build request

[Build request](/build/transactions/create-transaction-adjustments#build-request-create-refund)

Build a request that includes a list of transaction items and the amount to refund for each.

1. Create your adjustmentSend the request to create your adjustment. Paddle creates it. Its status ispending approvalorapproveddepending on the amount and whether you're using a sandbox or live account.

Create your adjustment

[Create your adjustment](/build/transactions/create-transaction-adjustments#post-create-refund)

Send the request to create your adjustment. Paddle creates it. Its status ispending approvalorapproveddepending on the amount and whether you're using a sandbox or live account.

1. Handle refund status change— optionalMost refunds are createdpending_approval. If you present refunds to customers in your app, handle refund approval or rejection.

Handle refund status change— optional

[Handle refund status change— optional](/build/transactions/create-transaction-adjustments#handle-approval-create-refund)

Most refunds are createdpending_approval. If you present refunds to customers in your app, handle refund approval or rejection.

> You can't create an adjustment for a transaction while it has an existing adjustment that's pending approval. Wait for the adjustment to become approved or rejected, then create your adjustment.


You can't create an adjustment for a transaction while it has an existing adjustment that's pending approval. Wait for the adjustment to become approved or rejected, then create your adjustment.


### Get a transaction and extract itemsOptional

[Get a transaction and extract itemsOptional](/build/transactions/create-transaction-adjustments#extract-transaction-items-create-refund)

Adjustments are fortransaction items, so you'll need toget the transactionthat you want to create a refund for.

[transaction items](/api-reference/transactions/overview)
[get the transaction](/api-reference/transactions/get-transaction)

You can refund the total for a transaction, or just some of its line items. If you only want to refund some of the transaction items, extract some information about the transaction line items. You don't need to do this if you want to refund the total transaction.


Paddle ID of the transaction entity to work with.

> Transactions must becompletedto create a refund them. You can get completed transactions usingthe list transactions operation, passingcompletedas a value to thestatusquery parameter.


Transactions must becompletedto create a refund them. You can get completed transactions usingthe list transactions operation, passingcompletedas a value to thestatusquery parameter.

[the list transactions operation](/api-reference/transactions/list-transactions)

#### Response

[Response](/build/transactions/create-transaction-adjustments#response-extract-transaction-items-create-refund)

If successful, Paddle responds with the transaction entity.


For each item intransaction.details.line_items[], extractidandtotals.totaland save these for later — we'll use this in the next step.


```json
162163164165166167168169170171172173174175176177178179180181162        "chargeback_fee": {
163          "amount": "0",
164          "original": null
165        },
166        "earnings": "56589",
167        "currency_code": "USD"
168      },
169      "line_items": [
170        {
171          "id": "txnitm_01j1f28f89k9wfjwns16b1yqww",
172          "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
173          "quantity": 10,
174          "totals": {
175            "subtotal": "30000",
176            "tax": "2662",
177            "discount": "0",
178            "total": "32662"
179          },
180          "product": {
181            "id": "pro_01gsz4t5hdjse780zja8vvr7jg",

```


### Build request

[Build request](/build/transactions/create-transaction-adjustments#build-request-create-refund)

Build a request that includes thetypefield, and optionally anitemsarray.


Specifytypeto determine whether you want to refund the transaction total or particular items.


Type of adjustment. Usefullto adjust the grand total for the related transaction. Include anitemsarray when creating apartialadjustment. If omitted, defaults topartial.


If you settypetopartial, include anitemsarray. Your array should include an object for each transaction item that you'd like to refund, where each object contains anitem_idand atype.


To refund the total for a transaction item, settypetofull.


To refund part of the total for a transaction item, settypetopartialand include anamount.

> By default,items[].amountis inclusive of tax. Includetax_modewith a value ofexternalin your request to say that amounts are exclusive of tax.


By default,items[].amountis inclusive of tax. Includetax_modewith a value ofexternalin your request to say that amounts are exclusive of tax.


List of transaction items to adjust.


Paddle ID for the transaction item that this adjustment item relates to, prefixed withtxnitm_.


Type of adjustment for this transaction item. Includeamountwhen creating apartialadjustment.


Amount adjusted for this transaction item. Required when adjustment type ispartial.


Includetransaction_idfor the transaction that your refund relates to.


Paddle ID for the transaction related to this adjustment, prefixed withtxn_.


To specify that this adjustment should refund the amount to the payment method that the customer used, you must include:

- actionwith the value ofrefund.
- Areasonwhy you're refunding this amount.

The reason is important for recordkeeping purposes. It's displayed in the Paddle dashboard and retained for future reference.


How this adjustment impacts the related transaction. Mostrefundadjustments must be approved by Paddle, and are created with the statuspending_approval.


Why this adjustment was created. Appears in the Paddle dashboard. Retained for recordkeeping purposes.


#### Request

[Request](/build/transactions/create-transaction-adjustments#request-create-refund)

This example creates a partial refund for two items on an automatically-collected transaction. One item is refunded in full, and another is partially refunded.


```json
12345678910111213141516171{
2  "action": "refund",
3  "type": "partial",
4  "transaction_id": "txn_01j1f27bnwg90nggkgkf52hy34",
5  "reason": "goodwill gesture",
6  "items": [
7    {
8      "item_id": "txnitm_01j1f28f89k9wfjwns1htt8bpw",
9      "type": "full"
10    },
11    {
12      "item_id": "txnitm_01j1f28f89k9wfjwns1csjh996",
13      "type": "partial",
14      "amount": "5000"
15    }
16  ]
17}
```


### Create adjustment

[Create adjustment](/build/transactions/create-transaction-adjustments#post-create-refund)

Send aPOSTrequest to the/adjustmentsendpoint with the request you built.


#### Response

[Response](/build/transactions/create-transaction-adjustments#response-create-refund)

If successful, Paddle responds with the new adjustment entity. It includes calculated totals.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "adj_01j1f9cx0g7skrg9kwsxmgxg5p",
4    "action": "refund",
5    "type": "partial",
6    "transaction_id": "txn_01j1f27bnwg90nggkgkf52hy34",
7    "subscription_id": "sub_01j1f28ywb5hn78y2y5tym9y4k",
8    "customer_id": "ctm_01j1f28efp7j4p1ae0hqnd144s",
9    "reason": "goodwill gesture",
10    "currency_code": "USD",
11    "status": "pending_approval",
12    "items": [
13      {
14        "id": "adjitm_01j1f9cx0g7skrg9kwszsbbxs2",
15        "item_id": "txnitm_01j1f28f89k9wfjwns1htt8bpw",
16        "type": "full",
17        "amount": "21666",
18        "proration": null,
19        "totals": {
20          "subtotal": "19900",

```


### Handle refund status changeOptional

[Handle refund status changeOptional](/build/transactions/create-transaction-adjustments#handle-approval-create-refund)

Most refunds for live accounts are created with thestatusofpending_approvaluntil reviewed by Paddle, butsome are automatically approved. Forsandbox accounts, Paddle automatically approves refunds every ten minutes.

[some are automatically approved](/build/transactions/create-transaction-adjustments#background-refunds)
[sandbox accounts](/build/tools/sandbox)

Frompending_approval, adjustments move to:

- approvedRefund approved by Paddle. The amount is refunded to the original payment method that the customer used. This may take a few days to process.

approved


Refund approved by Paddle. The amount is refunded to the original payment method that the customer used. This may take a few days to process.

- rejectedRefund rejected by the Paddle team. Contact the Paddle seller support team if you'd like to understand more about why a refund was rejected.

rejected


Refund rejected by the Paddle team. Contact the Paddle seller support team if you'd like to understand more about why a refund was rejected.


Theadjustment.updatedevent occurs when the status of an adjustment changes. Subscribe to this event to get notified when adjustments are approved or rejected. If you've built a billing information page in your app, you might like to update the status of the refund on this page.

[adjustment.updated](/webhooks/adjustments/adjustment-updated)

## Create a credit

[Create a credit](/build/transactions/create-transaction-adjustments#create-credit)

Create an adjustment with theactionofcreditto give customers some or the total of a manually-collected transaction (invoice) amount as a credit.


Create a credit for a transaction using the API in three steps:

1. Get a transaction and extract items— optionalGet the transaction that you want to credit. Extract some information about transaction items if you only want to credit some line items.

Get a transaction and extract items— optional

[Get a transaction and extract items— optional](/build/transactions/create-transaction-adjustments#extract-transaction-items-create-credit)

Get the transaction that you want to credit. Extract some information about transaction items if you only want to credit some line items.

1. Build requestBuild a request that includes a list of transaction items and the amount to credit for each.

Build request

[Build request](/build/transactions/create-transaction-adjustments#build-request-create-credit)

Build a request that includes a list of transaction items and the amount to credit for each.

1. Create your adjustmentSend the request to create your adjustment. Paddle creates it.

Create your adjustment

[Create your adjustment](/build/transactions/create-transaction-adjustments#post-create-credit)

Send the request to create your adjustment. Paddle creates it.

> You can only create credits for manually-collected transactions (invoices). You can't create credits for automatically-collected transactions.


You can only create credits for manually-collected transactions (invoices). You can't create credits for automatically-collected transactions.


### Get a transaction and extract itemsOptional

[Get a transaction and extract itemsOptional](/build/transactions/create-transaction-adjustments#extract-transaction-items-create-credit)

Adjustments are fortransaction items, so you'll need toget the transactionthat you want to create a credit for.

[transaction items](/api-reference/transactions/overview)
[get the transaction](/api-reference/transactions/get-transaction)

You can credit the total for a transaction, or just some of its line items. If you only want to credit some of the transaction items, extract some information about the transaction line items. You don't need to do this if you want to credit the total transaction.


Paddle ID of the transaction entity to work with.

> Transactions must bebilledorpast_dueto create a credit for them. You can get billed and past due transactions usingthe list transactions operation, passingbilled,past_dueas a value to thestatusquery parameter.


Transactions must bebilledorpast_dueto create a credit for them. You can get billed and past due transactions usingthe list transactions operation, passingbilled,past_dueas a value to thestatusquery parameter.

[the list transactions operation](/api-reference/transactions/list-transactions)

#### Response

[Response](/build/transactions/create-transaction-adjustments#response-extract-transaction-items-create-credit)

If successful, Paddle responds with the transaction entity.


For each item intransaction.details.line_items[], extractidandtotals.totaland save these for later — we'll use this in the next step.


```json
147148149150151152153154155156157158159160161162163164165166147        "grand_total": "1437041",
148        "fee": "0",
149        "earnings": "0",
150        "currency_code": "USD"
151      },
152      "payout_totals": null,
153      "adjusted_payout_totals": null,
154      "line_items": [
155        {
156          "id": "txnitm_01j1fcds3vh4rma21djdw6pd2f",
157          "price_id": "pri_01gsz91wy9k1yn7kx82aafwvea",
158          "quantity": 20,
159          "totals": {
160            "subtotal": "1000000",
161            "tax": "88750",
162            "discount": "0",
163            "total": "1088750"
164          },
165          "product": {
166            "id": "pro_01gsz4vmqbjk3x4vvtafffd540",

```


### Build request

[Build request](/build/transactions/create-transaction-adjustments#build-request-create-credit)

Build a request that includes thetypefield, and optionally anitemsarray.


Specifytypeto determine whether you want to credit the transaction total or particular items.


Type of adjustment. Usefullto adjust the grand total for the related transaction. Include anitemsarray when creating apartialadjustment. If omitted, defaults topartial.


If you settypetopartial, include anitemsarray. Your array should include an object for each transaction item that you'd like to refund, where each object contains anitem_idand atype.


To credit the total for a transaction item, settypetofull.


To credit part of the total for a transaction item, settypetopartialand include anamount.


List of transaction items to adjust.


Paddle ID for the transaction item that this adjustment item relates to, prefixed withtxnitm_.


Type of adjustment for this transaction item. Includeamountwhen creating apartialadjustment.


Amount adjusted for this transaction item. Required when adjustment type ispartial.


Includetransaction_idfor the transaction that your credit relates to.


Paddle ID for the transaction related to this adjustment, prefixed withtxn_.


To specify that this adjustment should create a credit for the customer, you must include:

- actionwith the value ofcredit.
- Areasonwhy you're crediting this amount.

The reason is important for recordkeeping purposes. It's displayed in the Paddle dashboard and retained for future reference.


How this adjustment impacts the related transaction.


Why this adjustment was created. Appears in the Paddle dashboard. Retained for recordkeeping purposes.


#### Request

[Request](/build/transactions/create-transaction-adjustments#request-create-credit)

This example creates a partial credit for two items on a manually-collected transaction. One item is credited in full, and another is partially credited.


```json
12345678910111213141516171{
2  "action": "credit",
3  "transaction_id": "txn_01j1fcdrmgxnp2vw6qxtpr44mf",
4  "type": "partial",
5  "reason": "error",
6  "items": [
7    {
8      "item_id": "txnitm_01j1fcds3vh4rma21djq3pd3e7",
9      "type": "full"
10    },
11    {
12      "item_id": "txnitm_01j1fcds3vh4rma21djm79vf9e",
13      "type": "partial",
14      "amount": "100000"
15    }
16  ]
17}
```


### Create adjustment

[Create adjustment](/build/transactions/create-transaction-adjustments#post-create-credit)

Send aPOSTrequest to the/adjustmentsendpoint with the request you built.


#### Response

[Response](/build/transactions/create-transaction-adjustments#response-create-credit)

If successful, Paddle responds with the new adjustment entity. It includes calculated totals.


In this example,credit_applied_to_balanceisfalsemeaning that the amount was applied to the billed transaction, reducing the balance to pay.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "adj_01j1fcvs6wpjbk0ymqbqcj7k2g",
4    "action": "credit",
5    "type": "partial",
6    "credit_applied_to_balance": false,
7    "transaction_id": "txn_01j1fcdrmgxnp2vw6qxtpr44mf",
8    "subscription_id": "sub_01j1fcex1ygrbc34pxvkz58tw5",
9    "customer_id": "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
10    "reason": "error",
11    "currency_code": "USD",
12    "status": "approved",
13    "items": [
14      {
15        "id": "adjitm_01j1fcvs6wpjbk0ymqbqgdf6pg",
16        "item_id": "txnitm_01j1fcds3vh4rma21djq3pd3e7",
17        "type": "full",
18        "amount": "21666",
19        "proration": null,
20        "totals": {

```


## Generate a credit note document

[Generate a credit note document](/build/transactions/create-transaction-adjustments#generate-credit-note)
> Credit notes were introduced inSeptember 2024. You can't generate credit notes for adjustments created before then.


Credit notes were introduced inSeptember 2024. You can't generate credit notes for adjustments created before then.


Generate a credit note document as a PDF to give to a customer as a record of a refund or credit.


Send aPOSTrequest to the/adjustments/{adjustment_id}/credit-noteendpoint, passing the Paddle ID of the adjustment entity that you'd like to generate a credit note for.


Paddle ID of the adjustment that you'd like to generate a credit note for.


### Response

[Response](/build/transactions/create-transaction-adjustments#response-generate-credit-note)

```json
123456781{
2  "data": {
3    "url": "https://paddle-production-invoice-service-pdfs.s3.amazonaws.com/credit_notes/15839/crdnt_01j4scmgpbtbxap16573dtck9n/credit_notes_296-10016_Paddle-com.pdf"
4  },
5  "meta": {
6    "request_id": "e34d4a9c-2088-447d-a3a1-1da5ce74f507"
7  }
8}
```


## Common errors

[Common errors](/build/transactions/create-transaction-adjustments#related-errors)

| adjustment_transaction_invalid_status_for_credit | Transaction must bebilledand manually collected to create a credit. |
| adjustment_transaction_invalid_status_for_refund | Transaction must becompletedto create a refund. |
| adjustment_pending_refund_request | Transaction has a pending refund. Wait for the refund to move toapprovedorrejectedbefore creating another. |

[adjustment_transaction_invalid_status_for_credit](/errors/adjustments/adjustment_transaction_invalid_status_for_credit)
[adjustment_transaction_invalid_status_for_refund](/errors/adjustments/adjustment_transaction_invalid_status_for_refund)
[adjustment_pending_refund_request](/errors/adjustments/adjustment_pending_refund_request)
`approved`
`rejected`

## Events

[Events](/build/transactions/create-transaction-adjustments#related-notifications)

| adjustment.created | Occurs when an adjustment is created. |
| adjustment.updated | Occurs when a refund adjustment status changes toapprovedorrejected. |

[adjustment.created](/webhooks/adjustments/adjustment-created)
[adjustment.updated](/webhooks/adjustments/adjustment-updated)

## Related pages

[Related pages](/build/transactions/create-transaction-adjustments#related-pages)
[Read more](/build/invoices/create-issue-invoices)
[Read more](/build/sell/transactions/revise-transaction-customer-details)
[Read more](/api-reference/adjustments/overview)
- Refund or credit a transaction
[Refund or credit a transaction](#refund-or-credit-a-transaction)
- How it works
[How it works](#background)
- Refunds
[Refunds](#background-refunds)
- Credits
[Credits](#background-credits)
- Chargebacks
[Chargebacks](#background-chargebacks)
- Revise customer information
[Revise customer information](#background-revise-transaction)
- Create a refund
[Create a refund](#create-refund)
- Create a credit
[Create a credit](#create-credit)
- Generate a credit note document
[Generate a credit note document](#generate-credit-note)
- Common errors
[Common errors](#related-errors)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:17:58*
