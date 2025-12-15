# List credit balances for a customer - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/customers/list-credit-balances

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
- CustomersCustomer objectList customersgetCreate a customerpostGet a customergetUpdate a customerpatchList credit balances for a customergetGenerate an authentication token for a customerpost
- Customer object
[Customer object](/api-reference/customers/overview)
- List customersget
[List customers](/api-reference/customers/list-customers)
- Create a customerpost
[Create a customer](/api-reference/customers/create-customer)
- Get a customerget
[Get a customer](/api-reference/customers/get-customer)
- Update a customerpatch
[Update a customer](/api-reference/customers/update-customer)
- List credit balances for a customerget
[List credit balances for a customer](/api-reference/customers/list-credit-balances)
- Generate an authentication token for a customerpost
[Generate an authentication token for a customer](/api-reference/customers/generate-customer-authentication-token)
- Addresses
- Businesses
- Payment methods
- Customer portal sessions
- Transactions
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

## List credit balances for a customer

[List credit balances for a customer](/api-reference/customers/list-credit-balances#list-credit-balances-for-a-customer)

Returns a list of credit balances for each currency for a customer. Each balance has three totals:

- available: total available to use.
- reserved: total temporarily reserved for billed transactions.
- used: total amount of credit used.

Credit is added to theavailabletotal initially. When used, it moves to theusedtotal.


Thereservedtotal is used when a credit balance is applied to a transaction that's marked asbilled, like when working with an issued invoice. It's not available for other transactions at this point, but isn't considereduseduntil the transaction is completed. If abilledtransaction iscanceled, any reserved credit moves back toavailable.


Credit balances are created automatically by Paddle when you take an action that results in Paddle creating a credit for a customer, like making prorated changes to a subscription. An emptydataarray is returned where a customer has no credit balances.


The response is not paginated.

[Read more](/build/transactions/create-transaction-adjustments)
[Read more](/build/customers/get-customer-credit-balances)

### Path Parameters

[Path Parameters](/api-reference/customers/list-credit-balances#path-parameters)

Paddle ID of the customer entity to work with.


### Query Parameters

[Query Parameters](/api-reference/customers/list-credit-balances#query-parameters)

Return entities that match the currency code. Use a comma-separated list to specify multiple currency codes.


### Response

[Response](/api-reference/customers/list-credit-balances#response)

Represents a credit balance for a customer.


Paddle ID of the customer that this credit balance is for, prefixed withctm_.


Three-letter ISO 4217 currency code for this credit balance.


Totals for this credit balance. Where a customer has more than one subscription in this currency with a credit balance, includes totals for all subscriptions.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json

```


---

*Last scraped: 2025-12-15 20:24:50*
