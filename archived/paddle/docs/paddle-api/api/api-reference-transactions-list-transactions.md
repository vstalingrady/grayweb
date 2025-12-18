# List transactions - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/transactions/list-transactions

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

## List transactions

[List transactions](/api-reference/transactions/list-transactions#list-transactions)

Returns a paginated list of transactions. Use the query parameters to page through results.


Use theincludeparameter to include related entities in the response.


### Query Parameters

[Query Parameters](/api-reference/transactions/list-transactions#query-parameters)

Return entities after the specified Paddle ID when working with paginated endpoints. Used in themeta.pagination.nextURL in responses for list operations.


Return entities billed at a specific time. Pass an RFC 3339 datetime string, or use[LT](less than),[LTE](less than or equal to),[GT](greater than), or[GTE](greater than or equal to) operators. For example,billed_at=2023-04-18T17:03:26orbilled_at[LT]=2023-04-18T17:03:26.


Return entities that match the specified collection mode.


Return entities created at a specific time. Pass an RFC 3339 datetime string, or use[LT](less than),[LTE](less than or equal to),[GT](greater than), or[GTE](greater than or equal to) operators. For example,created_at=2023-04-18T17:03:26orcreated_at[LT]=2023-04-18T17:03:26.


Return entities related to the specified customer. Use a comma-separated list to specify multiple customer IDs.


Return only the IDs specified. Use a comma-separated list to get multiple entities.


Include related entities in the response. Use a comma-separated list to specify multiple entities.


Return entities that match the invoice number. Use a comma-separated list to specify multiple invoice numbers.


Return entities related to the specified origin. Use a comma-separated list to specify multiple origins.


Order returned entities by the specified field and direction ([ASC]or[DESC]). For example,?order_by=id[ASC].


Valid fields for ordering:billed_at,created_at,id, andupdated_at.


Return entities that match the specified status. Use a comma-separated list to specify multiple status values.


Return entities related to the specified subscription. Use a comma-separated list to specify multiple subscription IDs. Passnullto return entities that aren't related to any subscription.


Set how many entities are returned per page. Paddle returns the maximum number of results if a number greater than the maximum is requested. Checkmeta.pagination.per_pagein the response to see how many were returned.


Default:30; Maximum:30.


Return entities updated at a specific time. Pass an RFC 3339 datetime string, or use[LT](less than),[LTE](less than or equal to),[GT](greater than), or[GTE](greater than or equal to) operators. For example,updated_at=2023-04-18T17:03:26orupdated_at[LT]=2023-04-18T17:03:26.


### Response

[Response](/api-reference/transactions/list-transactions#response)

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


Keys used for working with paginated results.


```json

```


---

*Last scraped: 2025-12-15 20:25:04*
