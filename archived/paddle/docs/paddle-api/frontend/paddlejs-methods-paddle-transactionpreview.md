# Paddle.TransactionPreview()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-transactionpreview

---

- Overview
[Overview](/paddlejs/overview)
- Setup & Authentication
- Manage client-side tokens
[Manage client-side tokens](/paddlejs/client-side-tokens)
- Include and initialize Paddle.js
[Include and initialize Paddle.js](/paddlejs/include-paddlejs)
- Test Retain x Paddle.js
[Test Retain x Paddle.js](/paddlejs/test-retain)
- Methods
- Paddle.Initialize()
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
- Paddle.Update()
[Paddle.Update()](/paddlejs/methods/paddle-update)
- Paddle.Environment.set()
[Paddle.Environment.set()](/paddlejs/methods/paddle-environment-set)
- Paddle.Checkout.open()
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
- Paddle.Checkout.updateCheckout()
[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)
- Paddle.Checkout.updateItems()
[Paddle.Checkout.updateItems()](/paddlejs/methods/paddle-checkout-updateitems)
- Paddle.Checkout.close()
[Paddle.Checkout.close()](/paddlejs/methods/paddle-checkout-close)
- Paddle.PricePreview()
[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)
- Paddle.Retain.demo()
[Paddle.Retain.demo()](/paddlejs/methods/paddle-retain-demo)
- Paddle.Retain.initCancellationFlow()
[Paddle.Retain.initCancellationFlow()](/paddlejs/methods/paddle-retain-initcancellationflow)
- Paddle.Spinner.show()
[Paddle.Spinner.show()](/paddlejs/methods/paddle-spinner-show)
- Paddle.Spinner.hide()
[Paddle.Spinner.hide()](/paddlejs/methods/paddle-spinner-hide)
- Paddle.Status.libraryVersion
[Paddle.Status.libraryVersion](/paddlejs/methods/paddle-status-libraryversion)
- Paddle.TransactionPreview()
[Paddle.TransactionPreview()](/paddlejs/methods/paddle-transactionpreview)
- Hosted checkouts
- URL parameters
[URL parameters](/paddlejs/hosted-checkout-url-parameters)
- HTML data attributes
- HTML data attributes
[HTML data attributes](/paddlejs/html-data-attributes)
- Events
- Overview
[Overview](/paddlejs/events/overview)
- General
- Items
- Customer
- Payment
- Discount
- Upsell

# Paddle.TransactionPreview()

[Paddle.TransactionPreview()](/paddlejs/methods/paddle-transactionpreview#paddle.transactionpreview())

Generates a transaction preview for prices and location information supplied.


UsePaddle.TransactionPreview()to return a transaction preview object for items and location information supplied.


Transaction previewsare previews oftransaction entities, holding calculated totals for prices — including discounts, taxes, and currency conversion. They're typically used for building advanced, cart-style pricing pages where users can build their own plans. For simpler pricing pages, consider thePaddle.PricePreview()method instead.

[Transaction previews](/api-reference/transactions/preview-transaction)
[transaction entities](/api-reference/transactions/overview)
[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)

Unlikepricing previewsreturned when usingPaddle.PricePreview(), transaction previews return both line item and grand totals for items passed. This means that they have the same validation logic as transactions, too. For example, all items must have the same billing period.

[pricing previews](/paddlejs/methods/paddle-pricepreview)
[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)

Accepts the same request body asthe preview a transaction operationin the Paddle API, except fields must be formatted ascamelCaserather thansnake_case.

[the preview a transaction operation](/api-reference/transactions/preview-transaction)

Returns a promise that contains an object that matches the response from the preview a transaction operation. Field names arecamelCaserather thansnake_case.

> When location information is omitted, Paddle.js automatically detects visitor location using their IP address and returns localized prices.


When location information is omitted, Paddle.js automatically detects visitor location using their IP address and returns localized prices.


## Parameters

[Parameters](/paddlejs/methods/paddle-transactionpreview#params)

Transaction preview request body. Must include anitemsarray. Include location information to return localized prices, or omit to let Paddle.js automatically detect location.


Checkthe preview a transaction operationdocumentation to learn about the fields you can send in a request. Convertsnake_casefield names tocamelCase, as is convention for JavaScript.

[the preview a transaction operation](/api-reference/transactions/preview-transaction)

## Examples

[Examples](/paddlejs/methods/paddle-transactionpreview#examples)

This example includes a request with two items where the country code is theUnited Statesand the currency code isUSD. One of the items is excluded from the totals using theincludeInTotalsfield. It also passes a discount.


The request is passed toPaddle.TransactionPreview(), which returns a promise. It prints the response to the console.


```javascript
12345678910111213141516171819201var request = {
2  items: [
3    {
4      quantity: 20,
5      priceId: "pri_01gsz8z1q1n00f12qt82y31smh"
6    },
7    {
8      quantity: 1,
9      priceId: "pri_01gsz98e27ak2tyhexptwc58yk",
10      includeInTotals: false
11    }
12  ],
13  discountId: "dsc_01gtgztp8fpchantd5g1wrksa3",
14  address: {
15    countryCode: "US"
16  },
17  currencyCode: "USD"
18}
19
20Paddle.TransactionPreview(request)

```


## Related pages

[Related pages](/paddlejs/methods/paddle-transactionpreview#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/build/checkout/build-pricing-page)
[Read more](/build/products/offer-localized-pricing)
- Paddle.TransactionPreview()
[Paddle.TransactionPreview()](#paddle.transactionpreview())
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:39*
