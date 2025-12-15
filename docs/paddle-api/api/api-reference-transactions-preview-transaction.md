# Preview a transaction - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/transactions/preview-transaction

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
- Customers
- Addresses
- Businesses
- Payment methods
- Customer portal sessions
- TransactionsTransaction objectList transactionsgetCreate a transactionpostGet a transactiongetUpdate a transactionpatchPreview a transactionpostGet a PDF invoice for a transactiongetRevise a billed or completed transactionpost
- Transaction object
[Transaction object](/api-reference/transactions/overview)
- List transactionsget
[List transactions](/api-reference/transactions/list-transactions)
- Create a transactionpost
[Create a transaction](/api-reference/transactions/create-transaction)
- Get a transactionget
[Get a transaction](/api-reference/transactions/get-transaction)
- Update a transactionpatch
[Update a transaction](/api-reference/transactions/update-transaction)
- Preview a transactionpost
[Preview a transaction](/api-reference/transactions/preview-transaction)
- Get a PDF invoice for a transactionget
[Get a PDF invoice for a transaction](/api-reference/transactions/get-invoice-pdf)
- Revise a billed or completed transactionpost
[Revise a billed or completed transaction](/api-reference/transactions/revise-transaction)
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

## Preview a transaction

[Preview a transaction](/api-reference/transactions/preview-transaction#preview-a-transaction)

Previews a transaction without creating a transaction entity. Typically used for creating more advanced, dynamic pricing pages where users can build their own plans.


Consider usingthe preview prices operationfor simpler pricing pages.

[the preview prices operation](/api-reference/pricing-preview/preview-prices)

You can provide location information when previewing a transaction. You must provide this if you want Paddle to calculate tax orautomatically localize prices. You can provide one of:

[automatically localize prices](/build/products/offer-localized-pricing)
- customer_ip_address: Paddle fetches location using the IP address to calculate totals.
- address: Paddle uses the country and ZIP code (where supplied) to calculate totals.
- customer_id,address_id,business_id: Paddle uses existing customer data to calculate totals. Typically used for logged-in customers.

When supplying items, you can exclude items from the total calculation using theinclude_in_totalsboolean.


By default, recurring items with trials are considered to have a zero charge when previewing. Setignore_trialstotrueto ignore trial periods against prices for transaction preview calculations.


If successful, your response includes the data you sent with adetailsobject that includes totals for the supplied prices.


Transaction previews don't create transactions, so noidis returned.

[Read more](/build/checkout/build-pricing-page)
[Read more](/build/products/offer-localized-pricing)
[Read more](/paddlejs/methods/paddle-transactionpreview)

### Request Body

[Request Body](/api-reference/transactions/preview-transaction#request-body)

List of items to preview charging for. You can preview charging for items that you've added to your catalog by passing the Paddle ID of an existing price entity, or you can preview charging for non-catalog items by passing a price object.


Non-catalog items can be for existing products, or you can pass a product object as part of your price to preview charging for a non-catalog product.


Paddle ID of an existing catalog price to preview charging for, prefixed withpri_.


Quantity of this item on the transaction.


Whether this item should be included in totals for this transaction preview. Typically used to exclude one-time charges from calculations.


Paddle ID of the customer that this transaction preview is for, prefixed withctm_.


Supported three-letter ISO 4217 currency code.


Paddle ID of the discount to apply to this transaction preview, prefixed withdsc_. Send one ofdiscount_idordiscount.


Apply a non-catalog discount to a transaction. Send one ofdiscount_idordiscount.


Amount to discount by. Forpercentagediscounts, must be an amount between0.01and100. Forflatandflat_per_seatdiscounts, amount in the lowest denomination for a currency.


Short description for this discount for your reference. Not shown to customers.


Type of discount. Determines how this discount impacts the checkout or transaction total.


Whether this discount applies for multiple subscription billing periods (true) or not (false). If omitted, defaults tofalse.


Number of subscription billing periods that this discount recurs for. Requiresrecur.nullif this discount recurs forever.


Subscription renewals, midcycle changes, and one-time charges billed to a subscription aren't considered a redemption.times_usedis not incremented in these cases.


Your own structured key-value data.


Product or price IDs that this discount is for. When including a product ID, all prices for that product can be discounted.nullif this discount applies to all products and prices.


Whether trials should be ignored for transaction preview calculations.


By default, recurring items with trials are considered to have a zero charge when previewing. Set totrueto disable this.


### Response

[Response](/api-reference/transactions/preview-transaction#response)

Represents a transaction entity when previewing transactions.


Paddle ID of the customer that this transaction preview is for, prefixed withctm_.


Paddle ID of the address that this transaction preview is for, prefixed withadd_. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


Paddle ID of the business that this transaction preview is for, prefixed withbiz_.


Supported three-letter ISO 4217 currency code.


Paddle ID of the discount applied to this transaction preview, prefixed withdsc_.


IP address for this transaction preview. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


Address for this transaction preview. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


Whether trials should be ignored for transaction preview calculations.


By default, recurring items with trials are considered to have a zero charge when previewing. Set totrueto disable this.


List of items to preview transaction calculations for.


Calculated totals for a transaction preview, including discounts, tax, and currency conversion. Considered the source of truth for totals on a transaction preview.


List of available payment methods for Paddle Checkout given the price and location information passed.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json
12345678910111213141516171819201{
2  "items": [
3    {
4      "quantity": 20,
5      "price_id": "pri_01gsz8x8sawmvhz1pv30nge1ke"
6    },
7    {
8      "quantity": 1,
9      "price_id": "pri_01h1vjfevh5etwq3rb416a23h2"
10    },
11    {
12      "quantity": 1,
13      "price_id": "pri_01gsz98e27ak2tyhexptwc58yk",
14      "include_in_totals": false
15    }
16  ],
17  "discount_id": "dsc_01gtgztp8fpchantd5g1wrksa3",
18  "address": {
19    "country_code": "US"
20  },

```


```json

```


---

*Last scraped: 2025-12-15 20:25:03*
