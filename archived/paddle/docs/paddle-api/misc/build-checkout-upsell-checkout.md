# Present customers with an upsell checkout

**Source:** https://developer.paddle.com/build/checkout/upsell-checkout

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

Early access


# Present customers with an upsell checkout

[Present customers with an upsell checkout](/build/checkout/upsell-checkout#present-customers-with-an-upsell-checkout)

Encourage customers to upgrade or purchase additional items after their initial purchase by opening a checkout designed for upsells, removing friction and boosting conversion. Only available for inline checkouts.


Anupsell checkoutis a specialized purchase flow designed to capture additional sales immediately after a customer completes an initial purchase. It's optimized to minimize friction and maximize conversion rates by reusing details and consent acknowledgments from the preceding transaction.

[upsell checkout](/concepts/sell/upsell-checkout)
> Access to upsell checkouts is limited to users who are part of our early access program. If you're interested in joining the program, review this guide and email us atsellers@paddle.comto apply. We'll reach out when space is available if you meet the program requirements.


Access to upsell checkouts is limited to users who are part of our early access program. If you're interested in joining the program, review this guide and email us atsellers@paddle.comto apply. We'll reach out when space is available if you meet the program requirements.

[sellers@paddle.com](mailto:sellers@paddle.com)

## How it works

[How it works](/build/checkout/upsell-checkout#background)

You can use upsell checkouts after a customer has completed an initial transaction usingPaddle Checkout. You pass the transaction ID of the initial transaction to the upsell checkout.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

An upsell checkout uses the customer, business, and address data from the previous transaction, so customers never have to reenter these details and you don't have tomanually prefill those details.

[manually prefill those details](/build/checkout/prefill-checkout-properties)
> You must open aninline, one-page checkoutfor the upsell flow to show. If you try to open anoverlay checkoutor multi-step variant, it defaults to a standard inline checkout.


You must open aninline, one-page checkoutfor the upsell flow to show. If you try to open anoverlay checkoutor multi-step variant, it defaults to a standard inline checkout.

[inline, one-page checkout](/concepts/sell/branded-integrated-inline-checkout)
[overlay checkout](/build/checkout/build-overlay-checkout)

### Enable a one-click purchase experience

[Enable a one-click purchase experience](/build/checkout/upsell-checkout#background-one-click-purchase)

The checkout flow can be streamlined to render a single button for one-click purchasing. It hides elements that were already presented during the initial transaction, like the Merchant of Record disclosure, and automatically selects the same customer payment method.


This happens when:

- The transaction is within the same sessionThe customer completed the initial transaction within the last 5 minutes.

The transaction is within the same session

[The transaction is within the same session](/build/checkout/upsell-checkout#background-same-session)

The customer completed the initial transaction within the last 5 minutes.

- The payment methods can be reusedThe customer saved their payment method during the initial purchase and they're authenticated, or they selected Apple Pay or Google Pay.

The payment methods can be reused

[The payment methods can be reused](/build/checkout/upsell-checkout#background-payment-method-continuity)

The customer saved their payment method during the initial purchase and they're authenticated, or they selected Apple Pay or Google Pay.


If these don't happen, then the upsell checkout experience presented to customers can vary. Customer data is still reused and theskip buttonis still shown.

[skip button](/build/checkout/upsell-checkout#background-upsell-controls)

#### Same session

[Same session](/build/checkout/upsell-checkout#background-same-session)

You can open checkouts for upsells immediately after a transaction completes, or later - for example, from an email campaign or when customers return to your app.


Paddle determines whether an upsell occurs within the "same session" by checking if the original transaction was completed within the last 5 minutes.


If so, the checkout flow is streamlined to hide elements that were already presented during the initial purchase, like the Merchant of Record disclosure. If not, those elements are shown.


When a checkout is opened for an upsell, the session remains fixed. This means the flow won't change for customers during purchase and upsell transactions still process successfully after the 5 minute window has passed.


#### Reusing payment methods

[Reusing payment methods](/build/checkout/upsell-checkout#background-payment-method-continuity)

When the upsell occurs within thesame sessionand payment methods are reusable, customers can complete their purchase with one click.

[same session](/build/checkout/upsell-checkout#background-same-session)

There's two approaches to enable payment method reuse, depending on the payment method used in the initial transaction:

- Saved payment methodsWhen you turn on the option to let customerssave their payment methods, they can opt to save theircardorPayPalaccount during checkout. The saved payment method is automatically selected for one-click purchasing if the customer is authenticated with acustomer authentication token.

Saved payment methods


When you turn on the option to let customerssave their payment methods, they can opt to save theircardorPayPalaccount during checkout. The saved payment method is automatically selected for one-click purchasing if the customer is authenticated with acustomer authentication token.

[save their payment methods](/build/checkout/saved-payment-methods)
[card](/concepts/payment-methods/credit-debit-card)
[PayPal](/concepts/payment-methods/paypal)
[customer authentication token](/build/checkout/saved-payment-methods#present-payment-methods-generate)
- Wallet payment methodsWhen a customer usesApple PayorGoogle Payin the initial transaction, you canpass that same methodwhen opening the upsell checkout withinallowedPaymentMethods. This restricts the checkout to that specific payment method, enabling one-click purchasing without requiring a customer authentication token.

Wallet payment methods


When a customer usesApple PayorGoogle Payin the initial transaction, you canpass that same methodwhen opening the upsell checkout withinallowedPaymentMethods. This restricts the checkout to that specific payment method, enabling one-click purchasing without requiring a customer authentication token.

[Apple Pay](/concepts/payment-methods/apple-pay)
[Google Pay](/concepts/payment-methods/google-pay)
[pass that same method](/build/checkout/upsell-checkout#open-upsell-checkout-display-payment-methods)
`allowedPaymentMethods`
> For card and PayPal payment methods, customers must opt to save. If consent wasn't given during the initial purchase, customers must reenter their payment details for the upsell.


For card and PayPal payment methods, customers must opt to save. If consent wasn't given during the initial purchase, customers must reenter their payment details for the upsell.


### Customize the upsell flow

[Customize the upsell flow](/build/checkout/upsell-checkout#background-upsell-controls)

You can pass settings to Paddle.js toconfigure the upsell experience.

[configure the upsell experience](/build/checkout/upsell-checkout#open-upsell-checkout-customize-flow)

By default, the checkout shows a "No thanks" button so customers can decline the upsell. If they decline, you musthandle what happensdepending on your purchase flow.

[handle what happens](/build/checkout/upsell-checkout#handle-canceled-upsells)

To hide the skip button, passupsell.settings.showSkipButton: false. Do this when customers can navigate away from the checkout themselves, and you don't want to handle what happens next.

> Paddle Checkout takes no action when the skip button is clicked. Hide the button or listen for thecheckout.upsell.canceledevent to take action yourself.


Paddle Checkout takes no action when the skip button is clicked. Hide the button or listen for thecheckout.upsell.canceledevent to take action yourself.

[checkout.upsell.canceled](/paddlejs/upsell/checkout-upsell-canceled)

### Checkout events

[Checkout events](/build/checkout/upsell-checkout#background-checkout-events)

Checkout eventsinclude anupsellobject when the checkout is opened as an upsell flow.

[Checkout events](/paddlejs/events/overview)

The object contains the original transaction ID and asameSessionboolean. Iftrue, the upsell occurred within the same session as the previous transaction.


Paddle.js emits acheckout.loadedevent when the checkout is opened. You can use this to track whether an upsell flow was shown to a customer by readingevent.data.upsell. IfsameSessionistrue, the streamlined upsell flow was shown.

[checkout.loaded](/paddlejs/general/checkout-loaded)

If the checkout isn't for an upsell, or you attempted to open a checkout for an upsell but an upsell-specific flow wasn't shown to the customer, the value ofupsellisnull. This can happen because:

- The previous transaction isn'tcompleted.
- You attempt to open an overlay or multi-step checkout for an upsell.

## Before you begin

[Before you begin](/build/checkout/upsell-checkout#prerequisites)

### Set up an initial checkout

[Set up an initial checkout](/build/checkout/upsell-checkout#prerequisites-set-up-inline-checkout)

Upsells are intended to follow directly after a previously completed transaction at checkout. To open a new checkout for an upsell, you need to have a previous transaction that'scompleted.


Build aninlineoroverlaycheckout to let customers purchase initially. This allows you tocapture the ID of that transactionand pass it toopen a checkout for the upselllater.

[inline](/build/checkout/build-branded-inline-checkout)
[overlay](/build/checkout/build-overlay-checkout)
[capture the ID of that transaction](/build/checkout/upsell-checkout#open-upsell-checkout-grab-transaction-id)
[open a checkout for the upsell](/build/checkout/upsell-checkout#open-upsell-checkout)
> While the initial checkout can use an overlay checkout, upsells must use inline checkouts. It's recommended to use an inline checkout throughout for ease of implementation.


While the initial checkout can use an overlay checkout, upsells must use inline checkouts. It's recommended to use an inline checkout throughout for ease of implementation.


### Create products and prices to upsell

[Create products and prices to upsell](/build/checkout/upsell-checkout#prerequisites-create-product-price)

You'll need tocreate any new products and at least one related priceto pass as items to upsell at checkout.

[create any new products and at least one related price](/build/products/create-products-prices)

### Turn on saved payment methods

[Turn on saved payment methods](/build/checkout/upsell-checkout#prerequisites-turn-on-saved-payment-methods)

For the best upsell experience where customers can purchase in one-click by reusing their previous payment method, you shouldturn on saved payment methods.

[turn on saved payment methods](/build/checkout/saved-payment-methods)

Without this, customers can only use wallet payment methods likeApple PayorGoogle Payfor one-click purchasing, or would need to enter their payment details again for the upsell transaction.

[Apple Pay](/concepts/payment-methods/apple-pay)
[Google Pay](/concepts/payment-methods/google-pay)

## Open a checkout for an upsell

[Open a checkout for an upsell](/build/checkout/upsell-checkout#open-upsell-checkout)

Open a checkout for an upsell in four steps:

1. Grab the previous transaction IDHandle checkout completed events for the previous transaction.

Grab the previous transaction ID

[Grab the previous transaction ID](/build/checkout/upsell-checkout#open-upsell-checkout-grab-transaction-id)

Handle checkout completed events for the previous transaction.

1. Capture the payment method type- optionalCapture the payment method type if the customer used Apple Pay or Google Pay.

Capture the payment method type- optional

[Capture the payment method type](/build/checkout/upsell-checkout#open-upsell-checkout-capture-payment-method)

Capture the payment method type if the customer used Apple Pay or Google Pay.

1. Verify the transaction is completed- optionalConfirm that the transaction iscompletedbefore opening the upsell flow.

Verify the transaction is completed- optional

[Verify the transaction is completed](/build/checkout/upsell-checkout#open-upsell-checkout-verify-transaction-completed)

Confirm that the transaction iscompletedbefore opening the upsell flow.

1. Open the checkout with Paddle.jsPassupsellto Paddle.js with the previous transaction ID, along with the items to upsell and any other settings to customize the flow.

Open the checkout with Paddle.js

[Open the checkout with Paddle.js](/build/checkout/upsell-checkout#open-upsell-checkout-open)

Passupsellto Paddle.js with the previous transaction ID, along with the items to upsell and any other settings to customize the flow.


### Grab the previous transaction ID

[Grab the previous transaction ID](/build/checkout/upsell-checkout#open-upsell-checkout-grab-transaction-id)

Upsell checkouts require a customer to have completed a previous transaction through checkout. You'll need to provide the transaction ID for that previous transaction when opening the new checkout.


Since upsell checkouts are intended to be openedas soon as possibleafter a customer has completed their purchase, we recommend grabbing the transaction ID on the client-side using Paddle.js.

[as soon as possible](/build/checkout/upsell-checkout#background-same-session)

When initializing Paddle.js, you can passeventCallbackas a configuration option to run a function when a specific event occurs. Extract the transaction ID from thecheckout.completedeventwhen a customer completes checkout.

[checkout.completedevent](/paddlejs/general/checkout-completed)

Import Paddle.js events if using TypeScript, then update where you initialize Paddle.js to include aneventCallbackfunction:


```typescript
1234567891011121314151import { initializePaddle } from '@paddle/paddle-js';
2import { CheckoutEventNames, PaddleEventData } from '@paddle/paddle-js';
3
4// Variable to store the transaction ID for the upsell
5let previousTransactionId: string | null = null;
6
7const paddle = await initializePaddle({
8  token: 'CLIENT_SIDE_TOKEN',
9  eventCallback: (event: PaddleEventData) => {
10    if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
11      // Grab the transaction ID from the completed checkout
12      previousTransactionId = event.data.transaction_id;
13    }
14  }
15});
```


### Capture the payment method typeOptional

[Capture the payment method typeOptional](/build/checkout/upsell-checkout#open-upsell-checkout-capture-payment-method)

If the customer might use Apple Pay or Google Pay in the initial transaction, you should capture the payment method type alongside the transaction ID. This lets youpresent the one-click payment experiencewhenopening the upsell checkoutby passing the wallet method toallowedPaymentMethods.

[present the one-click payment experience](/build/checkout/upsell-checkout#background-one-click-purchase)
[opening the upsell checkout](/build/checkout/upsell-checkout#open-upsell-checkout-wallet-payment-methods)

Extract the payment method type from thecheckout.completedevent by readingevent.data.payment.method_details.type. Look for whether it'sapple-payorgoogle-pay.

[checkout.completed](/paddlejs/general/checkout-completed)

Update youreventCallbackfunction to also capture the payment method type:


```typescript
12345678910111213141516171819201import { initializePaddle } from '@paddle/paddle-js';
2import { CheckoutEventNames, PaddleEventData } from '@paddle/paddle-js';
3
4// Variables to store data for the upsell
5let previousTransactionId: string | null = null;
6let paymentMethodType: string | null = null;
7
8const paddle = await initializePaddle({
9  token: 'CLIENT_SIDE_TOKEN',
10  eventCallback: (event: PaddleEventData) => {
11    if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
12      // Grab the transaction ID and payment method type
13      previousTransactionId = event.data.transaction_id;
14      const methodType = event.data.payment?.method_details?.type;
15      if (methodType === 'apple-pay' || methodType === 'google-pay') {
16        paymentMethodType = methodType;
17      }
18    }
19  }
20});
```

> The payment method type in checkout events uses hyphens (apple-pay,google-pay), butallowedPaymentMethodsuses underscores (apple_pay,google_pay). Convert the format if you pass it directly toallowedPaymentMethods.


The payment method type in checkout events uses hyphens (apple-pay,google-pay), butallowedPaymentMethodsuses underscores (apple_pay,google_pay). Convert the format if you pass it directly toallowedPaymentMethods.


### Verify the transaction is completedOptional

[Verify the transaction is completedOptional](/build/checkout/upsell-checkout#open-upsell-checkout-verify-transaction-completed)

When a checkout completes, the related transaction moves topaidwhile completed transaction processing takes place, thencompleted. This typically takes less than a second.


For most use cases, you can open the upsell checkout immediately after receiving thecheckout.completedevent. If the transaction isn't in acompletedstate yet, customers see the standard checkout flow instead.


If you want to ensure the streamlined upsell flow is shown, you have two options:

- Make a single API verification callFetch the transactionthrough the Paddle APIand verify thestatusfield iscompletedbefore opening the upsell checkout.

Make a single API verification call


Fetch the transactionthrough the Paddle APIand verify thestatusfield iscompletedbefore opening the upsell checkout.

[through the Paddle API](/api-reference/transactions/get-transaction)
- Using webhook data (if you store transactions)If you already listen fortransaction.completedortransaction.updatedwebhooks tohandle fulfillment, you can check your stored transaction data to verify completion status.

Using webhook data (if you store transactions)


If you already listen fortransaction.completedortransaction.updatedwebhooks tohandle fulfillment, you can check your stored transaction data to verify completion status.

[handle fulfillment](/build/subscriptions/provision-access-webhooks)
> Don't continuously poll the Paddle API to check transaction status. Make at most one verification call, then proceed with opening the checkout regardless of the result.


Don't continuously poll the Paddle API to check transaction status. Make at most one verification call, then proceed with opening the checkout regardless of the result.


### Open the checkout with Paddle.js

[Open the checkout with Paddle.js](/build/checkout/upsell-checkout#open-upsell-checkout-open)

You use the Paddle.jsPaddle.Checkout.open()method to open a checkout for an upsell. You canbuild an inline checkoutwith all usualcheckout settings.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
[build an inline checkout](/build/checkout/build-branded-inline-checkout)
[checkout settings](/build/checkout/set-up-checkout-default-settings)
> The checkout must be inline and one-page. PassdisplayModewith the valueinline, andvariantwith the valueone-pageasa checkout setting.


The checkout must be inline and one-page. PassdisplayModewith the valueinline, andvariantwith the valueone-pageasa checkout setting.

[a checkout setting](/build/checkout/set-up-checkout-default-settings)

Pass either theitemsyou want to upsell to the checkout, or thetransaction IDof an existing transaction that contains the items you want to upsell. You may also want tocreate and apply a discountto the upsell to incentivize the customer to purchase the additional items.

[items](/build/checkout/pass-update-checkout-items#open-items)
[transaction ID](/build/transactions/pass-transaction-checkout#pass-transaction)
[create and apply a discount](/build/products/offer-discounts-promotions-coupons)

Theupsellobject tells Paddle.js that this is a checkout for an upsell. You must pass this to thePaddle.Checkout.open()method.


#### Provide the previous transaction ID

[Provide the previous transaction ID](/build/checkout/upsell-checkout#open-upsell-checkout-pass-transaction-id)

Take thepreviousTransactionIdvariable you stored from thecheckout.completedevent and pass it asupsell.transactionId.


There's no need topass customer, address, or business detailsbecause they're automatically inherited from the previous transaction. If you do choose to pass acustomer_id, the customer against the previous transaction must match.

[pass customer, address, or business details](/build/checkout/prefill-checkout-properties)

Opens a checkout as an upsell to display a streamlined checkout experience to customers.


Paddle ID for the previously completed transaction that this upsell follows, prefixed withtxn_.

> allowLogoutis ignored if passed and defaults tofalsebecause the upsell is tied to a previous transaction and customer.


allowLogoutis ignored if passed and defaults tofalsebecause the upsell is tied to a previous transaction and customer.

[allowLogout](/build/checkout/set-up-checkout-default-settings#allow-logout)

#### Customize the upsell flow

[Customize the upsell flow](/build/checkout/upsell-checkout#open-upsell-checkout-customize-flow)

By default, the checkout for upsells shows a "No thanks" skip button. Once clicked, the checkout emits acheckout.upsell.canceledevent.

[checkout.upsell.canceled](/paddlejs/upsell/checkout-upsell-canceled)

You can hide this by passingupsell.settings.showSkipButton: false. This prevents the upsell from being canceled and the checkout from being closed.


Opens a checkout as an upsell to display a streamlined checkout experience to customers.


#### Present saved payment methods

[Present saved payment methods](/build/checkout/upsell-checkout#open-upsell-checkout-display-payment-methods)

To render theone-click purchase experienceor show previous saved payment methods when customers use card or PayPal, you must:

[one-click purchase experience](/build/checkout/upsell-checkout#background-one-click-purchase)
- Turn on saved payment methods

Turn on saved payment methods

[Turn on saved payment methods](/build/checkout/saved-payment-methods)
- Authenticate customers with acustomer authentication token.

Authenticate customers with acustomer authentication token.

[customer authentication token](/api-reference/customers/generate-customer-authentication-token)

Generate acustomer authentication tokenusing the Paddle API andpass it to the checkoutascustomerAuthToken.

[customer authentication token](/build/checkout/saved-payment-methods#present-payment-methods-generate)
[pass it to the checkout](/build/checkout/saved-payment-methods#present-payment-methods-paddle-js)

Authentication token for this customer, generated using the generate an authentication token for a customer operation in the Paddle API. Use to authenticate a customer so they can work with saved payment methods at checkout.

> If customers can't complete their purchase in one click, check that thecustomer has payment methods savedand the checkout is in thesame sessionusingupsell.sameSessionincheckout events.


If customers can't complete their purchase in one click, check that thecustomer has payment methods savedand the checkout is in thesame sessionusingupsell.sameSessionincheckout events.

[customer has payment methods saved](/api-reference/payment-methods/list-payment-methods)
[same session](/build/checkout/upsell-checkout#background-same-session)
[checkout events](/paddlejs/events/overview)

#### Present wallet payment methods

[Present wallet payment methods](/build/checkout/upsell-checkout#open-upsell-checkout-wallet-payment-methods)

To render theone-click purchase experiencewhen customers use Apple Pay or Google Pay, you must pass that specific wallet method toallowedPaymentMethods.

[one-click purchase experience](/build/checkout/upsell-checkout#background-one-click-purchase)

If youcaptured the payment method typefrom the initial checkout, convert it from the hyphenated format (apple-pay,google-pay) to the underscore format (apple_pay,google_pay) and pass it as the only value in theallowedPaymentMethodsarray.

[captured the payment method type](/build/checkout/upsell-checkout#open-upsell-checkout-capture-payment-method)

Payment options presented to customers at checkout.


#### Examples

[Examples](/build/checkout/upsell-checkout#open-upsell-checkout-examples)

This example shows opening an upsell checkout when the customer used card or PayPal in the initial transaction. The customer authentication token enables access to their saved payment method for one-click purchasing.


```javascript
12345678910111213141516171819201var upsellItems = [
2  {
3    priceId: 'pri_01h1vjfevh5etwq3rb176h9d9w',
4    quantity: 1
5  }
6];
7
8// previousTransactionId was captured from the initial checkout.completed event
9Paddle.Checkout.open({
10  items: upsellItems,
11  customerAuthToken: 'pca_REDACTED_EXAMPLE_CUSTOMER_AUTH_TOKEN',
12  settings: {
13    displayMode: "inline",
14    frameTarget: "checkout-container",
15    frameInitialHeight: "450",
16    frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
17  },
18  upsell: {
19    transactionId: previousTransactionId,
20    settings: {

```


## Handle skipped and canceled upsells

[Handle skipped and canceled upsells](/build/checkout/upsell-checkout#handle-canceled-upsells)

By default, checkouts for upsellsdisplay a "No thanks" skip button. When a customer clicks the "No thanks" button, Paddle.js emits acheckout.upsell.canceledevent but doesn't perform any action.

[display a "No thanks" skip button](/build/checkout/upsell-checkout#open-upsell-checkout-customize-flow)
[checkout.upsell.canceled](/paddlejs/upsell/checkout-upsell-canceled)

You need to decide what happens next so customers continue their journey.

> If you don't want checkouts to display the skip button, passupsell.settings.showSkipButton: false.


If you don't want checkouts to display the skip button, passupsell.settings.showSkipButton: false.


Common actions include redirecting customers to a different page,closing the checkout, or closing and opening a new checkout with an improved upsell offer.

[closing the checkout](/paddlejs/methods/paddle-checkout-close)

When initializing Paddle.js, you can passeventCallbackas a configuration option to run a function when a specific event occurs. This can be used to handle when thecheckout.upsell.canceledevent is emitted.

[checkout.upsell.canceled](/paddlejs/upsell/checkout-upsell-canceled)

This example redirects customers to a dashboard page when they skip the upsell.


Import Paddle.js events if using TypeScript, then update where you initialize Paddle.js to include aneventCallbackfunction:


```typescript
12345678910111213141import { initializePaddle } from '@paddle/paddle-js';
2import { CheckoutEventNames, PaddleEventData } from '@paddle/paddle-js';
3
4const paddle = await initializePaddle({
5  token: 'CLIENT_SIDE_TOKEN',
6  eventCallback: (event: PaddleEventData) => {
7    if (event.name === CheckoutEventNames.CHECKOUT_UPSELL_CANCELED) {
8
9      setTimeout(() => {
10        window.location.href = `https://app.aeroedit.com/settings?upsellSkipped=true`;
11      }, 3000);
12    }
13  }
14});
```

> If you close the checkout usingPaddle.Checkout.close(), be aware that the checkoutiframeis removed from the DOM. Consider updating your UI alongside this for a more seamless user experience.


If you close the checkout usingPaddle.Checkout.close(), be aware that the checkoutiframeis removed from the DOM. Consider updating your UI alongside this for a more seamless user experience.


## Related pages

[Related pages](/build/checkout/upsell-checkout#related-pages)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/paddlejs/methods/paddle-checkout-open)
[Read more](/paddlejs/events/overview)
- Present customers with an upsell checkout
[Present customers with an upsell checkout](#present-customers-with-an-upsell-checkout)
- How it works
[How it works](#background)
- Enable a one-click purchase experience
[Enable a one-click purchase experience](#background-one-click-purchase)
- Customize the upsell flow
[Customize the upsell flow](#background-upsell-controls)
- Checkout events
[Checkout events](#background-checkout-events)
- Before you begin
[Before you begin](#prerequisites)
- Set up an initial checkout
[Set up an initial checkout](#prerequisites-set-up-inline-checkout)
- Create products and prices to upsell
[Create products and prices to upsell](#prerequisites-create-product-price)
- Turn on saved payment methods
[Turn on saved payment methods](#prerequisites-turn-on-saved-payment-methods)
- Open a checkout for an upsell
[Open a checkout for an upsell](#open-upsell-checkout)
- Grab the previous transaction ID
[Grab the previous transaction ID](#open-upsell-checkout-grab-transaction-id)
- Capture the payment method type
[Capture the payment method type](#open-upsell-checkout-capture-payment-method)
- Verify the transaction is completed
[Verify the transaction is completed](#open-upsell-checkout-verify-transaction-completed)
- Open the checkout with Paddle.js
[Open the checkout with Paddle.js](#open-upsell-checkout-open)
- Handle skipped and canceled upsells
[Handle skipped and canceled upsells](#handle-canceled-upsells)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:15*
