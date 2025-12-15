# Products

**Source:** https://developer.paddle.com/api-reference/products/overview

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

# Products

[Products](/api-reference/products/overview#products)

Product entities describe the items that customers can purchase. They hold high-level product attributes.


Products are the items in your catalog sold to customers. For simplicity and flexibility, there's no categories or hierarchies of product — everything purchased starts with a product entity.


Products work withprices, which describe how much a product costs and how often it's billed.

[prices](/api-reference/prices/overview)

Product entities hold information like:

- What the product is called.
- How it should be taxed.
- A description of the product.
- An image to show at checkout and on invoices.

Once you've created a product, you can relate it to a price. Add prices tocheckouts,transactions, andsubscriptionsto let customers purchase products.

[checkouts](/concepts/sell/self-serve-checkout)
[transactions](/api-reference/transactions/overview)
[subscriptions](/api-reference/subscriptions/overview)
> There's no delete operation for products. Use theupdate a product operationto archive products when you no longer need them. To learn more, seeDelete entities


There's no delete operation for products. Use theupdate a product operationto archive products when you no longer need them. To learn more, seeDelete entities

[update a product operation](/api-reference/products/update-product)
[Delete entities](/api-reference/about/delete-archive-entities)
[Read more](/build/products/create-products-prices)
[Read more](/build/products/offer-localized-pricing)

### Attributes

[Attributes](/api-reference/products/overview#attributes)

Unique Paddle ID for this product, prefixed withpro_.


Name of this product.


Short description for this product.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Tax category for this product. Used for charging the correct rate of tax. Selected tax category must be enabled on your Paddle account.


Image for this product. Included in the checkout and on some customer documents.


Your own structured key-value data.


Whether this entity can be used in Paddle.


Import information for this entity.nullif this entity is not imported.


Name of the platform or provider where this entity was imported from.


Reference or identifier for this entity from the provider where it was imported from.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


---

*Last scraped: 2025-12-15 20:24:27*
