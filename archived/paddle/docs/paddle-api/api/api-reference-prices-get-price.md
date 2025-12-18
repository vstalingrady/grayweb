# Get a price - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/prices/get-price

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

## Get a price

[Get a price](/api-reference/prices/get-price#get-a-price)

Returns a price using its ID.


Use theincludeparameter to include the related product entity in the response.


### Path Parameters

[Path Parameters](/api-reference/prices/get-price#path-parameters)

Paddle ID of the price entity to work with.


### Query Parameters

[Query Parameters](/api-reference/prices/get-price#query-parameters)

Include related entities in the response.


### Response

[Response](/api-reference/prices/get-price#response)

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


```json

```


---

*Last scraped: 2025-12-15 20:24:48*
