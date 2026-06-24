# Paddle.Spinner.hide()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-spinner-hide

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

Deprecated


# Paddle.Spinner.hide()

[Paddle.Spinner.hide()](/paddlejs/methods/paddle-spinner-hide#paddle.spinner.hide())

Hides a previously called loading spinner.


UsePaddle.Spinner.hide()to hide a loading spinner that was previously called usingPaddle.Spinner.show(). The spinner appears full screen on a darkened background.

[Paddle.Spinner.show()](/paddlejs/methods/paddle-spinner-show)

Not needed when working with overlay checkout, as overlay checkout automatically shows a spinner when a checkout is loading.


Typically paired withthePaddle.Spinner.show()methodwhen loading an inline checkout in response to an event.

[thePaddle.Spinner.show()method](/paddlejs/methods/paddle-spinner-show)

## Example

[Example](/paddlejs/methods/paddle-spinner-hide#examples)

This example shows howPaddle.Spinner.hide()can be called as part of an open checkout function.


eventCallbackis used inPaddle.Initialize()to callPaddle.Spinner.hide()whenthecheckout.loadedeventis emitted.

[thecheckout.loadedevent](/paddlejs/general/checkout-loaded)

```html
12345678910111213141516171819201<!-- Checkout button -->
2<button onclick="openCheckout();">Buy</button>
3
4<!-- Inline checkout container -->
5<div class="checkout-container"></div>
6
7<script type="text/javascript">
8  Paddle.Initialize({
9    token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN',
10    // Event callback to hide spinner once `checkout.loaded` is emitted
11    eventCallback: function(data) {
12      console.log(data);
13      if (data.name == "checkout.loaded") {
14        Paddle.Spinner.hide();
15      };
16    }
17  });
18  
19  function openCheckout() {
20    var items = [{

```


## Related pages

[Related pages](/paddlejs/methods/paddle-spinner-hide#related-pages)
[Read more](/paddlejs/methods/paddle-spinner-show)
[Read more](/paddlejs/methods/paddle-checkout-open)
[Read more](/paddlejs/events/overview)
- Paddle.Spinner.hide()
[Paddle.Spinner.hide()](#paddle.spinner.hide())
- Example
[Example](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:23*
