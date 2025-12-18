# Update a product - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/products/update-product

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

## Update a product

[Update a product](/api-reference/products/update-product#update-a-product)

Updates a product using its ID.


Paddle does not upload product images to a CDN. Forimage_url, you should host images on an HTTPS server that's publicly accessible. We recommend using square images (1:1ratio).


If successful, your response includes a copy of the updated product entity.

[Read more](/build/products/create-products-prices)
[Read more](/build/products/offer-localized-pricing)

### Path Parameters

[Path Parameters](/api-reference/products/update-product#path-parameters)

Paddle ID of the product entity to work with.


### Request Body

[Request Body](/api-reference/products/update-product#request-body)

Name of this product.


Short description for this product.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Tax category for this product. Used for charging the correct rate of tax. Selected tax category must be enabled on your Paddle account.


Image for this product. Included in the checkout and on some customer documents.


Your own structured key-value data.


Whether this entity can be used in Paddle.


### Response

[Response](/api-reference/products/update-product#response)

Represents a product entity.


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


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json
1231{
2  "name": "AeroEdit for learner pilots"
3}
```


```json

```


---

*Last scraped: 2025-12-15 20:25:11*
