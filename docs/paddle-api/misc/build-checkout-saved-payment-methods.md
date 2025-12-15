# Present saved payment methods

**Source:** https://developer.paddle.com/build/checkout/saved-payment-methods

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

# Present saved payment methods

[Present saved payment methods](/build/checkout/saved-payment-methods#present-saved-payment-methods)

Let customers securely save payment methods when making a purchase and present saved payment methods to customers when they return. You can manage saved payment methods using the API.


Paddle lets customers save their payment methods when purchasing one-time items and subscriptions usingPaddle Checkout.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

Once saved, you can securely present returning customers with their saved payment methods in the future. This creates a friction-free checkout experience by removing the need to manually enter payment details each time.

> This guide walks through presenting customers with their saved payment methods when they're making a new purchase. To update payment details for an existing subscription, seeUpdate payment details


This guide walks through presenting customers with their saved payment methods when they're making a new purchase. To update payment details for an existing subscription, seeUpdate payment details

[Update payment details](/build/subscriptions/update-payment-details)

## How it works

[How it works](/build/checkout/saved-payment-methods#background)

Customers can purchase one-time items and recurring subscriptions usingPaddle Checkoutand choose to save their payment method when purchasing.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

Once saved, you can securely present customers with their saved payment methods when making purchases in the future by passing a customer authentication token toPaddle.js.

[Paddle.js](/paddlejs/overview)

### Customer journey

[Customer journey](/build/checkout/saved-payment-methods#background-journey)
1. Initial purchaseWhen purchasing one-time items and subscriptions, customers may check a box to save their payment method when completing payment.

#### Initial purchase

[Initial purchase](/build/checkout/saved-payment-methods#journey-details-initial-purchase)

When purchasing one-time items and subscriptions, customers may check a box to save their payment method when completing payment.

1. Repeat purchaseWhen customers come back in the future, you can securely present them with their saved payment methods to make checkout quick and easy.You can only present saved payment methods when using one-page checkout.

#### Repeat purchase

[Repeat purchase](/build/checkout/saved-payment-methods#journey-details-initial-purchase)

When customers come back in the future, you can securely present them with their saved payment methods to make checkout quick and easy.

> You can only present saved payment methods when using one-page checkout.


You can only present saved payment methods when using one-page checkout.

1. Manage saved payment methodsCustomers can view and delete their saved payment methods usingthe customer portal. Paddle automatically includes a unique link in transaction receipt emails.

#### Manage saved payment methods

[Manage saved payment methods](/build/checkout/saved-payment-methods#journey-details-customer-portal)

Customers can view and delete their saved payment methods usingthe customer portal. Paddle automatically includes a unique link in transaction receipt emails.

[the customer portal](/concepts/customer-portal)

### Authentication

[Authentication](/build/checkout/saved-payment-methods#background-security)

You can choose to present all compatible payment methods, or present a single payment method at checkout — useful for building workflows that let customers set a preferred payment method for particular purchases.


To present customers with their saved payment methods, you mustgenerate a customer authentication tokenand pass it to Paddle.js when opening a checkout.

[generate a customer authentication token](/api-reference/customers/generate-customer-authentication-token)

Customer authentication tokens are important for security. They let you authenticate a customer, so Paddle.js can present their payment methods to them. They're unique and impossible to guess, restricted to a particular customer, and only valid for 30 minutes. They can only be generated with the Paddle API using a validAPI key.

[API key](/api-reference/about/api-keys)
> To avoid exposing your API key and other sensitive data, don't make requests to the Paddle API directly from your frontend. Build functionality into your backend to handle requests and serve just the information you need to your frontend.Entities in the API have anAccess-Control-Allow-Originheader to block access from browsers.


To avoid exposing your API key and other sensitive data, don't make requests to the Paddle API directly from your frontend. Build functionality into your backend to handle requests and serve just the information you need to your frontend.


Entities in the API have anAccess-Control-Allow-Originheader to block access from browsers.


### Payment method support

[Payment method support](/build/checkout/saved-payment-methods#background-presentable-payment-methods)

Paddle creates asaved payment method entityfor supported payment methods when customers opt to save them for future purchases.

[saved payment method entity](/api-reference/payment-methods/overview)

Checkthe payment methods guidesto learn which payment methods support being presented when saved.

[the payment methods guides](/concepts/payment-methods/overview)

Keep in mind that some saved payment methods may not be compatible with a checkout when presented. For example,PayPalisn't supported for all currencies and regions supported by Paddle. In this case, Paddle Checkout falls back to presenting customers withall compatible payment options.

[PayPal](/concepts/payment-methods/paypal)
[all compatible payment options](/concepts/payment-methods/overview)

### Allowed payment options

[Allowed payment options](/build/checkout/saved-payment-methods#background-payment-options)

You can pass an array of payment methods to Paddle.js to present only those payment options at checkout. For example, you can open checkouts that only presentPayPalas a payment option.

[PayPal](/concepts/payment-methods/paypal)

Saved payment methods for a customer are considered their own payment option, with their ownsaved_payment_methodsvalue. This means that if a customer has a saved payment method for PayPal, it's not presented if you open a checkout that's set to present only PayPal as a payment option.


### Subscriptions

[Subscriptions](/build/checkout/saved-payment-methods#background-subscriptions)

When a customer purchases a subscription, Paddle stores their payment method against that subscription to bill for renewals,upgrades and downgrades, and other charges related to that subscription.

[upgrades and downgrades](/build/subscriptions/replace-products-prices-upgrade-downgrade)

However, customers must explicitly opt in to save their payment method for future purchases. Without this opt-in, the payment method won't be saved as asaved payment method entityfor you to present at checkout.

[saved payment method entity](/api-reference/payment-methods/overview)

This means a customer could have an active subscription with a stored payment method, but that same payment method won't appear as an option when they make new purchases unless they previously opted in to save it.


Payment methods stored against subscriptions always appear in thecustomer portalregardless of whether the customer opted to save them for future purchases, letting customers manage their payment methods used for recurring billing.

[customer portal](/concepts/customer-portal)

## Before you begin

[Before you begin](/build/checkout/saved-payment-methods#prerequisites)
> To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout


To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout

[Build an overlay checkout](/build/checkout/build-overlay-checkout)
[build an inline checkout](/build/checkout/build-branded-inline-checkout)

### Create products and prices

[Create products and prices](/build/checkout/saved-payment-methods#prerequisites-catalog)

Paddle Checkout works with products and prices to say what customers are purchasing, so you'll need tocreate a product and at least one related priceto pass to your checkout.

[create a product and at least one related price](/build/checkout/build-branded-inline-checkout)

### Set your default payment link

[Set your default payment link](/build/checkout/saved-payment-methods#prerequisites-default-payment-link)

You'll also need to:

- Set your default payment linkunderPaddle > Checkout > Checkout settings > Default payment link.
[Set your default payment link](/build/transactions/default-payment-link)
- Get your default payment link domain approved, if you're working with the live environment.
> We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go-live.


We recommend starting the domain approval early in your integration process, so your domains are approved for when you're ready to go-live.


### Use one-page checkout

[Use one-page checkout](/build/checkout/saved-payment-methods#prerequisites-one-page-checkout)

You can only present saved payment methods when using one-page checkout. Multi-step checkouts don't support presenting saved payment methods.


Passvariantwith the valueone-pageasa checkout settingto use one-page checkout.

[a checkout setting](/build/checkout/set-up-checkout-default-settings)

## Let customers save payment methods

[Let customers save payment methods](/build/checkout/saved-payment-methods#enable-saved-payment-methods)

To give customers the option to save their payment method when purchasing, turn the option on in the Paddle dashboard.


This option is off by default.

1. Go toPaddle > Checkout > Checkout settings.

Go toPaddle > Checkout > Checkout settings.

1. On the General tab, check theAllow buyers to opt in to save their payment methods for future purchasesbox.

On the General tab, check theAllow buyers to opt in to save their payment methods for future purchasesbox.

1. ClickSaveto apply.

ClickSaveto apply.


## Present all saved payment methods at checkout

[Present all saved payment methods at checkout](/build/checkout/saved-payment-methods#present-payment-methods)

Present all compatible saved payment methods for a customer at checkout in three steps:

1. Generate a customer authentication tokenUse the Paddle API to generate an authentication token for a customer.

Generate a customer authentication token

[Generate a customer authentication token](/build/checkout/saved-payment-methods#present-payment-methods-generate)

Use the Paddle API to generate an authentication token for a customer.

1. Pass the customer authentication token to Paddle.jsPasscustomerAuthTokento Paddle.js when opening a checkout, along with your items or a transaction.

Pass the customer authentication token to Paddle.js

[Pass the customer authentication token to Paddle.js](/build/checkout/saved-payment-methods#present-payment-methods-paddle-js)

PasscustomerAuthTokento Paddle.js when opening a checkout, along with your items or a transaction.

1. Present saved payment methods alongside restricted payment options— optionalOptionally passsaved_payment_methodsas a value in theallowedPaymentMethodslist to present saved payment methods when restricting a checkout to particular payment methods.

Present saved payment methods alongside restricted payment options— optional

[Present saved payment methods alongside restricted payment options](/build/checkout/saved-payment-methods#present-payment-methods-restricted)

Optionally passsaved_payment_methodsas a value in theallowedPaymentMethodslist to present saved payment methods when restricting a checkout to particular payment methods.


### Generate a customer authentication token

[Generate a customer authentication token](/build/checkout/saved-payment-methods#present-payment-methods-generate)

Get the Paddle IDfor the customerthat you want to present payment methods for, then send aPOSTrequest to the/customers/{customer_id}/auth-tokenendpoint to generate an authentication token.

[for the customer](/api-reference/customers/overview)

Paddle ID of the customer to generate an authentication token for.


#### Response

[Response](/build/checkout/saved-payment-methods#present-payment-methods-generate-response)

If successful, Paddle returns acustomer_auth_token, along with anexpiry_dateto let you know how long it's valid for.


For security, authentication tokens aren't stored and can't be retrieved later. They're valid for 30 minutes.


```json
1234567891{
2  "data": {
3    "customer_auth_token": "pca_01hwyzq8hmdwed5p4jc4hnv6bh_01hwwggymjn0yhhb2gr4p91276_6xaav4lydudt6bgmuefeaf2xnu3umegx",
4    "expires_at": "2024-05-03T10:34:12.34Z"
5  },
6  "meta": {
7    "request_id": "fa176777-4bca-49ec-aa1e-f53885333cb7"
8  }
9}
```


### Pass the customer authentication token to Paddle.js

[Pass the customer authentication token to Paddle.js](/build/checkout/saved-payment-methods#present-payment-methods-paddle-js)

Take thecustomer_auth_tokenfrom the last step and pass it toPaddle.Checkout.open()ascustomerAuthToken.You should passitemsoratransactionIdwhen opening a checkoutto tell Paddle what a checkout is for, as normal.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[You should passitems](/build/checkout/pass-update-checkout-items)
[atransactionIdwhen opening a checkout](/build/transactions/pass-transaction-checkout)

When passing atransactionId, the customer entity against the transaction must match the customer that thecustomerAuthTokenis for.


This example opens an inline checkout for a one-time item.customerAuthTokenis passed toPaddle.Checkout.open(), so the customer is presented with any payment methods they previously saved.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

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
10  customerAuthToken: "pca_01hwz42rfyaxw721bgkppp66gx_01h282ye3v2d9cmcm8dzpawrd0_otkqbvati3ryh2f6o7zdr6owjsdhkgmm",
11  settings: {
12    displayMode: "inline",
13    frameTarget: "checkout-container",
14    frameInitialHeight: "450",
15    frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
16  }
17});
```

> allowLogoutis ignored if passed because you've authenticated the customer using thecustomerAuthTokenparameter.


allowLogoutis ignored if passed because you've authenticated the customer using thecustomerAuthTokenparameter.


### Present saved payment methods alongside restricted payment optionsOptional

[Present saved payment methods alongside restricted payment optionsOptional](/build/checkout/saved-payment-methods#present-payment-methods-restricted)

You can pass an array of payment method types as a value for theallowedPaymentMethodsparameter forcheckout settingsto determine whichpayment optionsare presented to customers.

[checkout settings](/build/checkout/set-up-checkout-default-settings)
[payment options](/concepts/payment-methods/overview)

Saved payment methods for a customer are considered a discrete payment option. This means that if a customer has a saved payment method forPayPal, it's not presented if you open a checkout that's set to present only PayPal as a payment option.

[PayPal](/concepts/payment-methods/paypal)

To present a customer with all their saved payment methods when restricting a checkout to certain payment options, includesaved_payment_methodsin yourallowedPaymentMethodsarray.


This example shows opening a checkout that presents a customer the option to pay with PayPal or a saved payment method.


```javascript
1234567891011121314151617181var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  }
6];
7
8Paddle.Checkout.open({
9  customerAuthToken: "pca_01hwz42rfyaxw721bgkppp66gx_01h282ye3v2d9cmcm8dzpawrd0_otkqbvati3ryh2f6o7zdr6owjsdhkgmm",
10  settings: {
11    displayMode: "inline",
12    frameTarget: "checkout-container",
13    frameInitialHeight: "450",
14    frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
15    allowedPaymentMethods: ["saved_payment_methods", "paypal"],
16    items: itemsList
17  }
18});
```


## Preselect a specific saved payment method

[Preselect a specific saved payment method](/build/checkout/saved-payment-methods#preselect-payment-method)

Paddle createsa saved payment method entityfor a customer when they choose to save a payment method. You can pass a saved payment method entity ID to Paddle.js to open a checkout for that payment method. Instead of seeing all their compatible saved payment methods, the customer is only presented with the saved payment method you passed.

[a saved payment method entity](/api-reference/payment-methods/overview)

You can use this to build custom checkout workflows that let customers pick a payment method before launching Paddle Checkout, or to let customers set a preferred payment method for specific purchases.


Open a checkout for a saved payment method in three steps:

1. Get a saved payment method IDUse the Paddle API to get a saved payment method ID for a customer.

Get a saved payment method ID

[Get a saved payment method ID](/build/checkout/saved-payment-methods#preselect-payment-method-get-id)

Use the Paddle API to get a saved payment method ID for a customer.

1. Generate a customer authentication tokenUse the Paddle API to generate an authentication token for a customer.

Generate a customer authentication token

[Generate a customer authentication token](/build/checkout/saved-payment-methods#preselect-payment-method-generate)

Use the Paddle API to generate an authentication token for a customer.

1. Pass the saved payment method ID and customer authentication token to Paddle.jsPasssavedPaymentMethodIdandcustomerAuthTokento Paddle.js when opening a checkout, along with your items or a transaction.

Pass the saved payment method ID and customer authentication token to Paddle.js

[Pass the saved payment method ID and customer authentication token to Paddle.js](/build/checkout/saved-payment-methods#preselect-payment-method-paddle-js)

PasssavedPaymentMethodIdandcustomerAuthTokento Paddle.js when opening a checkout, along with your items or a transaction.


### Get a saved payment method ID

[Get a saved payment method ID](/build/checkout/saved-payment-methods#preselect-payment-method-get-id)

Get the Paddle IDfor the customerthat you want to get a payment method for, then send aGETrequest to the/customers/{customer_id}/payment-methodsendpoint to list payment methods for that customer.

[for the customer](/api-reference/customers/overview)

You might present this list to a customer on a page in their account settings screen to let them select a preferred payment method.


Paddle ID of the customer to list payment methods for.


#### Response

[Response](/build/checkout/saved-payment-methods#preselect-payment-method-get-id-response)

If successful, Paddle returns a paginated list of saved payment method entities for a customer.


Extract theidfor the saved payment method you want to present at checkout and save it for later — we'll pass this to Paddle.js in the next step.


You might like to save this in your database against the record for a customer account.


```json
12345678910111213141516171819201{
2  "data": [
3    {
4      "customer_id": "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
5      "address_id": "add_01j2jfab8zcjy524w6e4s1knjy",
6      "id": "paymtd_01j2jff1m3es31sdkejpaym164",
7      "type": "card",
8      "card": {
9        "cardholder_name": "Sam Miller",
10        "type": "visa",
11        "last4": "4242",
12        "expiry_month": 5,
13        "expiry_year": 2025
14      },
15      "paypal": null,
16      "origin": "saved_during_purchase",
17      "saved_at": "2024-07-12T03:23:26Z",
18      "updated_at": "2024-10-29T14:12:28.018784Z"
19    }
20  ],

```


### Generate a customer authentication token

[Generate a customer authentication token](/build/checkout/saved-payment-methods#preselect-payment-method-generate)

Send aPOSTrequest to the/customers/{customer_id}/auth-tokenendpoint to generate an authentication token for a customer.


Paddle ID of the customer to generate an authentication token for.


#### Response

[Response](/build/checkout/saved-payment-methods#present-payment-methods-generate-response)

If successful, Paddle returns acustomer_auth_token, along with anexpiry_dateto let you know how long it's valid for.


Extract thecustomer_auth_tokenfor the saved payment method you want to present at checkout and save it for later — we'll pass this to Paddle.js in the next step.


For security, authentication tokens aren't stored and can't be retrieved later. They're valid for 30 minutes.


```json
1234567891{
2  "data": {
3    "customer_auth_token": "pca_01hwyzq8hmdwed5p4jc4hnv6bh_01hwwggymjn0yhhb2gr4p91276_6xaav4lydudt6bgmuefeaf2xnu3umegx",
4    "expires_at": "2024-05-03T10:34:12.34Z"
5  },
6  "meta": {
7    "request_id": "fa176777-4bca-49ec-aa1e-f53885333cb7"
8  }
9}
```


### Pass the saved payment method ID and customer authentication token to Paddle.js

[Pass the saved payment method ID and customer authentication token to Paddle.js](/build/checkout/saved-payment-methods#preselect-payment-method-paddle-js)

Take theidfor the saved payment method and thecustomer_auth_tokenfrom the last steps and pass them toPaddle.Checkout.open()assavedPaymentMethodIdandcustomerAuthToken.You should passitemsoratransactionIdwhen opening a checkoutto tell Paddle what a checkout is for, as normal.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[You should passitems](/build/checkout/pass-update-checkout-items)
[atransactionIdwhen opening a checkout](/build/transactions/pass-transaction-checkout)

When passing atransactionId, the customer entity against the transaction must match the customer that thecustomerAuthTokenis for. The address entity against the transaction is updated so that it matches the address for the saved payment method passed.


This example opens an inline checkout for a one-time item.customerAuthTokenandsavedPaymentMethodIdare passed toPaddle.Checkout.open(), so the customer is presented with the option to pay with the passed saved payment method when they open checkout.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

```javascript
1234567891011121314151617181var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  }
6];
7
8Paddle.Checkout.open({
9  customerAuthToken: "pca_01hwz42rfyaxw721bgkppp66gx_01h282ye3v2d9cmcm8dzpawrd0_otkqbvati3ryh2f6o7zdr6owjsdhkgmm",
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

> If a passed saved payment method isn't compatible with a checkout, Paddle Checkout presents the customer with other ways to pay. For example, PayPal isn't supported for all currencies and regions supported by Paddle. In this case, customers are presented with options that are compatible.


If a passed saved payment method isn't compatible with a checkout, Paddle Checkout presents the customer with other ways to pay. For example, PayPal isn't supported for all currencies and regions supported by Paddle. In this case, customers are presented with options that are compatible.


## Work with payment methods

[Work with payment methods](/build/checkout/saved-payment-methods#view-update-payment-methods)

Let customers manage payment methods by:

- Linking to the customer portalCustomers can see and delete their subscription payment methods usingthe customer portal, meaning you don't need to build any of your own logic. This includes all payment methods associated with their subscriptions, whether they opted to save them for future purchases or not.

Linking to the customer portal


Customers can see and delete their subscription payment methods usingthe customer portal, meaning you don't need to build any of your own logic. This includes all payment methods associated with their subscriptions, whether they opted to save them for future purchases or not.

[the customer portal](/concepts/customer-portal)
- Building an integration using the Paddle APIYou can usethe Paddle APIto build billing screens to let customers see and delete their saved payment methods. This only includes payment methods that customers opted to save for future purchases.

Building an integration using the Paddle API


You can usethe Paddle APIto build billing screens to let customers see and delete their saved payment methods. This only includes payment methods that customers opted to save for future purchases.

[the Paddle API](/api-reference/payment-methods/overview)

## Events

[Events](/build/checkout/saved-payment-methods#related-notifications)

| payment_method.saved | Occurs when a customer opts to save a payment method for future purchases. |
| payment_method.deleted | Occurs when a saved payment method for a customer is deleted. |

[payment_method.saved](/webhooks/payment-methods/payment-method-saved)
[payment_method.deleted](/webhooks/payment-methods/payment-method-deleted)

## Related pages

[Related pages](/build/checkout/saved-payment-methods#related-pages)
[Read more](/concepts/payment-methods/overview)
[Read more](/build/subscriptions/update-payment-details)
[Read more](/paddlejs/methods/paddle-checkout-open)
- Present saved payment methods
[Present saved payment methods](#present-saved-payment-methods)
- How it works
[How it works](#background)
- Customer journey
[Customer journey](#background-journey)
- Authentication
[Authentication](#background-security)
- Payment method support
[Payment method support](#background-presentable-payment-methods)
- Allowed payment options
[Allowed payment options](#background-payment-options)
- Subscriptions
[Subscriptions](#background-subscriptions)
- Before you begin
[Before you begin](#prerequisites)
- Create products and prices
[Create products and prices](#prerequisites-catalog)
- Set your default payment link
[Set your default payment link](#prerequisites-default-payment-link)
- Use one-page checkout
[Use one-page checkout](#prerequisites-one-page-checkout)
- Let customers save payment methods
[Let customers save payment methods](#enable-saved-payment-methods)
- Present all saved payment methods at checkout
[Present all saved payment methods at checkout](#present-payment-methods)
- Generate a customer authentication token
[Generate a customer authentication token](#present-payment-methods-generate)
- Pass the customer authentication token to Paddle.js
[Pass the customer authentication token to Paddle.js](#present-payment-methods-paddle-js)
- Present saved payment methods alongside restricted payment options
[Present saved payment methods alongside restricted payment options](#present-payment-methods-restricted)
- Preselect a specific saved payment method
[Preselect a specific saved payment method](#preselect-payment-method)
- Get a saved payment method ID
[Get a saved payment method ID](#preselect-payment-method-get-id)
- Generate a customer authentication token
[Generate a customer authentication token](#preselect-payment-method-generate)
- Pass the saved payment method ID and customer authentication token to Paddle.js
[Pass the saved payment method ID and customer authentication token to Paddle.js](#preselect-payment-method-paddle-js)
- Work with payment methods
[Work with payment methods](#view-update-payment-methods)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:05*
