# Create a price - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/prices/create-price

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

## Create a price

[Create a price](/api-reference/prices/create-price#create-a-price)

Creates a new price.


Prices describe how you charge for products. You must include aproduct_idin your request to relate this price to a product.


If you omit thequantityobject, Paddle automatically sets a minimum of1and a maximum of100for you. This means the most units that a customer can buy is 100. Set a quantity if you'd like to offer a different amount.


If successful, your response includes a copy of the new price entity.

[Read more](/build/products/create-products-prices)
[Read more](/build/products/offer-localized-pricing)

### Request Body

[Request Body](/api-reference/prices/create-price#request-body)

Internal description for this price, not shown to customers. Typically notes for your team.


Paddle ID for the product that this price is for, prefixed withpro_.


Base price. This price applies to all customers, except for customers located in countries where you haveunit_price_overrides.


Amount in the lowest denomination for the currency, e.g. 10 USD = 1000 (cents). Although represented as a string, this value must be a valid integer.


Supported three-letter ISO 4217 currency code.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard. If omitted, defaults tostandard.


Name of this price, shown to customers at checkout and on invoices. Typically describes how often the related product bills.


How often this price should be charged.nullif price is non-recurring (one-time). If omitted, defaults tonull.


Amount of time.


Unit of time.


Trial period for the product related to this price. The billing cycle begins once the trial period is over.nullfor no trial period. Requiresbilling_cycle. If omitted, defaults tonull.


Amount of time.


Unit of time.


Whether this price requires a payment method (true) or not (false) when trialing. Iffalse, customers can sign up for subscription without entering their payment details, often referred to as a "cardless trial."


How tax is calculated for this price. If omitted, defaults toaccount_setting.


List of unit price overrides. Use to override the base price with a custom price and currency for a country or group of countries.


Supported two-letter ISO 3166-1 alpha-2 country code. Customers located in the listed countries are charged the override price.


Override price. This price applies to customers located in the countries for this unit price override.


Limits on how many times the related product can be purchased at this price. Useful for discount campaigns. If omitted, defaults to 1-100.


Minimum quantity of the product related to this price that can be bought. Required ifmaximumset.


Maximum quantity of the product related to this price that can be bought. Required ifminimumset. Must be greater than or equal to theminimumvalue.


Your own structured key-value data.


### Response

[Response](/api-reference/prices/create-price#response)

Represents a price entity.


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


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json
1234567891011121314151617181{
2  "description": "Monthly (per seat) with 14 day trial",
3  "name": "Monthly (per seat)",
4  "product_id": "pro_01htz88xpr0mm7b3ta2pjkr7w2",
5  "unit_price": {
6    "amount": "500",
7    "currency_code": "USD"
8  },
9  "billing_cycle": {
10    "interval": "month",
11    "frequency": 1
12  },
13  "trial_period": {
14    "interval": "day",
15    "frequency": 14
16  },
17  "tax_mode": "account_setting"
18}
```


```json

```


---

*Last scraped: 2025-12-15 20:24:46*
