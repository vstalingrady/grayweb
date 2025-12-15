# Get a PDF invoice for a transaction - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/transactions/get-invoice-pdf

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

## Get a PDF invoice for a transaction

[Get a PDF invoice for a transaction](/api-reference/transactions/get-invoice-pdf#get-a-pdf-invoice-for-a-transaction)

Returns a link to an invoice PDF for a transaction.


Invoice PDFs are available for both automatically and manually-collected transactions:

- The PDF for manually-collected transactions includes payment terms, purchase order number, and notes for your customer. It's a demand for payment from your customer. It's available for transactions that arebilledorcompleted.
- The PDF for automatically-collected transactions lets your customer know that payment was taken successfully. Customers may require this for for tax-reporting purposes. It's available for transactions that arecompleted.

Invoice PDFs aren't available for zero-value transactions.


The link returned is not a permanent link. It expires after an hour.


### Path Parameters

[Path Parameters](/api-reference/transactions/get-invoice-pdf#path-parameters)

Paddle ID of the transaction entity to work with.


### Query Parameters

[Query Parameters](/api-reference/transactions/get-invoice-pdf#query-parameters)

Determine whether the generated URL should download the PDF as an attachment saved locally, or open it inline in the browser.


Default:attachment.


### Response

[Response](/api-reference/transactions/get-invoice-pdf#response)

URL of the requested resource.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json

```


---

*Last scraped: 2025-12-15 20:25:04*
