# Include and initialize Paddle.js

**Source:** https://developer.paddle.com/paddlejs/include-paddlejs

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

# Include and initialize Paddle.js

[Include and initialize Paddle.js](/paddlejs/include-paddlejs#include-and-initialize-paddle.js)

Include Paddle.js on your website to start building checkout experiences with Paddle. Initialize and authenticate by passing a client-side token.


You can manually load the Paddle.js script on your website using a script tag.


## Add the script tag to your HTML

[Add the script tag to your HTML](/paddlejs/include-paddlejs#manual)

Add the Paddle.js script to the<head>section of your HTML:


```html
11<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
```

> Always load Paddle.js directly fromhttps://cdn.paddle.com/. This makes sure that you're running with the latest security and feature updates from Paddle.


Always load Paddle.js directly fromhttps://cdn.paddle.com/. This makes sure that you're running with the latest security and feature updates from Paddle.


## Initialize and authenticate

[Initialize and authenticate](/paddlejs/include-paddlejs#manual-initialize-paddlejs)

You need aclient-side tokento authenticate with Paddle.js.Create a tokeninPaddle > Developer tools > Authentication.

[client-side token](/paddlejs/client-side-tokens)
[Create a token](/paddlejs/client-side-tokens#create-client-side-token)
> Never useAPI keyswith Paddle.js. API keys should be kept secret and away from the frontend.Revoke the keyif it has been compromised. Useclient-side tokensstarting withtest_orlive_.


Never useAPI keyswith Paddle.js. API keys should be kept secret and away from the frontend.Revoke the keyif it has been compromised. Useclient-side tokensstarting withtest_orlive_.

[API keys](/api-reference/about/api-keys#format)
[Revoke the key](/api-reference/about/api-keys#revoke-api-key)
[client-side tokens](/paddlejs/client-side-tokens)
`test_`
`live_`

Initialize Paddle.js by calling thePaddle.Initialize()methodwith a configuration object that includes a client-side token as thetokenproperty:

[Paddle.Initialize()method](/paddlejs/methods/paddle-initialize)

```html
1234561<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Initialize({ 
4    token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN' // replace with a client-side token
5  });
6</script>
```


### Setup Retain

[Setup Retain](/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain)

Paddle.js integrates with Retain, so you don't have to include a separate Retain script in your app or website.Client-side tokensfor live accounts authenticate with both Paddle Billing and Paddle Retain, so there's no need to pass a separate key for Retain.

[Paddle.js integrates with Retain](/concepts/retain/overview)
[Client-side tokens](/paddlejs/client-side-tokens)

You should initialize Paddle.js in the following places to take full advantage of Retain:

1. Public-facing pageRetain emails link back to your site, so customers can complete or confirm actions. Initialize Paddle.js on a public-facing marketing page that Retain can redirect to, like your homepage or pricing page.

Public-facing page

[Public-facing page](/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain-marketing)

Retain emails link back to your site, so customers can complete or confirm actions. Initialize Paddle.js on a public-facing marketing page that Retain can redirect to, like your homepage or pricing page.

1. In-app authenticated pagesInitialize Paddle.js on logged-in, authenticated pages so Retain can send in-apppayment recoveryandterm optimizationnotifications, and display in-appcancellation flows.

In-app authenticated pages

[In-app authenticated pages](/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain-in-app)

Initialize Paddle.js on logged-in, authenticated pages so Retain can send in-apppayment recoveryandterm optimizationnotifications, and display in-appcancellation flows.

[payment recovery](/build/retain/configure-payment-recovery-dunning)
[term optimization](/build/retain/configure-term-optimization-automatic-upgrades)
[cancellation flows](/build/retain/configure-cancellation-flows-surveys)

#### Public-facing site

[Public-facing site](/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain-marketing)

For public-facing pages, you can use thestandard initialization scriptfrom the previous step without any extra configuration.

[standard initialization script](/paddlejs/include-paddlejs#manual-initialize-paddlejs)

#### In-app authenticated pages

[In-app authenticated pages](/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain-in-app)

You need to include apwCustomerobject in the configuration object passed to thePaddle.Initialize()method. Theidproperty of thepwCustomerobject must be the Paddle ID of acustomer entity. Other IDs and internal identifiers for a customer don't work with Retain.

[Paddle.Initialize()method](/paddlejs/methods/paddle-initialize)
[customer entity](/api-reference/customers/overview)

Identifier for a logged-in customer for Paddle Retain. Pass an empty object if you don't have a logged-in customer. Paddle Retain is only loaded for live accounts.


Paddle ID of a customer entity, prefixedctm_. Only customer IDs are accepted. Don't pass subscription IDs, other Paddle IDs, or your own internal identifiers for a customer.


```html
1234567891<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Initialize({
4    token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
5    pwCustomer: {
6      id: 'ctm_01gt25aq4b2zcfw12szwtjrbdt' // replace with a customer Paddle ID
7    }
8  });
9</script>
```

> Only available for live accounts.Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.


Only available for live accounts.


Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.


## Related pages

[Related pages](/paddlejs/include-paddlejs#related-pages)
[Read more](/concepts/retain/overview)
[Read more](/paddlejs/methods/paddle-initialize)
[Read more](/build/checkout/set-up-checkout-default-settings)
- Include and initialize Paddle.js
[Include and initialize Paddle.js](#include-and-initialize-paddle.js)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:37*
