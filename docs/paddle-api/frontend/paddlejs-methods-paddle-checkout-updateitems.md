# Paddle.Checkout.updateItems()

**Source:** https://developer.paddle.com/paddlejs/methods/paddle-checkout-updateitems

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

# Paddle.Checkout.updateItems()

[Paddle.Checkout.updateItems()](/paddlejs/methods/paddle-checkout-updateitems#paddle.checkout.updateitems())

Updates the list of items for an open checkout.


UsePaddle.Checkout.updateItems()to dynamically update the items list for an open checkout.


Typically used withinline checkoutto update quantities or add addons to the checkout.

[inline checkout](/build/checkout/build-branded-inline-checkout)

To use this method, a checkout should already be opened. UsethePaddle.Checkout.open()methodto open a checkout.

[thePaddle.Checkout.open()method](/paddlejs/methods/paddle-checkout-open)

Pass an array of objects, where each object contains apriceIdandquantityproperty.priceIdshould be a Paddle ID ofa price entity.

[a price entity](/api-reference/prices/overview)
> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.


Paddle expects the complete list of items that you want to be on the checkout — including existing items. If you don't include an existing item, it's removed from the checkout. To learn more, seeWork with lists

[Work with lists](/api-reference/about/lists)
> Use thePaddle.Checkout.updateCheckout()method to update discount and customer information, as well as items. You might do this when you need to swap or remove a discount when updating items.


Use thePaddle.Checkout.updateCheckout()method to update discount and customer information, as well as items. You might do this when you need to swap or remove a discount when updating items.

[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)

## Parameters

[Parameters](/paddlejs/methods/paddle-checkout-updateitems#params)

List of items for this checkout.


Paddle ID of the price for this item.


Quantity for this line item.


## Example

[Example](/paddlejs/methods/paddle-checkout-updateitems#examples)

This example passes an array calleditemsListtoPaddle.Checkout.updateItems().


If successful, the items on the opened checkout are updated.


```javascript
123456789101112131415161var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  },
6  {
7    priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
8    quantity: 1
9  },
10  {
11    priceId: 'pri_01gm82v81g69n9hdb0v9sw6j40',
12    quantity: 1
13  }
14];
15
16Paddle.Checkout.updateItems(itemsList);
```


To learn more, seePass or update checkout items

[Pass or update checkout items](/build/checkout/pass-update-checkout-items)

## Events

[Events](/paddlejs/methods/paddle-checkout-updateitems#related-events)

| checkout.items.updated | Emitted when the checkout items list is updated. |
| checkout.items.removed | Emitted when an item is removed from the checkout. |

[checkout.items.updated](/paddlejs/items/checkout-items-updated)
[checkout.items.removed](/paddlejs/items/checkout-items-removed)

## Related pages

[Related pages](/paddlejs/methods/paddle-checkout-updateitems#related-pages)
[Read more](/paddlejs/methods/paddle-checkout-open)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/build/checkout/pass-update-checkout-items)
- Paddle.Checkout.updateItems()
[Paddle.Checkout.updateItems()](#paddle.checkout.updateitems())
- Parameters
[Parameters](#params)
- Example
[Example](#examples)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:22*
