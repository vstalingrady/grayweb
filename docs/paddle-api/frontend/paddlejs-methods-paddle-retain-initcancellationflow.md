# Paddle.Retain.initCancellationFlow()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-retain-initcancellationflow

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

# Paddle.Retain.initCancellationFlow()

[Paddle.Retain.initCancellationFlow()](/paddlejs/methods/paddle-retain-initcancellationflow#paddle.retain.initcancellationflow())

Starts a Paddle Retain cancellation flow for a subscription.


UsePaddle.Retain.initCancellationFlow()to start a Paddle Retain cancellation flow for a subscription.


Cancellation Flowshelp you save customers from canceling by presenting them with dynamic salvage attempts while gathering cancellation insights. Retain automatically schedules a cancellation for the subscription in Paddle Billing if a customer proceeds to cancel.

[Cancellation Flows](/build/retain/configure-cancellation-flows-surveys)

Typically used as part ofa cancel subscription workflow.

[a cancel subscription workflow](/build/retain/configure-cancellation-flows-surveys)
> Only available for live accounts.Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.


Only available for live accounts.


Paddle Retain runs on live data. While you can initialize Paddle.js with Retain in sandbox accounts, Retain features aren't loaded there.

> This method is for Paddle Billing only. If you use Cancellation Flows with another billing platform, use theprofitwellmethod in the ProfitWell.js snippet instead. To learn more, seeConfigure Cancellation Flows and salvage offers


This method is for Paddle Billing only. If you use Cancellation Flows with another billing platform, use theprofitwellmethod in the ProfitWell.js snippet instead. To learn more, seeConfigure Cancellation Flows and salvage offers

[Configure Cancellation Flows and salvage offers](/build/retain/configure-cancellation-flows-surveys)

To specify a subscription to cancel, pass asubscriptionIdparameter. This is recommended, but not required where customers only have one subscription and you passedpwCustomertoPaddle.Initialize()orPaddle.Update().

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
[Paddle.Update()](/paddlejs/methods/paddle-update)

## Parameters

[Parameters](/paddlejs/methods/paddle-retain-initcancellationflow#params)

Paddle ID of the subscription to cancel. Required where a customer has multiple subscriptions and wherepwCustomerhas not been passed toPaddle.Initialize()orPaddle.Update(). Paddle Billing only.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
[Paddle.Update()](/paddlejs/methods/paddle-update)

## Returns

[Returns](/paddlejs/methods/paddle-retain-initcancellationflow#returns)

Status of the cancellation flow.


Information about the salvage attempts that the customer was shown.nullif salvage attempts not presented, like if they chose not to cancel or closed the modal.


Whether the customer decided to accept or reject salvage attempts.


Whether the customer chose to cancel. Customers may accept a salvage attempt but still choose to cancel. For example, customers may choose to accept a contact support salvage attempt, but still proceed to cancel their subscription.


Whether the salvage attempt encountered an error. For example, there was a problem pausing a subscription.


Information about the salvage offer that the customer was shown.nullif salvage offers not presented, like if they chose not to cancel or closed the modal.


Whether the customer decided to accept or reject a salvage offer.


Whether the salvage offer encountered an error. For example, there was a problem applying a discount.


Additional feedback left by the customer.nullif no feedback or not presented to the customer.


Reason for cancellation left by the customer. This is the first question on the survey presented to the customer.nullif customer chose not to cancel or closed the modal.


Satisfaction insight selected by the customer. This is the second question on the survey presented to the customer.nullif customer chose not to cancel or closed the modal.


Salvage attempt presented to the customer based on their satisfaction insight.nullif customer chose not to cancel or closed the modal.


Salvage attempt accepted by the customer.nullif customer chose not to cancel, closed the modal, or does not accept a salvage attempt.


## Examples

[Examples](/paddlejs/methods/paddle-retain-initcancellationflow#examples)

This example shows how you can usePaddle.Retain.initCancellationFlow()to start a cancellation flow.


subscriptionIdis passed toPaddle.Retain.initCancellationFlow()to specify the subscription to cancel.


pwCustomeris passed toPaddle.Initialize()to identify the customer to Paddle Retain, but this isn't required. Paddle Retain infers the customer from thesubscriptionIdpassed and presents a cancellation flow.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

Retain automatically schedules a cancellation for the subscription in Paddle Billing if a customer proceeds to cancel, so you don't need to build logic to handle this yourself.


```html
123456789101<!-- Cancellation button -->
2<button onclick="cancelSubscription();">Cancel my subscription</button>
3
4<script type="text/javascript">
5  function cancelSubscription() {
6    Paddle.Retain.initCancellationFlow({
7      subscriptionId: 'sub_01h8bqcrwp0vjd1p3bv20y7323'
8    });
9  }
10</script>
```


To learn more, seeBuild cancellation surveys and offers

[Build cancellation surveys and offers](/build/retain/configure-cancellation-flows-surveys)

This example shows how you can attach a callback to a cancellation flow.


It uses the.then()method to attach a callback that logs a message to the console:

- Customer retainedThe customer accepted a salvage attempt or a salvage offer, or chose not to cancel.

Customer retained


The customer accepted a salvage attempt or a salvage offer, or chose not to cancel.

- There was a problem starting the cancellation flow.Something went wrong while starting the cancellation flow. The customer wasn't given the chance to cancel.

There was a problem starting the cancellation flow.


Something went wrong while starting the cancellation flow. The customer wasn't given the chance to cancel.

- Customer proceeded with cancellation.The customer rejected salvage attempts and salvage offers and proceeded to cancel.

Customer proceeded with cancellation.


The customer rejected salvage attempts and salvage offers and proceeded to cancel.


```html
12345678910111213141516171819201<!-- Cancellation button -->
2<button onclick="cancelSubscription();">Cancel my subscription</button>
3
4<script type="text/javascript">
5  // Cancel subscription 
6  function cancelSubscription() {
7    Paddle.Retain.initCancellationFlow({
8      subscriptionId: 'sub_01h8bqcrwp0vjd1p3bv20y7323'
9    })
10    .then((result) => {
11      if (result.status === 'retained' || result.status === 'aborted') {
12        console.log("Customer retained!");
13      } else if (result.status === 'error') {
14        console.log("There was a problem starting the cancellation flow.");
15      } else {
16        console.log("Customer proceeded with cancellation.");
17      }
18    })
19    .catch((error) => {
20      console.error(error);

```


To learn more, seeBuild cancellation surveys and offers

[Build cancellation surveys and offers](/build/retain/configure-cancellation-flows-surveys)

## Related pages

[Related pages](/paddlejs/methods/paddle-retain-initcancellationflow#related-pages)
[Read more](/build/retain/configure-cancellation-flows-surveys)
[Read more](/build/retain/set-up-retain-profitwell)
[Read more](/paddlejs/test-retain)
- Paddle.Retain.initCancellationFlow()
[Paddle.Retain.initCancellationFlow()](#paddle.retain.initcancellationflow())
- Parameters
[Parameters](#params)
- Returns
[Returns](#returns)
- Examples
[Examples](#examples)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:25*
