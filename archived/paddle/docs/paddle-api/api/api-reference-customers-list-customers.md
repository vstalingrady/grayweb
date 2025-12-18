# List customers - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/customers/list-customers

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

## List customers

[List customers](/api-reference/customers/list-customers#list-customers)

Returns a paginated list of customers. Use the query parameters to page through results.


By default, Paddle returns customers that areactive. Use thestatusquery parameter to return customers that are archived.


### Query Parameters

[Query Parameters](/api-reference/customers/list-customers#query-parameters)

Return entities after the specified Paddle ID when working with paginated endpoints. Used in themeta.pagination.nextURL in responses for list operations.


Return entities that exactly match the specified email address. Use a comma-separated list to specify multiple email addresses. Recommended for precise matching of email addresses.


Return only the IDs specified. Use a comma-separated list to get multiple entities.


Order returned entities by the specified field and direction ([ASC]or[DESC]). For example,?order_by=id[ASC].


Valid fields for ordering:id.


Set how many entities are returned per page. Paddle returns the maximum number of results if a number greater than the maximum is requested. Checkmeta.pagination.per_pagein the response to see how many were returned.


Default:50; Maximum:200.


Return entities that match a search query. Searchesid,name, andemailfields. Use theemailquery parameter for precise matching of email addresses.


Return entities that match the specified status. Use a comma-separated list to specify multiple status values.


### Response

[Response](/api-reference/customers/list-customers#response)

Represents a customer entity.


Unique Paddle ID for this customer entity, prefixed withctm_.


Full name of this customer. Required when creating transactions wherecollection_modeismanual(invoices).


Email address for this customer.


Whether this customer opted into marketing from you.falseunless customers check the marketing consent boxwhen using Paddle Checkout. Set automatically by Paddle.


Whether this entity can be used in Paddle.


Your own structured key-value data.


Valid IETF BCP 47 short form locale tag. If omitted, defaults toen.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


Import information for this entity.nullif this entity is not imported.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


Keys used for working with paginated results.


```json

```


---

*Last scraped: 2025-12-15 20:24:51*
