# Create and manage discounts

**Source:** https://developer.paddle.com/build/products/offer-discounts-promotions-coupons

---

- Overview
[Overview](/build/overview)
- Setup guides
- Get started
[Get started](/build/onboarding/overview)
- Setup checklist
[Setup checklist](/build/onboarding/set-up-checklist)
- Go-live checklist
[Go-live checklist](/build/onboarding/go-live-checklist)
- Tutorials
- Build a pricing page
[Build a pricing page](/build/checkout/build-pricing-page)
- Build an overlay checkout
[Build an overlay checkout](/build/checkout/build-overlay-checkout)
- Build an inline checkout
[Build an inline checkout](/build/checkout/build-branded-inline-checkout)
- Build and deploy a Next.js app
[Build and deploy a Next.js app](/build/nextjs-supabase-vercel-starter-kit)
- Launch checkout from iOS
- Create a cardless trial
[Create a cardless trial](/build/subscriptions/cardless-trials)
- Product catalog
- Create products and prices
[Create products and prices](/build/products/create-products-prices)
- Localize prices
[Localize prices](/build/products/offer-localized-pricing)
- Create and manage discounts
[Create and manage discounts](/build/products/offer-discounts-promotions-coupons)
- Checkout
- Pass checkout settings
[Pass checkout settings](/build/checkout/set-up-checkout-default-settings)
- Pass or update checkout items
[Pass or update checkout items](/build/checkout/pass-update-checkout-items)
- Prefill checkout properties
[Prefill checkout properties](/build/checkout/prefill-checkout-properties)
- Handle checkout success
[Handle checkout success](/build/checkout/handle-success-post-checkout)
- Present saved payment methods
[Present saved payment methods](/build/checkout/saved-payment-methods)
- Brand inline checkout
[Brand inline checkout](/build/checkout/brand-customize-inline-checkout)
- Open a checkout for an upsell
[Open a checkout for an upsell](/build/checkout/upsell-checkout)
- Recover abandoned checkouts
[Recover abandoned checkouts](/build/checkout/checkout-recovery)
- Work with custom subdomains
[Work with custom subdomains](/build/checkout/custom-subdomains)
- Invoices
- Create and issue an invoice
[Create and issue an invoice](/build/invoices/create-issue-invoices)
- Cancel an invoice
[Cancel an invoice](/build/invoices/cancel-invoices)
- Transactions
- Create a transaction
[Create a transaction](/build/transactions/create-transaction)
- Set your default payment link
[Set your default payment link](/build/transactions/default-payment-link)
- Bill for non-catalog items
[Bill for non-catalog items](/build/transactions/bill-create-custom-items-prices-products)
- Pass a transaction to a checkout
[Pass a transaction to a checkout](/build/transactions/pass-transaction-checkout)
- Revise billed customer details
[Revise billed customer details](/build/sell/transactions/revise-transaction-customer-details)
- Change collection mode
[Change collection mode](/build/transactions/change-collection-mode-transaction)
- Refund or credit a transaction
[Refund or credit a transaction](/build/transactions/create-transaction-adjustments)
- Work with custom data
[Work with custom data](/build/transactions/custom-data)
- Subscriptions
- Add or remove items
[Add or remove items](/build/subscriptions/add-remove-products-prices-addons)
- Upgrade or downgrade
[Upgrade or downgrade](/build/subscriptions/replace-products-prices-upgrade-downgrade)
- Bill for one-time charges
[Bill for one-time charges](/build/subscriptions/bill-add-one-time-charge)
- Change billing dates
[Change billing dates](/build/subscriptions/change-billing-dates)
- Update payment details
[Update payment details](/build/subscriptions/update-payment-details)
- Pause a subscription
[Pause a subscription](/build/subscriptions/pause-subscriptions)
- Cancel a subscription
[Cancel a subscription](/build/subscriptions/cancel-subscriptions)
- Provisioning
- Provision your app
[Provision your app](/build/subscriptions/provision-access-webhooks)
- Subscription creation
[Subscription creation](/build/lifecycle/subscription-creation)
- Subscription renewal
[Subscription renewal](/build/lifecycle/subscription-renewal)
- Subscription past due
[Subscription past due](/build/lifecycle/subscription-renewal-dunning)
- Subscription pause or resume
[Subscription pause or resume](/build/lifecycle/subscription-pause-resume)
- Subscription cancellation
[Subscription cancellation](/build/lifecycle/subscription-cancellation)
- Payment details update
[Payment details update](/build/lifecycle/payment-details-update)
- Retain
- Set up Paddle Retain
[Set up Paddle Retain](/build/retain/set-up-retain-profitwell)
- Configure recovery and dunning
[Configure recovery and dunning](/build/retain/configure-payment-recovery-dunning)
- Build cancellation surveys
[Build cancellation surveys](/build/retain/configure-cancellation-flows-surveys)
- Proactively upgrade plans
[Proactively upgrade plans](/build/retain/configure-term-optimization-automatic-upgrades)
- Trials
- Work with trials
[Work with trials](/build/subscriptions/update-trials)
- Extend or activate a trial
[Extend or activate a trial](/build/subscriptions/extend-activate-change-date-trials)
- Customers
- Create or update a customer
[Create or update a customer](/build/customers/create-update-customers)
- Work with credit balances
[Work with credit balances](/build/customers/get-customer-credit-balances)
- Get customer portal links
[Get customer portal links](/build/customers/integrate-customer-portal)
- Reporting
- Generate reports
[Generate reports](/build/finance/generate-reports)
- Report types
- Developer tools
- Use sandbox accounts
[Use sandbox accounts](/build/tools/sandbox)
- Connect Paddle and AI
[Connect Paddle and AI](/build/tools/mcp)

