# Paddle.Checkout.updateCheckout()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-checkout-updatecheckout

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

# Paddle.Checkout.updateCheckout()

[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout#paddle.checkout.updatecheckout())

Updates the list of items, discounts, customer, address, and business for an open checkout.


UsePaddle.Checkout.updateCheckout()to dynamically update the items list, discount, and customer information for an open checkout.


This method is similar toPaddle.Checkout.updateItems(), but also lets you pass discount and customer information. Typically used withinline checkoutto change the items list while adding, removing, or changing a discount.

[Paddle.Checkout.updateItems()](/paddlejs/methods/paddle-checkout-updateitems)
[inline checkout](/build/checkout/build-branded-inline-checkout)

To use this method, a checkout should already be opened. UsethePaddle.Checkout.open()methodto open a checkout.

[thePaddle.Checkout.open()method](/paddlejs/methods/paddle-checkout-open)

To update items, pass an array of objects, where each object contains apriceIdandquantityproperty.priceIdshould be a Paddle ID ofa price entity.

[a price entity](/api-reference/prices/overview)
> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Paddle expects the complete list of items that you want to be on the checkout — including existing items. If you don't include an existing item, it's removed from the checkout. To learn more, seeWork with lists

[Work with lists](/api-reference/about/lists)

## Parameters

[Parameters](/paddlejs/methods/paddle-checkout-updatecheckout#params)

List of items for this checkout. You must pass at least one item. Use theupdateItems()orupdateCheckout()method to update the items list.


Paddle ID of the price for this item.


Quantity for this line item.


Information about the customer for this checkout. Pass either an existingid, or the other fields.


Paddle ID of the customer for this checkout. Use if you know the customer, like if they're authenticated and making a change to their subscription. You can't use if you're passingemail.


Email for this customer. You can't use if you're passingid.


Information about the customer address for this checkout. Pass either an existingid, or the other fields.


Information about the customer business for this checkout. Pass either an existingid, or the other fields.


Discount code to apply to this checkout. Use to prepopulate a discount. Pass eitherdiscountCodeordiscountId.


Paddle ID of a discount to apply to this checkout. Use to prepopulate a discount. Pass eitherdiscountCodeordiscountId.


Your own structured key-value data to include with this checkout. Passed data is held against the related transaction. If a transaction is for recurring items, custom data is copied to the related subscription when created.


If custom data already exists, it's replaced. Must be valid JSON and contain at least one key.


## Examples

[Examples](/paddlejs/methods/paddle-checkout-updatecheckout#examples)

This example passes an array of items and a discount code toPaddle.Checkout.updateCheckout().


If successful, the items and the discount on the opened checkout are updated.


```javascript
1234567891011121314151var updatedItemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 10
5  },
6  {
7    priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
8    quantity: 1
9  }
10];
11
12Paddle.Checkout.updateCheckout({
13  items: updatedItemsList,
14  discountCode: "BF20OFF"
15});
```


To learn more, seePass or update checkout items

[Pass or update checkout items](/build/checkout/pass-update-checkout-items)

This example passescustomDatatoPaddle.Checkout.updateCheckout().


If successful, custom data on the open checkout is updated.


```javascript
123456781Paddle.Checkout.updateCheckout({
2  customData: {
3    "utm_medium": "social",
4    "utm_source": "linkedin",
5    "utm_content": "launch-video",
6    "integration_id": "AA-123"
7  }
8});
```


To learn more, seeWork with custom data

[Work with custom data](/build/transactions/custom-data)

## Events

[Events](/paddlejs/methods/paddle-checkout-updatecheckout#related-events)

| checkout.updated | Emitted when the checkout is updated usingPaddle.Checkout.updateCheckout(). |
| checkout.items.updated | Emitted when the checkout items list is updated. |
| checkout.items.removed | Emitted when an item is removed from the checkout. |
| checkout.discount.applied | Emitted when an update to a checkout applies a discount. |
| checkout.discount.removed | Emitted when an update to a checkout removes a discount. |
| checkout.customer.updated | Emitted when an update to a checkout updates a customer. |
| checkout.customer.removed | Emitted when an update to a checkout removes a customer. |

[checkout.updated](/paddlejs/general/checkout-updated)
[checkout.items.updated](/paddlejs/items/checkout-items-updated)
[checkout.items.removed](/paddlejs/items/checkout-items-removed)
[checkout.discount.applied](/paddlejs/discount/checkout-discount-applied)
[checkout.discount.removed](/paddlejs/discount/checkout-discount-removed)
[checkout.customer.updated](/paddlejs/customer/checkout-customer-updated)
[checkout.customer.removed](/paddlejs/customer/checkout-customer-removed)

## Related pages

[Related pages](/paddlejs/methods/paddle-checkout-updatecheckout#related-pages)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/build/checkout/set-up-checkout-default-settings)
[Read more](/paddlejs/methods/paddle-checkout-updateitems)
- Paddle.Checkout.updateCheckout()
[Paddle.Checkout.updateCheckout()](#paddle.checkout.updatecheckout())
- Parameters
[Parameters](#params)
- Examples
[Examples](#examples)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:32*
