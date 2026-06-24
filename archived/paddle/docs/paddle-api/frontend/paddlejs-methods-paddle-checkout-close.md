# Paddle.Checkout.close()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-checkout-close

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

# Paddle.Checkout.close()

[Paddle.Checkout.close()](/paddlejs/methods/paddle-checkout-close#paddle.checkout.close())

Closes an opened checkout.


UsePaddle.Checkout.close()to closean opened checkout.

[an opened checkout](/paddlejs/methods/paddle-checkout-open)

Typically used when working withoverlay checkoutto close the Paddle Checkout overlay. If used withinline checkout, removes the Paddle Checkout iframe from the DOM.

[overlay checkout](/concepts/sell/overlay-checkout)
[inline checkout](/concepts/sell/branded-integrated-inline-checkout)
> For success workflows, you can redirect to a success URL or pass aneventCallbacktoPaddle.Initialize()forcheckout.completed.To learn more, seeHandle checkout success.


For success workflows, you can redirect to a success URL or pass aneventCallbacktoPaddle.Initialize()forcheckout.completed.


To learn more, seeHandle checkout success.

[Handle checkout success](/build/checkout/handle-success-post-checkout)

## Example

[Example](/paddlejs/methods/paddle-checkout-close#examples)

This example shows how you can usePaddle.Checkout.close()to close an inline checkout.


```html
12345678910111213141516171819201<!-- Checkout buttons -->
2<button onclick="openCheckout();">Open checkout</button>
3<button onclick="closeCheckout();">Close checkout</button>
4
5<!-- Inline checkout container -->
6<div class="checkout-container"></div>
7
8<script type="text/javascript">
9  Paddle.Initialize({
10    token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN'
11  });
12
13  function openCheckout() {
14    var items = [{
15        priceId: 'pri_01gsz8x8sawmvhz1pv30nge1ke',
16        quantity: 10
17      },
18      {
19        priceId: 'pri_01gsz95g2zrkagg294kpstx54r',
20        quantity: 1

```


## Events

[Events](/paddlejs/methods/paddle-checkout-close#related-events)

| checkout.closed | Emitted when the checkout is closed. |

[checkout.closed](/paddlejs/general/checkout-closed)

## Related pages

[Related pages](/paddlejs/methods/paddle-checkout-close#related-pages)
[Read more](/build/checkout/prefill-checkout-properties)
[Read more](/build/checkout/set-up-checkout-default-settings)
[Read more](/paddlejs/methods/paddle-checkout-open)
- Paddle.Checkout.close()
[Paddle.Checkout.close()](#paddle.checkout.close())
- Example
[Example](#examples)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:20*
