# List products - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/products/list-products

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
- ProductsProduct objectList productsgetCreate a productpostGet a productgetUpdate a productpatch
- Product object
[Product object](/api-reference/products/overview)
- List productsget
[List products](/api-reference/products/list-products)
- Create a productpost
[Create a product](/api-reference/products/create-product)
- Get a productget
[Get a product](/api-reference/products/get-product)
- Update a productpatch
[Update a product](/api-reference/products/update-product)
- Prices
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

## List products

[List products](/api-reference/products/list-products#list-products)

Returns a paginated list of products. Use the query parameters to page through results.


By default, Paddle returns products that areactive. Use thestatusquery parameter to return products that are archived.


Use theincludeparameter to include related price entities in the response.


### Query Parameters

[Query Parameters](/api-reference/products/list-products#query-parameters)

Return entities after the specified Paddle ID when working with paginated endpoints. Used in themeta.pagination.nextURL in responses for list operations.


Return only the IDs specified. Use a comma-separated list to get multiple entities.


Include related entities in the response. Use a comma-separated list to specify multiple entities.


Order returned entities by the specified field and direction ([ASC]or[DESC]). For example,?order_by=id[ASC].


Valid fields for ordering:created_at,custom_data,description,id,image_url,name,status,tax_category, andupdated_at.


Set how many entities are returned per page. Paddle returns the maximum number of results if a number greater than the maximum is requested. Checkmeta.pagination.per_pagein the response to see how many were returned.


Default:50; Maximum:200.


Return entities that match the specified status. Use a comma-separated list to specify multiple status values.


Return entities that match the specified tax category. Use a comma-separated list to specify multiple tax categories.


Return items that match the specified type.


### Response

[Response](/api-reference/products/list-products#response)

Represents a product entity with included entities.


Unique Paddle ID for this product, prefixed withpro_.


Name of this product.


Short description for this product.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Tax category for this product. Used for charging the correct rate of tax. Selected tax category must be enabled on your Paddle account.


Image for this product. Included in the checkout and on some customer documents.


Your own structured key-value data.


Whether this entity can be used in Paddle.


Import information for this entity.nullif this entity is not imported.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


Prices for this product. Returned when theincludeparameter is used with thepricesvalue.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


Keys used for working with paginated results.


```json

```


---

*Last scraped: 2025-12-15 20:25:12*
