# Paddle.js events

**Source:** https://developer.paddle.com/paddlejs/events/overview

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

# Paddle.js events

[Paddle.js events](/paddlejs/events/overview#paddle.js-events)

Paddle.js emits events as part of the checkout journey. Use events to update elements in your frontend for inline checkout, or for analytics purposes.


As a customer moves through the checkout, Paddle.js emits events for key actions like:

- When the checkout is opened, closed, or completed
- When customer information is added, updated, or removed
- When items are added, removed, or updated
- When payments are attempted and outcomes of payment attempts
- When discounts are added or removed
- When an upsell is skipped

You can pass aneventCallbackparameter as part ofthePaddle.Initialize()methodto run behaviors based on customer interactions with your checkout. You'll typically use this to show and update on-page information when buildingan inline checkout.

[thePaddle.Initialize()method](/paddlejs/methods/paddle-initialize)
[an inline checkout](/build/checkout/build-branded-inline-checkout)

## Attributes

[Attributes](/paddlejs/events/overview#attributes)

Name of this event, in the formatentity.event_type.


Event payload.


Unique Paddle ID for this checkout, prefixed withche_.


Unique Paddle ID for the transaction related to this checkout, prefixed withtxn_.


Status of this checkout.


Key-value pairs of custom data. Must be valid JSON and contain at least one key.


Supported three-letter ISO 4217 currency code for this checkout.


Information about the customer on this checkout.


Items to bill for.


Financial breakdown of the total for this checkout, calculated by Paddle.


Financial breakdown of the recurring total for this checkout, calculated by Paddle.  Only included where there are recurring items.


Information about the payment details used on this checkout.


Checkout settings.


Information about the discount applied to this checkout. Only included when a discount is applied.


Context about the rendered upsell checkout.nullif an upsell flow was not rendered.


### Common attributes

[Common attributes](/paddlejs/events/overview#attributes-useful-fields)

Whenbuilding an inline checkout, you can write an event callback function to present totals and other information.

[building an inline checkout](/build/checkout/build-branded-inline-checkout)

Here are some commonly used fields in Paddle.js events that you might like to use in your implementation:


| data.items[].product.name | Product name for itemized breakdowns. |
| data.items[].price_name | Price name. Typically describes how often this item bills. |
| data.items[].trial_period | Details about the trial period for an item, if any. |
| data.items[].billing_cycle | How often an item is billed, if recurring. |
| data.items[].totals.subtotal | Total for an item, excluding tax and discount. |
| data.totals.total | Grand total for a transaction, including tax and discount. |
| data.recurring_totals.total | Recurring total for a transaction, including tax and discount. |
| (data.totals.total-data.recurring_totals.total) | Where transactions contain a mix of one-time charges and recurring items, subtract a value indata.recurring_totalsfrom the corresponding value indata.totalsto calculate one-time charge totals. |

> For compliance and the best customer experience, inline checkout implementations must include a description of what's being purchased, transaction totals, billing frequency (if recurring), and information about any trial periods (if applicable).


For compliance and the best customer experience, inline checkout implementations must include a description of what's being purchased, transaction totals, billing frequency (if recurring), and information about any trial periods (if applicable).


## List of events

[List of events](/paddlejs/events/overview#events)

| Event name | Details |
| --- | --- |
| checkout.loaded | Checkout created and loaded on the page. |
| checkout.closed | Checkout closed on the page. |
| checkout.updated | Checkout updated on the page. |
| checkout.completed | Checkout completed successfully. |
| checkout.items.updated | Item updated on the checkout. For example, a quantity change. |
| checkout.items.removed | Item removed from the checkout. |
| checkout.customer.created | Customer created. |
| checkout.customer.updated | Customer information updated. This includes business and address information. |
| checkout.customer.removed | Customer removed from the checkout, meaning they clicked 'Not you?' to reenter their details. |
| checkout.payment.selected | Payment method selected. |
| checkout.payment.initiated | Customer attempted payment using the selected payment method. |
| checkout.payment.failed | Payment attempt failed. |
| checkout.discount.applied | Discount applied to the checkout. |
| checkout.discount.removed | Discount removed from the checkout. |
| checkout.warning | Warning occurred on the checkout. |
| checkout.error | Error occurred on the checkout. |
| checkout.upsell.canceled | Upsell skipped and checkout canceled. |

[checkout.loaded](/paddlejs/general/checkout-loaded)
[checkout.closed](/paddlejs/general/checkout-closed)
[checkout.updated](/paddlejs/general/checkout-updated)
[checkout.completed](/paddlejs/general/checkout-completed)
[checkout.items.updated](/paddlejs/items/checkout-items-updated)
[checkout.items.removed](/paddlejs/items/checkout-items-removed)
[checkout.customer.created](/paddlejs/customer/checkout-customer-created)
[checkout.customer.updated](/paddlejs/customer/checkout-customer-updated)
[checkout.customer.removed](/paddlejs/customer/checkout-customer-removed)
[checkout.payment.selected](/paddlejs/payment/checkout-payment-selected)
[checkout.payment.initiated](/paddlejs/payment/checkout-payment-initiated)
[checkout.payment.failed](/paddlejs/payment/checkout-payment-failed)
[checkout.discount.applied](/paddlejs/discount/checkout-discount-applied)
[checkout.discount.removed](/paddlejs/discount/checkout-discount-removed)
[checkout.warning](/paddlejs/general/checkout-warning)
[checkout.error](/paddlejs/general/checkout-error)
[checkout.upsell.canceled](/paddlejs/upsell/checkout-upsell-canceled)

## Related pages

[Related pages](/paddlejs/events/overview#related-pages)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/paddlejs/include-paddlejs)
- Paddle.js events
[Paddle.js events](#paddle.js-events)
- Attributes
[Attributes](#attributes)
- Common attributes
[Common attributes](#attributes-useful-fields)
- List of events
[List of events](#events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:16*
