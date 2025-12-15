# HTML data attributes

**Source:** https://developer.paddle.com/paddlejs/html-data-attributes

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

# HTML data attributes

[HTML data attributes](/paddlejs/html-data-attributes#html-data-attributes)

Use HTML data attributes to pass parameters to a checkout, rather than using JavaScript properties.


You can use HTML data attributes to open a checkout with settings, items, and customer information. They're typically used withoverlay checkouts.

[overlay checkouts](/concepts/sell/overlay-checkout)

Data attributes support all the same properties asthePaddle.Checkout.open()method, letting you:

[thePaddle.Checkout.open()method](/paddlejs/methods/paddle-checkout-open)
- Set the initial items list or transaction that this checkout is for
- Set checkout settings, like the theme
- Prefill checkout properties, like customer email and country
- Sendcustom datato Paddle
[custom data](/build/transactions/custom-data)

Set data attributes on the element that you've turned into a Paddle Checkout button to open a checkout with the properties.


You mustinclude Paddle.js and callPaddle.Initialize()to use HTML data attributes, but you don't need to use any other JavaScript if you're working with an overlay checkout. This is ideal when working with a CMS that has limited customization options, or if you're not comfortable with JavaScript.

[include Paddle.js and callPaddle.Initialize()](/paddlejs/include-paddlejs)

## List of attributes

[List of attributes](/paddlejs/html-data-attributes#list-of-attributes)

Display mode for the checkout.


Theme for the checkout.


Language for the checkout.


URL to redirect to on checkout completion.


Whether the user can change their email once on the checkout.


Whether the user can remove an applied discount at checkout. Defaults totrue.


List of items for this checkout. You must pass at least one item.


Paddle ID of the price for this item.


Quantity for this line item.


Paddle ID of an existing transaction to use for this checkout. Use this instead of andata-itemsarray to create a checkout for a transaction you previously created.


Paddle ID of the customer for this checkout. Use if you know the customer, like if they're authenticated and making a change to their subscription. You can't use if you're passingdata-customer-email.


Email for this customer. You can't use if you're passingdata-customer-id.


Paddle ID for the customer address for this checkout. You can't use if you're passingdata-customer-address-country-codeordata-customer-address-postal-code.


Two-letter ISO 3166 country code for this customer. You can't use if you're passingdata-customer-address-id.


ZIP or postal code of this address. Required for countries with postal codes. You can't use if you're passingdata-customer-address-id.


State, county, or region of this address. Required ifdata-business-properties are passed.


City of this address. Required ifdata-business-properties are passed.


First line of this address. Required ifdata-business-properties are passed.


Paddle ID for the customer business for this checkout. You can't use if you're passingdata-business-nameordata-business-tax-id.


Name of the customer business. You can't use if you're passingdata-business-id.


Tax or VAT Number of the customer business. You can't use if you're passingdata-business-id.


Whether the option to add a discount is displayed at checkout. Defaults totrue.


Discount code to apply to this checkout. Use to prepopulate a discount. Pass eitherdata-discount-codeordata-discount-id.


Paddle ID of a discount to apply to this checkout. Use to prepopulate a discount. Pass eitherdata-discount-codeordata-discount-id.


Custom key-value data to include with the checkout. Must be valid JSON and contain at least one key.


Checkout experience presented to customers. Defaults tomulti-page.


Paddle ID for the previously completed transaction that this upsell follows, prefixed withtxn_.


Whether the "No thanks" skip button is displayed at checkout. Defaults totrue.


## Examples

[Examples](/paddlejs/html-data-attributes#examples)

This example includes checkout settings and items.


```html
1234567891011121314151617181<a href='#' 
2  class='paddle_button'
3  data-display-mode='overlay'
4  data-theme='light'
5  data-locale='en'
6  data-items='[
7    {
8      "priceId": "pri_01gm81eqze2vmmvhpjg13bfeqg",
9      "quantity": 1
10    },
11    {
12      "priceId": "pri_01gm82kny0ad1tk358gxmsq87m",
13      "quantity": 1
14    }
15  ]'
16>
17  Buy now
18</a>
```


You can prefill checkout properties to speed up checkout.


This example includescustomer,address, andbusinessinformation. Checkout is opened with this information prefilled, so customers land on the payment screen.


```html
12345678910111213141516171819201<a href='#' 
2  class='paddle_button'
3  data-display-mode='overlay'
4  data-theme='light'
5  data-locale='en'
6  data-items='[
7    {
8      "priceId": "pri_01gm81eqze2vmmvhpjg13bfeqg",
9      "quantity": 1
10    },
11    {
12      "priceId": "pri_01gm82kny0ad1tk358gxmsq87m",
13      "quantity": 1
14    }
15  ]'
16  data-customer-email='weloveyourproduct@paddle.com'
17  data-customer-address-country-code='US'
18  data-customer-address-postal-code='92663'
19  data-customer-address-region='California'
20  data-customer-address-city='Newport Beach'

```


You can pass Paddle IDs for customers, addresses, and businesses to build upgrade workflows for logged-in customers.


This example includes a customer ID, address ID, and business ID. Checkout is opened with this information prefilled, so customers land on the payment screen.


data-allow-logoutisfalse, hiding the option to change the customer on the opened checkout.


```html
12345678910111213141516171819201<a href='#' 
2  class='paddle_button'
3  data-display-mode='overlay'
4  data-theme='light'
5  data-locale='en'
6  data-allow-logout='false'
7  data-items='[
8    {
9      "priceId": "pri_01gm81eqze2vmmvhpjg13bfeqg",
10      "quantity": 1
11    },
12    {
13      "priceId": "pri_01gm82kny0ad1tk358gxmsq87m",
14      "quantity": 1
15    }
16  ]'
17  data-customer-id='ctm_01gm82kny0ad1tk358gxmsq87m'
18  data-customer-address-id='add_01gm82v81g69n9hdb0v9sw6j40'
19  data-business-id='biz_01gnymqsj1etmestb4yhemdavm'
20>

```


## Related pages

[Related pages](/paddlejs/html-data-attributes#related-pages)
[Read more](/build/checkout/build-overlay-checkout)
[Read more](/paddlejs/include-paddlejs)
[Read more](/paddlejs/methods/paddle-initialize)
- HTML data attributes
[HTML data attributes](#html-data-attributes)
- List of attributes
[List of attributes](#list-of-attributes)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:31*
