# Transactions

**Source:** https://developer.paddle.com/api-reference/transactions/overview

---

- Overview
[Overview](/api-reference/overview)
- Authentication
- Authentication
[Authentication](/api-reference/about/authentication)
- Permissions
[Permissions](/api-reference/about/permissions)
- Manage API keys
[Manage API keys](/api-reference/about/api-keys)
- Rotate API keys
[Rotate API keys](/api-reference/about/rotate-api-keys)
- Core concepts
- Versioning
[Versioning](/api-reference/about/versioning)
- Paddle IDs
[Paddle IDs](/api-reference/about/paddle-ids)
- Data types
[Data types](/api-reference/about/data-types)
- Custom data
[Custom data](/api-reference/about/custom-data)
- Rate limiting
[Rate limiting](/api-reference/about/rate-limiting)
- Query & retrieval
- Default scopes
[Default scopes](/api-reference/about/default-scopes)
- Related entities
[Related entities](/api-reference/about/include-entities)
- Filter and sort
[Filter and sort](/api-reference/about/filter-search-sort)
- Pagination
[Pagination](/api-reference/about/pagination)
- Response handling
- Success responses
[Success responses](/api-reference/about/success-responses)
- Errors
[Errors](/api-reference/about/errors)
- Entity management
- Work with lists
[Work with lists](/api-reference/about/lists)
- Delete entities
[Delete entities](/api-reference/about/delete-archive-entities)
- Entities
- Products
- Prices
- Discounts
- Discount groups
- Customers
- Addresses
- Businesses
- Payment methods
- Customer portal sessions
- TransactionsTransaction objectList transactionsgetCreate a transactionpostGet a transactiongetUpdate a transactionpatchPreview a transactionpostGet a PDF invoice for a transactiongetRevise a billed or completed transactionpost
- Transaction object
[Transaction object](/api-reference/transactions/overview)
- List transactionsget
[List transactions](/api-reference/transactions/list-transactions)
- Create a transactionpost
[Create a transaction](/api-reference/transactions/create-transaction)
- Get a transactionget
[Get a transaction](/api-reference/transactions/get-transaction)
- Update a transactionpatch
[Update a transaction](/api-reference/transactions/update-transaction)
- Preview a transactionpost
[Preview a transaction](/api-reference/transactions/preview-transaction)
- Get a PDF invoice for a transactionget
[Get a PDF invoice for a transaction](/api-reference/transactions/get-invoice-pdf)
- Revise a billed or completed transactionpost
[Revise a billed or completed transaction](/api-reference/transactions/revise-transaction)
- Subscriptions
- Adjustments
- Pricing preview
- Client-side tokens
- Reports
- Event types
- Events
- Notification settings
- Notifications
- Notification logs
- Simulation types
- Simulations
- Simulation runs
- Simulation run events

# Transactions