# Create and manage discounts

[Create and manage discounts](/build/products/offer-discounts-promotions-coupons#create-and-manage-discounts)

Attract new customers and entice existing ones to upgrade using discounts. They're sometimes called promotions or coupons.


Discounts let you reduce the amount that a customer has to pay. You may run discounts as part of promotions, or as a way to incentivize customers to upgrade or buy more.


## How it works

[How it works](/build/products/offer-discounts-promotions-coupons#background)

Discounts are applied to the total value of the checkout or transaction. The type of discount determines how the total is impacted.


#### Percentage

[Percentage](/build/products/offer-discounts-promotions-coupons#percentage)

A set percentage taken from the full value of the checkout or transaction.


For example, if the total is $100 and the discount is 10%, the customer pays $90.


#### Flat amount

[Flat amount](/build/products/offer-discounts-promotions-coupons#flat-amount)

A set amount that's subtracted from the full value of the checkout or transaction.


For example, if the total is $100 and the discount is $20, the customer pays $80.


#### Per unit amount

[Per unit amount](/build/products/offer-discounts-promotions-coupons#per-unit-amount)

A set amount that's subtracted from each quantity of an item in the checkout or transaction.


For example, if there are 10 items at $10 each and the discount is $5, the customer pays $50.


### Redemptions

[Redemptions](/build/products/offer-discounts-promotions-coupons#background-redeeming-discounts)

A transaction can be discounted in two ways:

- Customer applying a discount codeDuring checkout, the customer can enter a discount code. You can set whether discounts can be applied at checkout or whether they're turned off when youinitialize Paddle.jsoropen the checkout.

Customer applying a discount code


During checkout, the customer can enter a discount code. You can set whether discounts can be applied at checkout or whether they're turned off when youinitialize Paddle.jsoropen the checkout.

[initialize Paddle.js](/paddlejs/include-paddlejs)
[open the checkout](/paddlejs/methods/paddle-checkout-open)
- Applying a discount to a transaction directlyYou can open a checkout with a discount already applied, or add a discount to any transaction that hasn't yet been billed.

Applying a discount to a transaction directly


You can open a checkout with a discount already applied, or add a discount to any transaction that hasn't yet been billed.

> You can't apply a discount to a transaction that's already been billed. You should use an adjustment torefund or credit a transactioninstead.


You can't apply a discount to a transaction that's already been billed. You should use an adjustment torefund or credit a transactioninstead.

[refund or credit a transaction](/build/transactions/create-transaction-adjustments)

Paddle counts when discounts are redeemed so you can keep track of how many times a discount has been used. A redemption counts when a transaction is completed, or on the initial application against a subscription. If a discount is present on a transaction created for subscription renewals, midcycle changes, and one-time charges, this doesn't count as a redemption.


### Rules and limits

[Rules and limits](/build/products/offer-discounts-promotions-coupons#background-rules-and-limits)

Discounts in Paddle are flexible and powerful. You can set specific rules and restrictions on how they're applied to a transaction or across multiple transactions to give you the freedom to run promotions and discounts in a way that works for you.


#### Recurring discounts

[Recurring discounts](/build/products/offer-discounts-promotions-coupons#background-rules-and-limits-recurring-discounts)

By default, discounts are one-time. This means they're only applied on the first transaction or checkout that you add them to.


You can create recurring discounts which apply to the current transaction and future transactions where a customer has asubscription. Discounts can recur forever, or for a number of billing periods you specify.

[subscription](/api-reference/subscriptions/overview)

When recurring discounts start applying to transactions depends on if a subscription has afree trial period:

[free trial period](/build/subscriptions/update-trials)
- With a free trialThe discount only applies once the trial period ends. For example, a recurring discount set for 4 billing periods applies to the first paid billing period after the trial and the next 3 renewals.

With a free trial


The discount only applies once the trial period ends. For example, a recurring discount set for 4 billing periods applies to the first paid billing period after the trial and the next 3 renewals.

- Without a free trialThe discount applies immediately. For example, a recurring discount set for 4 billing periods applies to the initial transaction and the next 3 renewals.

Without a free trial


The discount applies immediately. For example, a recurring discount set for 4 billing periods applies to the initial transaction and the next 3 renewals.


In both cases, the discount applies to any subscription changes within those periods.


#### Usage limits

[Usage limits](/build/products/offer-discounts-promotions-coupons#background-rules-and-limits-time-limits)

You can prevent discounts from being valid after certain conditions have been met.

- Time-basedOnce a set date has passed, the discount can no longer be applied to checkouts or transactions.

Time-based


Once a set date has passed, the discount can no longer be applied to checkouts or transactions.

- Amount-basedOnce a discount has been redeemed a certain amount of times, the discount can no longer be applied to checkouts or transactions.

Amount-based


Once a discount has been redeemed a certain amount of times, the discount can no longer be applied to checkouts or transactions.


Amount-based limits are a total limit for the discount, rather than a per-customer limit.

> Expired and fully redeemed discounts can't be redeemed against transactions or checkouts, but can be applied when updating subscriptions.


Expired and fully redeemed discounts can't be redeemed against transactions or checkouts, but can be applied when updating subscriptions.


#### Item restrictions

[Item restrictions](/build/products/offer-discounts-promotions-coupons#background-rules-and-limits-product-and-price-restrictions)

By default, a discount applies to all items on a transaction. You may want a discount to only be applied to specific items at checkout. For example, only annual plans, or specific regional price points.


To achieve this, you can provide a list of:

- ProductsRestricts the discount to apply to all prices for that product.

Products


Restricts the discount to apply to all prices for that product.

- PricesRestricts the discount to only apply to that specific price for a product.

Prices


Restricts the discount to only apply to that specific price for a product.

> The discount applies only to the individual item it's restricted to. You can't limit a discount to apply to the full total only when set items are present.


The discount applies only to the individual item it's restricted to. You can't limit a discount to apply to the full total only when set items are present.


#### Checkout restrictions

[Checkout restrictions](/build/products/offer-discounts-promotions-coupons#background-rules-and-limits-checkout-restrictions)

Customers can apply discounts to checkouts using a discount code. You can assign a discount code, or can have Paddle automatically generate one for you.


However, you may not want customers to be able to apply a discount at checkout. This is useful when you want to control who has access to a discount, like with non-transferable custom discounts only valid for particular customers. To achieve this, you can set a discount to be turned off at checkout.


If discounts aren't enabled for use at checkout, Paddle won't automatically generate a code. The discount can only be applied by passing the discount to the checkout or transaction directly using itsid.

> You can also use theshowAddDiscountsparameter to determine whether Paddle Checkout presents customers with the option to enter a discount. SeePass checkout settings


You can also use theshowAddDiscountsparameter to determine whether Paddle Checkout presents customers with the option to enter a discount. SeePass checkout settings

[Pass checkout settings](/build/checkout/set-up-checkout-default-settings#hide-option-to-add-discount)

#### Currency restrictions

[Currency restrictions](/build/products/offer-discounts-promotions-coupons#background-rules-and-limits-currency-restrictions)

Discounts for a flat amount or per-seat amount are currency-specific. They have a currency and can only be applied to transactions in the same currency.


For example, you can't apply a flat amount type discount (type: flat) with a currency ofUSD(currency_code: USD) to a transaction with the currency ofGBP(currency_code: GBP).

> Non-catalog discountsuse the transaction's currency. A new transaction must have acurrency_codeif the discount being applied is for a flat amount or per-seat amount.


Non-catalog discountsuse the transaction's currency. A new transaction must have acurrency_codeif the discount being applied is for a flat amount or per-seat amount.

[Non-catalog discounts](/build/products/offer-discounts-promotions-coupons#background-non-catalog-discounts)

### Discount groups

[Discount groups](/build/products/offer-discounts-promotions-coupons#background-discount-groups)

You cancreate groupsto assign discounts under. Discounts could be categorized by usage or team, like:

[create groups](/build/products/offer-discounts-promotions-coupons#create-discount-group)
- Marketing and new customer prospects that would be used by the marketing team.
- Retention or loyalty that would be used by customer service or operational teams.
- Seasonal promotions or campaigns like Black Friday or Cyber Monday.

This makes your discounts more easily identifiable and easier to manage as your catalog grows or as discounts become redundant.


### Non-catalog discounts

[Non-catalog discounts](/build/products/offer-discounts-promotions-coupons#background-non-catalog-discounts)

When youcreate a discount, it gets added to your discount catalog. These discounts can be used against any transaction, and at checkout by default. However, you may want to apply a discount to a single transaction which isn't recorded in your catalog.

[create a discount](/build/products/offer-discounts-promotions-coupons#create-discount)

You should use:


#### Catalog discounts

[Catalog discounts](/build/products/offer-discounts-promotions-coupons#catalog-discounts)
- For broadly distributed and repeatable discounts.

For broadly distributed and repeatable discounts.

- When you want to track, report, and attribute performance to the same discount.

When you want to track, report, and attribute performance to the same discount.

- When customers need to be able to add discounts at checkout.

When customers need to be able to add discounts at checkout.


For example, you may run a public seasonal promotion like for Black Friday, or allow all users in a specific segment to use a discount like non-profits or new customers.


#### Non-catalog discounts

[Non-catalog discounts](/build/products/offer-discounts-promotions-coupons#non-catalog-discounts)
- For one-off, highly targeted, or private offers.

For one-off, highly targeted, or private offers.

- When a single customer should have access to a discount.

When a single customer should have access to a discount.

- When you have many custom discounts of varying prices and amounts.

When you have many custom discounts of varying prices and amounts.


For example, you may agree on a discounted price for a specific customer's next transaction to prevent churn, or incentivize them to complete a renewal.


Non-catalog discounts can only be applied directly to a transaction and can't be added by customers usingPaddle Checkout. They won't show in the Paddle dashboard or whenlisting discounts through the API.

[Paddle Checkout](/concepts/sell/self-serve-checkout)
[listing discounts through the API](/api-reference/discounts/list-discounts)
> You can also turn oncheckout recoveryto offer discounts to recover abandoned checkouts. These discounts are non-catalog, non-transferable, and only applicable to the transaction that's recovered.


You can also turn oncheckout recoveryto offer discounts to recover abandoned checkouts. These discounts are non-catalog, non-transferable, and only applicable to the transaction that's recovered.

[checkout recovery](/build/checkout/checkout-recovery)

## Before you begin

[Before you begin](/build/products/offer-discounts-promotions-coupons#prerequisites)

### Set your default payment link

[Set your default payment link](/build/products/offer-discounts-promotions-coupons#prerequisites-default-payment-link)

To open a checkout with a discount, you'll need to first:

- Set your default payment linkunderPaddle > Checkout > Checkout settings > Default payment link.
[Set your default payment link](/build/transactions/default-payment-link)
- Get your default payment link domain approved, if you're working with the live environment.
> We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go live.


We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go live.


## Create a discount

[Create a discount](/build/products/offer-discounts-promotions-coupons#create-discount)

Create discounts to add them to your catalog for usage against checkouts and transactions.


We recommend creating discounts using the Paddle dashboard.

1. Go toPaddle > Catalog > Discounts.

Go toPaddle > Catalog > Discounts.

1. ClickNew discount

ClickNew discount

1. Enter the details for your new discount.

Enter the details for your new discount.

1. ToggleRecurring discountand select from the dropdown if you want the discount to apply across subsequent transactions.

ToggleRecurring discountand select from the dropdown if you want the discount to apply across subsequent transactions.

1. SelectSet an expiration date for the discountif you want to set a date and time the discount is no longer applicable.

SelectSet an expiration date for the discountif you want to set a date and time the discount is no longer applicable.

1. SelectLimit the number of times this discount can be redeemedif you want to set an amount of redemptions before the discount is no longer applicable.

SelectLimit the number of times this discount can be redeemedif you want to set an amount of redemptions before the discount is no longer applicable.

1. ToggleCheckout discount codeto set a discount code that customers can apply at checkout.

ToggleCheckout discount codeto set a discount code that customers can apply at checkout.

1. ToggleLimit discount to selected productsif you want to select products or prices which the discount should only be applicable to.

ToggleLimit discount to selected productsif you want to select products or prices which the discount should only be applicable to.

1. ClickSave

ClickSave


## Apply a discount

[Apply a discount](/build/products/offer-discounts-promotions-coupons#apply-discount)

Customers can apply discounts to a checkout by using a discount code during their transaction. You can also automatically apply a discount to a checkout when you open it in your frontend, or directly to a transaction using the API.


You can apply non-catalog discounts directly to transactions through the API. Non-catalog discounts are intended as custom, one-off discounts which aren't part of your catalog. They can't be applied at checkout by customers, or applied automatically to a checkout when opened.

> enabled_for_checkoutmust betrueagainstthe discount entityto apply it to a checkout. Non-catalog discounts always haveenabled_for_checkoutset tofalse.


enabled_for_checkoutmust betrueagainstthe discount entityto apply it to a checkout. Non-catalog discounts always haveenabled_for_checkoutset tofalse.

[the discount entity](/api-reference/discounts/overview)

You can pass either adiscountCodeordiscountIdwhen opening a Paddle Checkout using Paddle.js.


Pass parameters to thePaddle.Checkout.open()method to prefill those values on a checkout.


```javascript
12345678910111213141516171819201Paddle.Checkout.open({
2  settings: {
3    theme: "light",
4    locale: "en"
5  },
6  discountId: "dsc_01gp0ynsntfpyw2spd2md1wqx1",
7  items: [
8    {
9      priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
10      quantity: 1
11    },
12    {
13      priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
14      quantity: 1
15    },
16    {
17      priceId: 'pri_01gm82v81g69n9hdb0v9sw6j40',
18      quantity: 1
19    }
20  ]

```


To learn more, seePaddle.Checkout.open()

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
> You can update properties on an open checkout using thePaddle.Checkout.updateCheckout()method.


You can update properties on an open checkout using thePaddle.Checkout.updateCheckout()method.

[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)

## See how many times a discount has been redeemed

[See how many times a discount has been redeemed](/build/products/offer-discounts-promotions-coupons#see-redemptions)

You may want to understand how many times a discount has been redeemed to understand its performance, track how many usages it has left, or expose it to customers to promote a sense of urgency against a limit to the discount.


You can see this against a discount entity when you fetch or list discounts astimes_used. If a discount has a limit, you can compare this to the value ofusage_limitto calculate and show how many redemptions are left.


Send aGETrequest to the/discount/{discount_id}endpoint.


Paddle ID of the discount entity to work with.


#### Response

[Response](/build/products/offer-discounts-promotions-coupons#response-get-see-discount-redemptions)

This example is a discount entity with a usage limit for how many times this discount can be redeemed asusage_limit. It shows how many times the discount has been redeemed astimes_used.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "dsc_01jxw1svzg816ptbzkzf7w12rw",
4    "status": "active",
5    "description": "25% off (All)",
6    "enabled_for_checkout": true,
7    "code": "138ETPB5NN",
8    "type": "percentage",
9    "amount": "25",
10    "currency_code": null,
11    "recur": false,
12    "maximum_recurring_intervals": null,
13    "usage_limit": 100,
14    "times_used": 79,
15    "restrict_to": null,
16    "expires_at": null,
17    "mode": "standard",
18    "custom_data": null,
19    "import_meta": null,
20    "discount_group_id": "dsg_01jxyv6jh22m3bav2e3srk1a2t",

```


## Create a discount group

[Create a discount group](/build/products/offer-discounts-promotions-coupons#create-discount-group)

Discounts can be grouped together to make them easier to manage. For example, you might create a group for your Black Friday discounts, and then add all your Black Friday discounts to the group.


You can group your discounts in two steps:

1. Build a requestBuild a request that includes the name of the discount group.

Build a request

[Build a request](/build/products/offer-discounts-promotions-coupons#build-request-create-discount-group)

Build a request that includes the name of the discount group.

1. Create the groupSend the request to create the discount group. Paddle creates it and returns theidof the discount group.

Create the group

[Create the group](/build/products/offer-discounts-promotions-coupons#post-create-discount-group)

Send the request to create the discount group. Paddle creates it and returns theidof the discount group.


### Build request

[Build request](/build/products/offer-discounts-promotions-coupons#build-request-create-discount-group)

Build a request that includes the name of the discount group.


Make it descriptive, short, and memorable to help you identify the purpose of the discount group. This isn't shown to customers.


Name of this discount group.


#### Request

[Request](/build/products/offer-discounts-promotions-coupons#request-create-discount-group)

This example creates a discount group called "Black Friday 2024."


```json
1231{
2  "name": "Black Friday 2024"
3}
```


### Create the group

[Create the group](/build/products/offer-discounts-promotions-coupons#post-create-discount-group)

Send aPOSTrequest to the/discount-groupsendpoint with the request you built.


#### Response

[Response](/build/products/offer-discounts-promotions-coupons#response-create-discount-group)

If successful, Paddle responds with a copy of the new discount group entity. You should take theidof the discount group if you want toadd a discount to it.

[add a discount to it](/build/products/offer-discounts-promotions-coupons#add-discount-to-group)

```json
123456789101112131{
2  "data": {
3    "id": "dsg_01js2gqehzccfkywgx1jk2mtsp",
4    "status": "active",
5    "name": "Black Friday 2024",
6    "import_meta": null,
7    "created_at": "2024-11-28T14:36:14.695Z",
8    "updated_at": "2024-11-28T14:36:14.695Z"
9  },
10  "meta": {
11    "request_id": "1681f87f-9c36-4557-a1da-bbb622afa0cc"
12  }
13}
```


## Add a discount to a discount group

[Add a discount to a discount group](/build/products/offer-discounts-promotions-coupons#add-discount-to-group)

You can add aneworexistingdiscount to a discount group. This example covers updating an existing discount to add it to a discount group. You can do so in two steps:

[new](/api-reference/discounts/create-discount)
[existing](/api-reference/discounts/update-discount)
1. Build requestBuild a request with the discount group you want to add the discount to.

Build request

[Build request](/build/products/offer-discounts-promotions-coupons#build-request-add-discount-to-group)

Build a request with the discount group you want to add the discount to.

1. Add the discount to the groupSend the request to update the discount with the new discount group.

Add the discount to the group

[Add the discount to the group](/build/products/offer-discounts-promotions-coupons#post-add-discount-to-group)

Send the request to update the discount with the new discount group.


### Build request

[Build request](/build/products/offer-discounts-promotions-coupons#build-request-add-discount-to-group)

Provide adiscount_group_idfield when creating or updating a discount.


The value of this field is theidof the discount group you want to add the discount to.

> If you don't know theidfor a discount group, you canlist your discount groupsto find it.


If you don't know theidfor a discount group, you canlist your discount groupsto find it.

[list your discount groups](/api-reference/discount-groups/list-discount-groups)

Paddle ID for the discount group related to this discount, prefixed withdsg_.


#### Request

[Request](/build/products/offer-discounts-promotions-coupons#request-update-add-discount-to-group)

This example updates a discount called "All orders (10% off)" to add it to the "Black Friday 2024" discount group.


```json
1231{
2  "discount_group_id": "dsg_01js2gqehzccfkywgx1jk2mtsp"
3}
```


### Add the discount to the group

[Add the discount to the group](/build/products/offer-discounts-promotions-coupons#post-add-discount-to-group)

Send aPATCHrequest to the/discounts/{discount_id}endpoint with the request you built.


#### Response

[Response](/build/products/offer-discounts-promotions-coupons#response-update-add-discount-to-group)

If successful, Paddle responds with a copy of the created or updated discount entity, containing thediscount_group_idfield.


```json
1213141516171819202122232425262728293012    "recur": true,
13    "maximum_recurring_intervals": 3,
14    "usage_limit": null,
15    "restrict_to": [
16      "pro_01gsz4t5hdjse780zja8vvr7jg",
17      "pro_01gsz4s0w61y0pp88528f1wvvb"
18    ],
19    "expires_at": "2024-12-03T00:00:00Z",
20    "times_used": 0,
21    "discount_group_id": "dsg_01js2gqehzccfkywgx1jk2mtsp",
22    "custom_data": null,
23    "import_meta": null,
24    "created_at": "2024-11-28T14:36:14.695Z",
25    "updated_at": "2024-11-28T14:38:12.331Z"
26  },
27  "meta": {
28    "request_id": "dd850364-99f7-4e27-bb1e-0a477bdb320b"
29  }
30}
```


## Common errors

[Common errors](/build/products/offer-discounts-promotions-coupons#related-errors)

These are the most common errors you might encounter when working with discounts. See a full list atDiscount errors.

[Discount errors](/errors/overview#discounts)

| discount_expired | You are applying a discount which has passed its expiration date. Apply a different discount or update the expiration date for the discount. |
| discount_usage_limit_exceeded | You are applying a discount which has exceeded the maximum usage limit. Apply a different discount or increase the usage limit for the discount. |
| discount_code_conflict | There's already a discount with the samecode. Use a different code or set it asnullto have Paddle generate a unique code when creating or updating a discount. |
| transaction_requires_currency_code_for_custom_discount | The transaction requires acurrency_codewhen aflatorflat_per_seatnon-catalog discount is added to the transaction. Change the discount type topercentageor add acurrency_codeto the transaction. |

[discount_expired](/errors/discounts/discount_expired)
[discount_usage_limit_exceeded](/errors/discounts/discount_usage_limit_exceeded)
[discount_code_conflict](/errors/discounts/discount_code_conflict)
`null`
[transaction_requires_currency_code_for_custom_discount](/errors/transactions/transaction_requires_currency_code_for_custom_discount)
`flat`
`flat_per_seat`
`percentage`
`currency_code`

## Events

[Events](/build/products/offer-discounts-promotions-coupons#related-notifications)

| discount.created | Occurs when a discount is created. |
| discount.updated | Occurs when a discount is updated and/or associated with a discount group. |
| discount_group.created | Occurs when a discount group is created. |
| discount_group.updated | Occurs when a discount group is updated. |
| transaction.created | Occurs when a transaction is created initially with a discount. |
| transaction.updated | Occurs when a discount is applied to an existing transaction. |

[discount.created](/webhooks/discounts/discount-created)
[discount.updated](/webhooks/discounts/discount-updated)
[discount_group.created](/webhooks/discount-groups/discount-group-created)
[discount_group.updated](/webhooks/discount-groups/discount-group-updated)
[transaction.created](/webhooks/transactions/transaction-created)
[transaction.updated](/webhooks/transactions/transaction-created)

## Related pages

[Related pages](/build/products/offer-discounts-promotions-coupons#related-pages)
[Read more](/api-reference/discounts/overview)
[Read more](/api-reference/discount-groups/overview)
[Read more](/concepts/sell/self-serve-checkout)
- Create and manage discounts
[Create and manage discounts](#create-and-manage-discounts)
- How it works
[How it works](#background)
- Redemptions
[Redemptions](#background-redeeming-discounts)
- Rules and limits
[Rules and limits](#background-rules-and-limits)
- Discount groups
[Discount groups](#background-discount-groups)
- Non-catalog discounts
[Non-catalog discounts](#background-non-catalog-discounts)
- Before you begin
[Before you begin](#prerequisites)
- Set your default payment link
[Set your default payment link](#prerequisites-default-payment-link)
- Create a discount
[Create a discount](#create-discount)
- Apply a discount
[Apply a discount](#apply-discount)
- See how many times a discount has been redeemed
[See how many times a discount has been redeemed](#see-redemptions)
- Create a discount group
[Create a discount group](#create-discount-group)
- Build request
[Build request](#build-request-create-discount-group)
- Create the group
[Create the group](#post-create-discount-group)
- Add a discount to a discount group
[Add a discount to a discount group](#add-discount-to-group)
- Build request
[Build request](#build-request-add-discount-to-group)
- Add the discount to the group
[Add the discount to the group](#post-add-discount-to-group)
- Common errors
[Common errors](#related-errors)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:01*
