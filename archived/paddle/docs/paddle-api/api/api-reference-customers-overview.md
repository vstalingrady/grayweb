# Customers

**Source:** https://developer.paddle.com/api-reference/customers/overview

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

# Customers

[Customers](/api-reference/customers/overview#customers)

Customer entities hold information about the people and businesses that make purchases. They're related to addresses and businesses.


Customers are the people and businesses that buy the products listed in your catalog.


Paddle automatically creates customers for you as part ofthe checkout, or you can create and manage them using the Paddle dashboard or API.

[the checkout](/concepts/sell/self-serve-checkout)

Customer entities hold information like:

- Who's being billed.
- What their email address is.
- Whether they've opted-in to marketing.

Customers have two subentities:

- Addresses, which hold information about customer billing addresses
[Addresses](/api-reference/addresses/overview)
- Businesses, which hold information that you need when working with a business
[Businesses](/api-reference/businesses/overview)

Customers, addresses, and businesses work withcheckouts,transactions, andsubscriptionsto let customers purchaseproductsandprices.

[checkouts](/concepts/sell/self-serve-checkout)
[transactions](/api-reference/transactions/overview)
[subscriptions](/api-reference/subscriptions/overview)
[products](/api-reference/products/overview)
[prices](/api-reference/prices/overview)
> There's no delete operation for customers. Use theupdate a customer operationto archive customers when you no longer need them. To learn more, seeDelete entities


There's no delete operation for customers. Use theupdate a customer operationto archive customers when you no longer need them. To learn more, seeDelete entities

[update a customer operation](/api-reference/customers/update-customer)
[Delete entities](/api-reference/about/delete-archive-entities)
[Read more](/build/customers/create-update-customers)
[Read more](/concepts/sell/supported-countries-locales)

### Attributes

[Attributes](/api-reference/customers/overview#attributes)

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


Name of the platform or provider where this entity was imported from.


Reference or identifier for this entity from the provider where it was imported from.


---

*Last scraped: 2025-12-15 20:24:16*
