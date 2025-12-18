# Create a transaction - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/transactions/create-transaction

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

## Create a transaction

[Create a transaction](/api-reference/transactions/create-transaction#create-a-transaction)

Creates a new transaction.


Transactions are typically created with the status ofdraftorreadyinitially:

- Draft transactions haveitemsagainst them, but don't have all of the required fields for billing. Paddle creates draft transactions automatically when a checkout is opened.
- Paddle automatically marks transactions asreadywhen all of the required fields are present for billing. This includescustomer_idandaddress_idfor automatically-collected transactions, andbilling_detailsfor manually-collected transactions.

Thecollection_modeagainst a transaction determines how Paddle tries to collect for payment:

- Manually-collected transactions are for sales-assisted billing. Paddle sends an invoice to your customer when a transaction isbilled. Payment is often by wire transfer.
- Automatically-collected transactions are for self-serve checkouts. You may pass the transaction to a checkout or use the returnedcheckout.urlto collect for payment.

When a manually-collected transaction is marked asbilledor an automatically-collected transaction iscompleted, Paddle automatically creates a related subscription for the items on the transaction.


If successful, your response includes a copy of the new transaction entity.


Use theincludeparameter to include related entities in the response.

[Read more](/build/invoices/create-issue-invoices)
[Read more](/build/transactions/custom-data)

### Query Parameters

[Query Parameters](/api-reference/transactions/create-transaction#query-parameters)

Include related entities in the response. Use a comma-separated list to specify multiple entities.


### Request Body

[Request Body](/api-reference/transactions/create-transaction#request-body)

List of items to charge for. You can charge for items that you've added to your catalog by passing the Paddle ID of an existing price entity, or you can charge for non-catalog items by passing a price object.


Non-catalog items can be for existing products, or you can pass a product object as part of your price to charge for a non-catalog product.


Paddle ID of an existing catalog price to add to this transaction, prefixed withpri_.


Quantity of this item on the transaction.


Status of this transaction. You may set a transaction tobilledwhen creating,or omit to let Paddle set the status. Transactions are created asreadyif they haveanaddress_id,customer_id, anditems, otherwise they are created asdraft.


Marking asbilledwhen creating is typically used when working with manually-collectedtransactions as part of an invoicing workflow. Billed transactions cannot be updated, only canceled.


Paddle ID of the customer that this transaction is for, prefixed withctm_. If omitted, transaction status isdraft.


Paddle ID of the address that this transaction is for, prefixed withadd_. Requirescustomer_id. If omitted, transaction status isdraft.


Paddle ID of the business that this transaction is for, prefixed withbiz_. Requirescustomer_id.


Your own structured key-value data.


Supported three-letter ISO 4217 currency code. Must beUSD,EUR, orGBPifcollection_modeismanual.


How payment is collected for this transaction.automaticfor checkout,manualfor invoices. If omitted, defaults toautomatic.


Paddle ID of the discount to apply to this transaction, prefixed withdsc_. Send one ofdiscount_idordiscount.


Apply a non-catalog discount to a transaction. Send one ofdiscount_idordiscount.


Amount to discount by. Forpercentagediscounts, must be an amount between0.01and100. Forflatandflat_per_seatdiscounts, amount in the lowest denomination for a currency.


Short description for this discount for your reference. Not shown to customers.


Type of discount. Determines how this discount impacts the checkout or transaction total.


Whether this discount applies for multiple subscription billing periods (true) or not (false). If omitted, defaults tofalse.


Number of subscription billing periods that this discount recurs for. Requiresrecur.nullif this discount recurs forever.


Subscription renewals, midcycle changes, and one-time charges billed to a subscription aren't considered a redemption.times_usedis not incremented in these cases.


Your own structured key-value data.


Product or price IDs that this discount is for. When including a product ID, all prices for that product can be discounted.nullif this discount applies to all products and prices.


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


Paddle Checkout details for this transaction. You may pass a URL when creating or updating an automatically-collected transaction, or when creating or updating a manually-collected transaction wherebilling_details.enable_checkoutistrue.


Checkout URL to use for the payment link for this transaction. Pass the URL for an approved domain, or omit to use your default payment URL.


Paddle returns a unique payment link composed of the URL passed or your default payment URL +?_ptxn=and the Paddle ID for this transaction.


### Response

[Response](/api-reference/transactions/create-transaction#response)

Represents a transaction entity with included entities.


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


Time period that this transaction is for. Set automatically by Paddle for subscription renewals to describe the period that charges are for.


List of items on this transaction. For calculated totals, usedetails.line_items.


Calculated totals for a transaction, including proration, discounts, tax, and currency conversion. Considered the source of truth for totals on a transaction.


List of payment attempts for this transaction, including successful payments. Sorted bycreated_atin descending order, so most recent attempts are returned first.


Paddle Checkout details for this transaction. Returned for automatically-collected transactions and wherebilling_details.enable_checkoutistruefor manually-collected transactions;nullotherwise.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


RFC 3339 datetime string of when this transaction was marked asbilled.nullfor transactions that aren'tbilledorcompleted. Set automatically by Paddle.


RFC 3339 datetime string of when a transaction was revised. Revisions describe an update to customer information for a billed or completed transaction.nullif not revised. Set automatically by Paddle.


Address for this transaction. Reflects the entity at the time it was added to the transaction, or its revision ifrevised_atis notnull. Returned when theincludeparameter is used with theaddressvalue and the transaction has anaddress_id.


List of adjustments for this transaction. Returned when theincludeparameter is used with theadjustmentvalue and the transaction has adjustments.


Object containing totals for all adjustments on a transaction. Returned when theincludeparameter is used with theadjustments_totalsvalue.


Business for this transaction. Reflects the entity at the time it was added to the transaction, or its revision ifrevised_atis notnull. Returned when theincludeparameter is used with thebusinessvalue and the transaction has abusiness_id.


Customer for this transaction. Reflects the entity at the time it was added to the transaction, or its revision ifrevised_atis notnull. Returned when theincludeparameter is used with thecustomervalue and the transaction has acustomer_id.


Discount for this transaction. Reflects the entity at the time it was added to the transaction. Returned when theincludeparameter is used with thediscountvalue and the transaction has adiscount_id.


List of available payment methods for this transaction. Returned when theincludeparameter is used with theavailable_payment_methodsvalue.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json
12345678910111213141516171819201{
2  "items": [
3    {
4      "quantity": 20,
5      "price_id": "pri_01gsz91wy9k1yn7kx82aafwvea"
6    },
7    {
8      "quantity": 1,
9      "price_id": "pri_01gsz96z29d88jrmsf2ztbfgjg"
10    },
11    {
12      "quantity": 1,
13      "price_id": "pri_01gsz98e27ak2tyhexptwc58yk"
14    }
15  ],
16  "customer_id": "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
17  "address_id": "add_01hv8gq3318ktkfengj2r75gfx",
18  "currency_code": "USD",
19  "collection_mode": "manual",
20  "billing_details": {

```


```json

```


---

*Last scraped: 2025-12-15 20:24:59*
