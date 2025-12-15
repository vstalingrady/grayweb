# Paddle.PricePreview()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-pricepreview

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

# Paddle.PricePreview()

[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview#paddle.pricepreview())

Previews localized prices given location information supplied.


UsePaddle.PricePreview()to return a pricing preview object for the given items and location parameters.


Pricing preview objectshold calculated totals for prices, including discounts, taxes, and currency conversion. Typically used forbuilding pricing pages. For more advanced pricing pages, consider thePaddle.TransactionPreview()method instead.

[Pricing preview objects](/api-reference/pricing-preview/overview)
[building pricing pages](/build/checkout/build-pricing-page)
[Paddle.TransactionPreview()](/paddlejs/methods/paddle-transactionpreview)

Accepts the same request body asthe preview prices operationin the Paddle API, except fields must be formatted ascamelCaserather thansnake_case.

[the preview prices operation](/api-reference/pricing-preview/preview-prices)

Returns a promise that contains an object that matches the response from the preview prices operation. Field names arecamelCaserather thansnake_case.

> When location information is omitted, Paddle.js automatically detects visitor location using their IP address and returns localized prices.


When location information is omitted, Paddle.js automatically detects visitor location using their IP address and returns localized prices.


## Parameters

[Parameters](/paddlejs/methods/paddle-pricepreview#params)

Pricing preview request body. Must include anitemsarray. Include location information to return localized prices, or omit to let Paddle.js automatically detect location.


Checkthe preview prices operationdocumentation to learn about the fields you can send in a request. Convertsnake_casefield names tocamelCase, as is convention for JavaScript.

[the preview prices operation](/api-reference/pricing-preview/preview-prices)

## Examples

[Examples](/paddlejs/methods/paddle-pricepreview#examples)

This example includes a request with two items where the country code is theUnited States.


The request is passed toPaddle.PricePreview(), which returns a promise. It prints the response to the console.


```javascript
12345678910111213141516171819201var request = {
2  items: [{
3      quantity: 1,
4      priceId: 'pri_01gsz8ntc6z7npqqp6j4ys0w1w',
5    },
6    {
7      quantity: 1,
8      priceId: 'pri_01gsz8x8sawmvhz1pv30nge1ke',
9    }
10  ],
11  address: {
12    countryCode: 'US'
13  }
14}
15
16Paddle.PricePreview(request)
17  .then((result) => {
18    console.log(result);
19  })
20  .catch((error) => {

```


To learn more, seeBuild a pricing page

[Build a pricing page](/build/checkout/build-pricing-page)

## Related pages

[Related pages](/paddlejs/methods/paddle-pricepreview#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/build/checkout/build-pricing-page)
[Read more](/build/products/offer-localized-pricing)
- Paddle.PricePreview()
[Paddle.PricePreview()](#paddle.pricepreview())
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:30*
