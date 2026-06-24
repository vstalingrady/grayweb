# Paddle.Checkout.open()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-checkout-open

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

# Paddle.Checkout.open()

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open#paddle.checkout.open())

Opens a checkout with settings, items, and customer information.


UsePaddle.Checkout.open()to open a checkout.

- Set the initial items list or transaction that this checkout is for
- Set checkout settings, like the theme
- Prefill checkout properties, like customer email and country
- Sendcustom datato Paddle
[custom data](/build/transactions/custom-data)

To add items to a checkout, you can pass either:

- Anitemsarray of objects, where each object contains apriceIdandquantityproperty.priceIdshould be a Paddle ID ofa price entity.
[a price entity](/api-reference/prices/overview)
- The Paddle ID ofa transaction entitythat you prepared earlier.
[a transaction entity](/api-reference/transactions/overview)
> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


To speed up checkout, or build workflows for logged-in customers, you canprefill customer, address, and business information. You can do this by passing customer, address, and business data, or by passing Paddle IDs for an existing customer, address, or business.

[prefill customer, address, and business information](/build/checkout/prefill-checkout-properties)

You canopen a checkout for an upsellby passing anupsellobject, containing the Paddle ID of the previously completed transaction that this upsell follows.

[open a checkout for an upsell](/build/checkout/upsell-checkout)

You can usethePaddle.Initialize()methodtoset default checkout settings. These settings apply to all checkouts opened on a page.

[thePaddle.Initialize()method](/paddlejs/methods/paddle-initialize)
[set default checkout settings](/build/checkout/set-up-checkout-default-settings)
> Instead of usingPaddle.Checkout.open(), you can use HTML data attributes to open a checkout. This is ideal when working with a CMS that has limited customization options, or if you're not comfortable with JavaScript. To learn more, seeHTML data attributes


Instead of usingPaddle.Checkout.open(), you can use HTML data attributes to open a checkout. This is ideal when working with a CMS that has limited customization options, or if you're not comfortable with JavaScript. To learn more, seeHTML data attributes

[HTML data attributes](/paddlejs/html-data-attributes)

## Parameters

