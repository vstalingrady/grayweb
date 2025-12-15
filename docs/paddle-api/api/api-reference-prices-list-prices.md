# List prices - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/prices/list-prices

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
- PricesPrice objectList pricesgetCreate a pricepostGet a pricegetUpdate a pricepatch
- Price object
[Price object](/api-reference/prices/overview)
- List pricesget
[List prices](/api-reference/prices/list-prices)
- Create a pricepost
[Create a price](/api-reference/prices/create-price)
- Get a priceget
[Get a price](/api-reference/prices/get-price)
- Update a pricepatch
[Update a price](/api-reference/prices/update-price)
- Discounts
- Discount groups
- Customers
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

## List prices

[List prices](/api-reference/prices/list-prices#list-prices)

Returns a paginated list of prices. Use the query parameters to page through results.


By default, Paddle returns prices that areactive. Use thestatusquery parameter to return prices that are archived.


Use theincludeparameter to include the related product entity in the response.


### Query Parameters

[Query Parameters](/api-reference/prices/list-prices#query-parameters)

Return entities after the specified Paddle ID when working with paginated endpoints. Used in themeta.pagination.nextURL in responses for list operations.


Return only the IDs specified. Use a comma-separated list to get multiple entities.


Include related entities in the response.


Order returned entities by the specified field and direction ([ASC]or[DESC]). For example,?order_by=id[ASC].


Valid fields for ordering:billing_cycle.frequency,billing_cycle.interval,id,product_id,quantity.maximum,quantity.minimum,status,tax_mode,unit_price.amount, andunit_price.currency_code.


Set how many entities are returned per page. Paddle returns the maximum number of results if a number greater than the maximum is requested. Checkmeta.pagination.per_pagein the response to see how many were returned.


Default:50; Maximum:200.


Return entities related to the specified product. Use a comma-separated list to specify multiple product IDs.


Return entities that match the specified status. Use a comma-separated list to specify multiple status values.


Determine whether returned entities are for recurring prices (true) or one-time prices (false).


Return items that match the specified type.


### Response

[Response](/api-reference/prices/list-prices#response)

Represents a price entity with included entities.


Unique Paddle ID for this price, prefixed withpri_.


Paddle ID for the product that this price is for, prefixed withpro_.


Internal description for this price, not shown to customers. Typically notes for your team.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Name of this price, shown to customers at checkout and on invoices. Typically describes how often the related product bills.


How often this price should be charged.nullif price is non-recurring (one-time).


Trial period for the product related to this price. The billing cycle begins once the trial period is over.nullfor no trial period. Requiresbilling_cycle.


How tax is calculated for this price.


Base price. This price applies to all customers, except for customers located in countries where you haveunit_price_overrides.


List of unit price overrides. Use to override the base price with a custom price and currency for a country or group of countries.


Limits on how many times the related product can be purchased at this price. Useful for discount campaigns.


Whether this entity can be used in Paddle.


Your own structured key-value data.


Import information for this entity.nullif this entity is not imported.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


Related product for this price. Returned when theincludeparameter is used with theproductvalue.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


Keys used for working with paginated results.


```json

```


---

*Last scraped: 2025-12-15 20:24:49*
