# Preview prices - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/pricing-preview/preview-prices

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
- Transactions
- Subscriptions
- Adjustments
- Pricing previewPricing preview objectPreview pricespost
- Pricing preview object
[Pricing preview object](/api-reference/pricing-preview/overview)
- Preview pricespost
[Preview prices](/api-reference/pricing-preview/preview-prices)
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

## Preview prices

[Preview prices](/api-reference/pricing-preview/preview-prices#preview-prices)

Previews calculations for one or more prices. Typically used for building pricing pages.


You can provide location information when previewing prices. You must provide this if you want Paddle to calculate tax orautomatically localize prices. You can provide one of:

[automatically localize prices](/build/products/offer-localized-pricing)
- customer_ip_address: Paddle fetches location using the IP address to calculate totals.
- address: Paddle uses the country and ZIP code (where supplied) to calculate totals.
- customer_id,address_id,business_id: Paddle uses existing customer data to calculate totals. Typically used for logged-in customers.

If successful, your response includes the data you sent with adetailsobject that includes totals for the supplied prices.


Each line item includesformatted_unit_totalsandformatted_totalsobjects that return totals formatted for the country or region you're working with, including the currency symbol.


You can work with the preview prices operation using thePaddle.PricePreview()method in Paddle.js. When working withPaddle.PricePreview(), request and response fields arecamelCaserather thansnake_case.

[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)
[Read more](/build/checkout/build-pricing-page)
[Read more](/build/products/offer-localized-pricing)
[Read more](/paddlejs/methods/paddle-pricepreview)

### Request Body

[Request Body](/api-reference/pricing-preview/preview-prices#request-body)

List of items to preview price calculations for.


Paddle ID for the price to add to this transaction, prefixed withpri_.


Quantity of the item to preview.


Paddle ID of the customer that this preview is for, prefixed withctm_.


Paddle ID of the address that this preview is for, prefixed withadd_. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


Paddle ID of the business that this preview is for, prefixed withbiz_.


Supported three-letter ISO 4217 currency code.


Paddle ID of the discount applied to this preview, prefixed withdsc_.


Address for this preview. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


Supported two-letter ISO 3166-1 alpha-2 country code for this address.


ZIP or postal code of this address. Include for more accurate tax calculations.


IP address for this transaction preview. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


### Response

[Response](/api-reference/pricing-preview/preview-prices#response)

Paddle ID of the customer that this preview is for, prefixed withctm_.


Paddle ID of the address that this preview is for, prefixed withadd_. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


Paddle ID of the business that this preview is for, prefixed withbiz_.


Supported three-letter ISO 4217 currency code.


Paddle ID of the discount applied to this preview, prefixed withdsc_.


Address for this preview. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


IP address for this transaction preview. Send one ofaddress_id,customer_ip_address, or theaddressobject when previewing.


Calculated totals for a price preview, including discounts, tax, and currency conversion.


List of available payment methods for Paddle Checkout given the price and location information passed.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json
1234567891011121314151{
2  "items": [
3    {
4      "quantity": 20,
5      "price_id": "pri_01gsz8z1q1n00f12qt82y31smh"
6    },
7    {
8      "quantity": 1,
9      "price_id": "pri_01h1vjfevh5etwq3rb416a23h2"
10    }
11  ],
12  "currency_code": "USD",
13  "discount_id": "dsc_01gtgztp8fpchantd5g1wrksa3",
14  "customer_ip_address": "34.232.58.13"
15}
```


```json

```


---

*Last scraped: 2025-12-15 20:25:25*