[Transactions](/api-reference/transactions/overview#transactions)

Transaction entities calculate and capture revenue. They hold information about a customer purchase.


Transactions are at the heart of Paddle. They tie togetherproducts,prices, anddiscountswithcustomersto calculate revenue forcheckouts, invoices, andsubscriptions.

[products](/api-reference/products/overview)
[prices](/api-reference/prices/overview)
[discounts](/api-reference/discounts/overview)
[customers](/api-reference/customers/overview)
[checkouts](/concepts/sell/self-serve-checkout)
[subscriptions](/api-reference/subscriptions/overview)

Paddle automatically creates transactions when customers sign up using the checkout, as well as when subscription lifecycle events like renewals orupgradeshappen.

[upgrades](/build/subscriptions/replace-products-prices-upgrade-downgrade)

You can also create a transaction through the Paddle dashboard or the API. You cancollect for a transaction manually to create an invoice, or collect automatically using a card on file or by presenting a checkout.

[collect for a transaction manually to create an invoice](/build/invoices/create-issue-invoices)

Transactions hold information like:

- Who the customer is.
- Which items they're purchasing.
- Calculated totals for the customer and items.
- Any payment attempts.

### Details

[Details](/api-reference/transactions/overview#details)

Transactions handle all parts of revenue calculation, including complexproration operations,localized pricing, and tax calculations.

[proration operations](/concepts/subscriptions/proration)
[localized pricing](/build/products/offer-localized-pricing)

Paddle returns calculated totals for a transaction in thedetailsobject. Details are the single source for totals on a transaction. They're used for collecting payment from a customer and revenue recognition.


### Payments

[Payments](/api-reference/transactions/overview#payments)

Though the terms "transaction" and "payment" are sometimes used interchangeably, they're distinct entities in Paddle:

- Transactionscalculate and captures revenue, ready for payment
- Paymentsare attempts to collect for the amount against a transaction — both online and offline

Transactions can have more than one payment against them. For example, customers paying for larger value deals by invoice might make multiple payments, and automatically collected payments might fail.


### Previews

[Previews](/api-reference/transactions/overview#previews)

For pricing pages and other screens that let customers preview changes to their subscription, you canpreview a transactionrather than creating it.

[preview a transaction](/api-reference/transactions/preview-transaction)

When previewing a transaction, you don't need to send the same information as you would if you were creating it.

> Transactions are financial records. They can't be deleted, and they can't be changed once they've been billed.Cancel a transaction, orcreate an adjustmentto record post-billing actions that impact a transaction.


Transactions are financial records. They can't be deleted, and they can't be changed once they've been billed.Cancel a transaction, orcreate an adjustmentto record post-billing actions that impact a transaction.

[Cancel a transaction](/api-reference/transactions/update-transaction)
[create an adjustment](/api-reference/adjustments/create-adjustment)
[Read more](/build/transactions/create-transaction)
[Read more](/build/invoices/create-issue-invoices)
[Read more](/build/checkout/build-overlay-checkout)

### Attributes

[Attributes](/api-reference/transactions/overview#attributes)

Unique Paddle ID for this transaction entity, prefixed withtxn_.


Status of this transaction. You may set a transaction tobilledorcanceled, other statuses are set automatically by Paddle. Automatically-collected transactions may returncompletedif payment is captured successfully, orpast_dueif payment failed.


Paddle ID of the customer that this transaction is for, prefixed withctm_.


Paddle ID of the address that this transaction is for, prefixed withadd_.


Paddle ID of the business that this transaction is for, prefixed withbiz_.


Your own structured key-value data.


Supported three-letter ISO 4217 currency code. Must beUSD,EUR, orGBPifcollection_modeismanual.


Describes how this transaction was created.


Paddle ID of the subscription that this transaction is for, prefixed withsub_.


Paddle ID of the invoice that this transaction is related to, prefixed withinv_. Used for compatibility with the Paddle Invoice API, which is now deprecated. This field is scheduled to be removed in the next version of the Paddle API.


Invoice number for this transaction. Automatically generated by Paddle when you mark a transaction asbilledwherecollection_modeismanual.


How payment is collected for this transaction.automaticfor checkout,manualfor invoices.


Paddle ID of the discount applied to this transaction, prefixed withdsc_.


Details for invoicing. Required ifcollection_modeismanual.


How long a customer has to pay this invoice once issued.


Unit of time.


Amount of time.


Whether the related transaction may be paid using Paddle Checkout. If omitted when creating a transaction, defaults tofalse.


Customer purchase order number. Appears on invoice documents.


Notes or other information to include on this invoice. Appears on invoice documents.


Time period that this transaction is for. Set automatically by Paddle for subscription renewals to describe the period that charges are for.


RFC 3339 datetime string of when this period ends.


RFC 3339 datetime string of when this period starts.


List of items on this transaction. For calculated totals, usedetails.line_items.


Paddle ID for the price to add to this transaction, prefixed withpri_.


Represents a price entity.


Quantity of this item on the transaction.


How proration was calculated for this item. Populated when a transaction is created from a subscription change, whereproration_billing_modewasprorated_immediatelyorprorated_next_billing_period. Set automatically by Paddle.


Calculated totals for a transaction, including proration, discounts, tax, and currency conversion. Considered the source of truth for totals on a transaction.


List of tax rates applied for this transaction.


Breakdown of the total for a transaction. These numbers can be negative when dealing with subscription updates that result in credit.


Breakdown of the totals for a transaction after adjustments.


Breakdown of the payout total for a transaction.nulluntil the transaction iscompleted. Returned in your payout currency.


Breakdown of the payout total for a transaction after adjustments.nulluntil the transaction iscompleted.


Information about line items for this transaction. Different from transactionitemsas they include totals calculated by Paddle. Considered the source of truth for line item totals.


List of payment attempts for this transaction, including successful payments. Sorted bycreated_atin descending order, so most recent attempts are returned first.


UUID for this payment attempt.


UUID for the stored payment method used for this payment attempt. Deprecated - usepayment_method_idinstead.


Paddle ID of the payment method used for this payment attempt, prefixed withpaymtd_.


Amount for collection in the lowest denomination of a currency (e.g. cents for USD).


Status of this payment attempt.


Reason why a payment attempt failed. Returnsnullif payment captured successfully.


Information about the payment method used for a payment attempt.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this payment was captured.nullifstatusis notcaptured.


Paddle Checkout details for this transaction. Returned for automatically-collected transactions and wherebilling_details.enable_checkoutistruefor manually-collected transactions;nullotherwise.


Paddle Checkout URL for this transaction, composed of the URL passed in the request or your default payment URL +?_ptxn=and the Paddle ID for this transaction.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


RFC 3339 datetime string of when this transaction was marked asbilled.nullfor transactions that aren'tbilledorcompleted. Set automatically by Paddle.


RFC 3339 datetime string of when a transaction was revised. Revisions describe an update to customer information for a billed or completed transaction.nullif not revised. Set automatically by Paddle.


---

*Last scraped: 2025-12-15 20:24:21*
