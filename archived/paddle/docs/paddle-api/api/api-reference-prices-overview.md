# Prices

**Source:** https://developer.paddle.com/api-reference/prices/overview

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

# Prices

[Prices](/api-reference/prices/overview#prices)

Price entities describe what customers pay for products and how often they're billed. They hold charging information.


Price entities describe what customers pay for products and how often they're billed. They're linked to products using product IDs.


Price entities hold information like:

- How much it costs.
- What currency it's billed in.
- Whether it's one-time or recurring.
- How often it's billed, if recurring.
- How long a trial period is, if any.

You can add as many prices as you like against a product — especially useful for subscription plans. For example, a "premium plan" product might have an annual price and a monthly price.


For country-specific pricing,use price overridesrather than creating multiple prices. Price overrides let you override your base price with a custom price and currency for any country.

[use price overrides](/build/products/offer-localized-pricing)

Add prices tocheckouts,transactions, andsubscriptionsto let customers purchase products.

[checkouts](/concepts/sell/self-serve-checkout)
[transactions](/api-reference/transactions/overview)
[subscriptions](/api-reference/subscriptions/overview)
> There's no delete operation for prices. Use theupdate price operationto archive prices when you no longer need them. To learn more, seeDelete entities


There's no delete operation for prices. Use theupdate price operationto archive prices when you no longer need them. To learn more, seeDelete entities

[update price operation](/api-reference/prices/update-price)
[Delete entities](/api-reference/about/delete-archive-entities)
[Read more](/build/products/create-products-prices)
[Read more](/build/products/offer-localized-pricing)

### Attributes

[Attributes](/api-reference/prices/overview#attributes)

Unique Paddle ID for this price, prefixed withpri_.


Paddle ID for the product that this price is for, prefixed withpro_.


Internal description for this price, not shown to customers. Typically notes for your team.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Name of this price, shown to customers at checkout and on invoices. Typically describes how often the related product bills.


How often this price should be charged.nullif price is non-recurring (one-time).


Amount of time.


Unit of time.


Trial period for the product related to this price. The billing cycle begins once the trial period is over.nullfor no trial period. Requiresbilling_cycle.


Amount of time.


Unit of time.


Whether this price requires a payment method (true) or not (false) when trialing. Iffalse, customers can sign up for subscription without entering their payment details, often referred to as a "cardless trial."


How tax is calculated for this price.


Base price. This price applies to all customers, except for customers located in countries where you haveunit_price_overrides.


Amount in the lowest denomination for the currency, e.g. 10 USD = 1000 (cents). Although represented as a string, this value must be a valid integer.


Supported three-letter ISO 4217 currency code.


List of unit price overrides. Use to override the base price with a custom price and currency for a country or group of countries.


Supported two-letter ISO 3166-1 alpha-2 country code. Customers located in the listed countries are charged the override price.


Override price. This price applies to customers located in the countries for this unit price override.


Limits on how many times the related product can be purchased at this price. Useful for discount campaigns.


Minimum quantity of the product related to this price that can be bought. Required ifmaximumset.


Maximum quantity of the product related to this price that can be bought. Required ifminimumset. Must be greater than or equal to theminimumvalue.


Whether this entity can be used in Paddle.


Your own structured key-value data.


Import information for this entity.nullif this entity is not imported.


Name of the platform or provider where this entity was imported from.


Reference or identifier for this entity from the provider where it was imported from.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


---

*Last scraped: 2025-12-15 20:24:13*
