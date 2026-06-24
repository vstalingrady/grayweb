# Paddle.Initialize()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-initialize

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

# Paddle.Initialize()

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize#paddle.initialize())

Initializes Paddle.js and Retain. Replaces Paddle.Setup().


UsePaddle.Initialize()to initialize Paddle.js and set default checkout settings. This is arequiredmethod, letting you:

- Authenticate with your Paddle account
- Integrate with Retain
- Pass settings that apply to all checkouts opened on a page
- Create event callbacks

You must callPaddle.Initialize()and pass a client-side token to use Paddle Checkout. You cancreate and manage client-side tokensinPaddle > Developer tools > Authentication.

[create and manage client-side tokens](/paddlejs/client-side-tokens#create-client-side-token)
> You can only callPaddle.Initialize()once on a page. You'll get an error if you try to call it more than once. UsePaddle.Update()to updatepwCustomeror pass an updatedeventCallback.


You can only callPaddle.Initialize()once on a page. You'll get an error if you try to call it more than once. UsePaddle.Update()to updatepwCustomeror pass an updatedeventCallback.

[Paddle.Update()](/paddlejs/methods/paddle-update)

You can pass settings for opened checkouts using eitherPaddle.Checkout.open()orPaddle.Initialize(). Settings passed toPaddle.Initialize()aredefault settings, applied to all checkouts opened on a page.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[default settings](/build/checkout/set-up-checkout-default-settings)

Paddle.jsemits events for key actionsas a customer moves through checkout. You can pass aneventCallbacktoPaddle.Initialize()to call a function for every Paddle.js checkout event. This is typically used as part of aninline checkout integrationfor updating on-page elements, like items lists or breadcrumbs.

[emits events for key actions](/paddlejs/events/overview)
[inline checkout integration](/build/checkout/build-branded-inline-checkout)
> Paddle.Initialize()replaces the deprecatedPaddle.Setup()method. It's functionally the same.


Paddle.Initialize()replaces the deprecatedPaddle.Setup()method. It's functionally the same.


### Paddle Retain

[Paddle Retain](/paddlejs/methods/paddle-initialize#background-retain)

Paddle.js integrates with Retain, so you don't have to include a separate Retain script in your app or website. Client-side tokens for live accounts authenticate with both Paddle Billing and Paddle Retain, so there's no need to pass a separate key for Retain.

[Paddle.js integrates with Retain](/concepts/retain/overview)

To use Retain, passpwCustomerfor logged-in customers. You can updatepwCustomerafter initialization usingPaddle.Update().

[Paddle.Update()](/paddlejs/methods/paddle-update)
> Only available for live accounts.Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.


Only available for live accounts.


Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.


## Parameters

[Parameters](/paddlejs/methods/paddle-initialize#params)

Client-side token for authentication. You can create and manage client-side tokens in Paddle > Developer tools > Authentication. Required.


Identifier for a logged-in customer for Paddle Retain. Pass an empty object if you don't have a logged-in customer. Paddle Retain is only loaded for live accounts.


Paddle ID of a customer entity, prefixedctm_. Only customer IDs are accepted. Don't pass subscription IDs, other Paddle IDs, or your own internal identifiers for a customer.


Set general checkout settings. Settings here apply to all checkouts opened on the page.


Configured settings.


Function to call for Paddle.js events.


## Examples

[Examples](/paddlejs/methods/paddle-initialize#examples)

This example passes a client-side token to Paddle.js. This is required.


You can create and manage client-side tokens inPaddle > Developer tools > Authentication.


```javascript
1231Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN'
3});
```


To learn more, seeInclude and initialize Paddle.js

[Include and initialize Paddle.js](/paddlejs/include-paddlejs)

For logged-in users, you should passpwCustomer.


This example passes the Paddle ID for a customer entity in Paddle to Retain.


```javascript
1234561Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN',
3  pwCustomer: {
4    id: 'ctm_01gt25aq4b2zcfw12szwtjrbdt'
5  }
6});
```


Where you don't know the Paddle ID for a customer, you can pass an empty object topwCustomer.


To learn more, seeInitialize Paddle.js with Retain

[Initialize Paddle.js with Retain](/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain)

This example sets default checkout settings for all checkouts opened on a page. It includes common settings forinlinecheckouts.


```javascript
123456789101112131Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "inline",
6      theme: "light",
7      locale: "en",
8      frameTarget: "checkout-container",
9      frameInitialHeight: "450",
10      frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;"
11    }
12  }
13});
```


To learn more, seePass checkout settings

[Pass checkout settings](/build/checkout/set-up-checkout-default-settings)

This example sets default checkout settings for all checkouts opened on a page. It includes the required settings to open a one-page inline checkout.


```javascript
12345678910111213141Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "inline",
6      variant: "one-page",
7      theme: "light",
8      locale: "en",
9      frameTarget: "checkout-container",
10      frameInitialHeight: "450",
11      frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;"
12    }
13  }
14});
```


This example sets default checkout settings for all checkouts opened on a page. It includes common settings foroverlaycheckouts.


```javascript
123456789101Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "overlay",
6      theme: "light",
7      locale: "en"
8    }
9  }
10});
```


To learn more, seePaddle.js events

[Paddle.js events](/paddlejs/events/overview)

This example logs events emitted by Paddle.js to console.


```javascript
1234561Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  eventCallback: function(data) {
4    console.log(data);
5  }
6});
```


To learn more, seePaddle.js events

[Paddle.js events](/paddlejs/events/overview)

This example uses a switch statement to log some text to console based on events emitted by Paddle.js.


```javascript
1234567891011121314151617181Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  eventCallback: function(data) {
4    switch(data.name) {
5      case "checkout.loaded":
6        console.log("Checkout opened");
7        break;
8      case "checkout.customer.created":
9        console.log("Customer created");
10        break;
11      case "checkout.completed":
12        console.log("Checkout completed");
13        break;
14      default:
15        console.log(data);
16    }
17  }
18});
```


To learn more, seePaddle.js events

[Paddle.js events](/paddlejs/events/overview)

## Related pages

[Related pages](/paddlejs/methods/paddle-initialize#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/paddlejs/events/overview)
[Read more](/paddlejs/methods/paddle-checkout-open)
- Paddle.Initialize()
[Paddle.Initialize()](#paddle.initialize())
- Paddle Retain
[Paddle Retain](#background-retain)
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:35*