[Parameters](/paddlejs/methods/paddle-checkout-open#params)

Set general checkout settings.


Whether the user can change their email once on the checkout.


Whether the user can remove an applied discount at checkout. Defaults totrue.


Payment options presented to customers at checkout.


Display mode for the checkout.


Height in pixels of the<div>on load. Do not includepx. Recommended450.


The inline checkout footer includes a message to let customers know that Paddle is the merchant of record for the transaction. For compliance, the inline checkout frame must be sized so that the footer message is visible.


Styles to apply to the checkout<div>.min-widthmust be set to286pxor above with checkout padding off;312pxwith checkout padding on. UseframeInitialHeightto set height.


Class name of the<div>element where the checkout should be rendered.


Language for the checkout. If omitted, the browser's default locale is used.


Whether the option to add a discount is displayed at checkout. Requires the "display discount field on the checkout"option enabled in Paddle > Checkout > Checkout settings. Defaults totrue.


Whether the option to add a tax number is displayed at checkout. Defaults totrue.


URL to redirect to on checkout completion. Must start withhttp://orhttps://.


Theme for the checkout. If omitted, defaults to light.


Checkout experience presented to customers. Defaults tomulti-page.


List of items for this checkout. You must pass at least one item. Use theupdateItems()orupdateCheckout()method to update the items list.


Paddle ID of the price for this item.


Quantity for this line item.


Paddle ID of an existing transaction to use for this checkout. Use this instead of anitemsarray to create a checkout for a transaction you previously created.


Authentication token for this customer, generated using thegenerate an authentication token for a customer operationin the Paddle API. Use to authenticate a customer so they can work with saved payment methods at checkout.

[generate an authentication token for a customer operation](/api-reference/customers/generate-customer-authentication-token)

Information about the customer for this checkout. Pass either an existingid, or the other fields.


Paddle ID of the customer for this checkout. Use if you know the customer, like if they're authenticated and making a change to their subscription. You can't use if you're passingemail.


Email for this customer. You can't use if you're passingid.


Information about the customer address for this checkout. Pass either an existingid, or the other fields.


Information about the customer business for this checkout. Pass either an existingid, or the other fields.


Discount code to apply to this checkout. Use to prepopulate a discount. Pass eitherdiscountCodeordiscountId.


Paddle ID of a discount to apply to this checkout. Use to prepopulate a discount. Pass eitherdiscountCodeordiscountId.


Opens a checkout as an upsell to display a streamlined checkout experience. Only works with inline, one-page checkouts.


Unique Paddle ID for the previously completed transaction that this upsell follows, prefixed withtxn_.


Configuration settings for the upsell checkout.


Your own structured key-value data to include with this checkout. Passed data is held against the related transaction. If a transaction is for recurring items, custom data is copied to the related subscription when created. Must be valid JSON and contain at least one key.


Paddle ID for a saved payment method for this customer. If passed, only this saved payment method is presented atcheckout. Use thelist payment methods for a customer operationto get saved payment method IDs for a customer. RequirescustomerAuthToken.

[list payment methods for a customer operation](/api-reference/payment-methods/list-payment-methods)

## Example

[Example](/paddlejs/methods/paddle-checkout-open#examples)

You can pass checkout settings usingPaddle.Initialize(), or set them for each checkout inPaddle.Checkout.open().


This example includes thesettingsobject as part of the checkout open method. Checkout is opened with these settings.


```javascript
123456789101112131415161718191var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  },
6  {
7    priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
8    quantity: 1
9  }
10];
11
12Paddle.Checkout.open({
13  settings: {
14    displayMode: "overlay",
15    theme: "light",
16    locale: "en"
17  },
18  items: itemsList,
19});
```


To learn more, seePass checkout settings

[Pass checkout settings](/build/checkout/set-up-checkout-default-settings)

You can pass checkout settings usingPaddle.Initialize(), or set them for each checkout inPaddle.Checkout.open().


This example includes thesettingsobject as part of the checkout open method, passing the required settings to open a one-page overlay checkout.


```javascript
1234567891011121314151617181var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  },
6  {
7    priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
8    quantity: 1
9  }
10];
11
12Paddle.Checkout.open({
13  settings: {
14    displayMode: "overlay",
15    variant: "one-page"
16  },
17  items: itemsList,
18});
```


You can prefill checkout properties to speed up checkout.


This example includescustomer,address, andbusinessobjects. Checkout is opened with this information prefilled, so customers land on the payment screen.


There's nosettingsobject, so checkout settings must be included inPaddle.Initialize().


```javascript
12345678910111213141516171819201var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  },
6  {
7    priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
8    quantity: 1
9  }
10];
11
12Paddle.Checkout.open({
13  items: itemsList,
14  customer: {
15    email: "jo@example.com",
16    address: {
17      countryCode: "US",
18      postalCode: "10021",
19      region: "New York",
20      city: "New York",

```


To learn more, seePrefill checkout properties

[Prefill checkout properties](/build/checkout/prefill-checkout-properties)

You can pass Paddle IDs for customers, addresses, and businesses to build upgrade workflows for logged-in customers.


This example includes a customer ID, address ID, and business ID. Checkout is opened with this information prefilled, so customers land on the payment screen.


allowLogoutisfalsein thesettingsobject, hiding the option to change the customer on the opened checkout.


```javascript
12345678910111213141516171819201var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  },
6  {
7    priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
8    quantity: 1
9  }
10];
11
12Paddle.Checkout.open({
13  settings: {
14    displayMode: "overlay",
15    theme: "light",
16    locale: "en",
17    allowLogout: false
18  },
19  items: itemsList,
20  customer: {

```


To learn more, seePrefill checkout properties

[Prefill checkout properties](/build/checkout/prefill-checkout-properties)

You can create a transaction using the API or the Paddle dashboard, then pass it to a checkout to collect for it.


This example passestransactionIDto open a checkout for that transaction.


There's nosettingsobject, so checkout settings must be included inPaddle.Initialize().


```javascript
1231Paddle.Checkout.open({
2  transactionId: "txn_01gp3z8cfkqgdq07hcr3ja0q95"
3});
```


To learn more, seePass a transaction to a checkout

[Pass a transaction to a checkout](/build/transactions/pass-transaction-checkout)

Customers can save payment methods when buying items using Paddle Checkout. You can then present customers with their saved payment methods when making purchases in the future.


You must passcustomerAuthTokenwhen opening a checkout to authenticate a customer and present them with their saved payment methods. You cangenerate an authentication token for a customer using the API.

[generate an authentication token for a customer using the API](/api-reference/customers/generate-customer-authentication-token)

This example passescustomerAuthTokentoPaddle.Checkout.open(), so customers are presented with their saved payment methods.


```javascript
12345678910111213141516171var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  }
6];
7
8Paddle.Checkout.open({
9  items: itemsList,
10  customerAuthToken: "pca_REDACTED_EXAMPLE_CUSTOMER_AUTH_TOKEN",
11  settings: {
12    displayMode: "inline",
13    frameTarget: "checkout-container",
14    frameInitialHeight: "450",
15    frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
16  }
17});
```


To learn more, seePresent saved payment methods at checkout

[Present saved payment methods at checkout](/build/checkout/saved-payment-methods)

Customers can save payment methods when buying items using Paddle Checkout. You can then present customers with their saved payment methods when making purchases in the future.


You must passcustomerAuthTokenwhen opening a checkout to authenticate a customer and present them with their saved payment methods. You cangenerate an authentication token for a customer using the API.

[generate an authentication token for a customer using the API](/api-reference/customers/generate-customer-authentication-token)

You can open a checkout for a specific a payment method that a customer has saved by usingsavedPaymentMethodId, passing the Paddle ID for a saved payment method. You canlist payment methods for a customer using the API.

[list payment methods for a customer using the API](/api-reference/payment-methods/list-payment-methods)

This example passescustomerAuthTokenandsavedPaymentMethodIdtoPaddle.Checkout.open(), so customers are presented with the passed saved payment method.


```javascript
1234567891011121314151617181var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  }
6];
7
8Paddle.Checkout.open({
9  customerAuthToken: "pca_REDACTED_EXAMPLE_CUSTOMER_AUTH_TOKEN",
10  savedPaymentMethodId: "paymtd_01hs8zx6x377xfsfrt2bqsevbw",
11  settings: {
12    displayMode: "inline",
13    frameTarget: "checkout-container",
14    frameInitialHeight: "450",
15    frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
16    items: itemsList
17  }
18});
```


To learn more, seePresent saved payment methods at checkout

[Present saved payment methods at checkout](/build/checkout/saved-payment-methods)

You can present customers with a streamlined purchase flow for upsells at checkout to encourage them to upgrade or purchase additional items if they've previously completed a transaction.


This example passes the previously completed transaction ID asupsell.transactionId, and passesupsell.settings.showSkipButton: falseto hide the "No thanks" skip button at checkout.


```javascript
12345678910111213141516171819201var upsellItems = [
2  {
3    priceId: 'pri_01h1vjfevh5etwq3rb176h9d9w',
4    quantity: 1
5  }
6];
7
8// previousTransactionId was captured from the initial checkout.completed event
9Paddle.Checkout.open({
10  items: upsellItems,
11  customerAuthToken: 'pca_REDACTED_EXAMPLE_CUSTOMER_AUTH_TOKEN',
12  settings: {
13    displayMode: "inline",
14    frameTarget: "checkout-container",
15    frameInitialHeight: "450",
16    frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
17  },
18  upsell: {
19    transactionId: previousTransactionId,
20    settings: {

```


To learn more, seeOpen a checkout for an upsell

[Open a checkout for an upsell](/build/checkout/upsell-checkout)

## Events

[Events](/paddlejs/methods/paddle-checkout-open#related-events)

| checkout.loaded | Emitted when the checkout opens. |
| checkout.customer.created | Emitted when the checkout opens with customer properties prefilled. |

[checkout.loaded](/paddlejs/general/checkout-loaded)
[checkout.customer.created](/paddlejs/customer/checkout-customer-created)

## Related pages

[Related pages](/paddlejs/methods/paddle-checkout-open#related-pages)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/build/checkout/build-overlay-checkout)
[Read more](/paddlejs/methods/paddle-initialize)
- Paddle.Checkout.open()
[Paddle.Checkout.open()](#paddle.checkout.open())
- Parameters
[Parameters](#params)
- Example
[Example](#examples)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:28*
