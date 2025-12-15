# Add a hosted checkout to your mobile app

**Source:** https://developer.paddle.com/build/mobile-apps/link-out-mobile-app-hosted-checkout-app

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
- Launch checkout from iOSOverviewAdd a hosted checkoutDeploy checkout to VercelBuild a custom workflow
- Overview
[Overview](/build/mobile-apps/overview)
- Add a hosted checkout
[Add a hosted checkout](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app)
- Deploy checkout to Vercel
[Deploy checkout to Vercel](/build/mobile-apps/nextjs-vercel-mobile-app-starter-kit)
- Build a custom workflow
[Build a custom workflow](/build/mobile-apps/link-out-mobile-app-custom-workflow)
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

# Add a hosted checkout to your mobile app

[Add a hosted checkout to your mobile app](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#add-a-hosted-checkout-to-your-mobile-app)

Get a step-by-step overview of how to add a Paddle-hosted external purchase flow for your iOS app, letting you go direct to customers while remaining compliant.


With recent developments in legislation around the App Store, you can link users in theUnited Statesto an external checkout for purchases in iOS apps.


You can usehosted checkoutsto let users securely make purchases outside your app — no hosting required. Customers tap a button in your app to open a checkout that's fully hosted by Paddle, then they're redirected to your app when they complete their purchase.

[hosted checkouts](/concepts/sell/hosted-checkout-mobile-apps)
> Access to hosted checkouts on live accounts is limited to approved mobile app companies. It's available on allsandbox accountsfor evaluation and testing. To request approval,contact support.


Access to hosted checkouts on live accounts is limited to approved mobile app companies. It's available on allsandbox accountsfor evaluation and testing. To request approval,contact support.

[sandbox accounts](/build/tools/sandbox)
[contact support](mailto:sellers@paddle.com)

## What are we building?

[What are we building?](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#objectives)

In this tutorial, we'll usehosted checkoutsin Paddle to build an external purchase flow for in-app purchases in iOS apps.

[hosted checkouts](/concepts/sell/hosted-checkout-mobile-apps)

We'll walk through handling fulfillment using theRevenueCat x Paddle integrationorwebhooks.

[RevenueCat x Paddle integration](https://www.paddle.com/revenuecat-integration-beta)
[webhooks](/webhooks/overview)

## What's not covered

[What's not covered](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#exclusions)

This tutorial doesn't cover:

- Handling authenticationWe assume you already have a way to identify your users, likeFirebaseorSign in with Apple.

Handling authentication


We assume you already have a way to identify your users, likeFirebaseorSign in with Apple.

[Firebase](https://firebase.google.com/)
[Sign in with Apple](https://developer.apple.com/sign-in-with-apple/)
- Native in-app purchasesWe'll launch Paddle Checkout in Safari then redirect users back to your app. Like the App Store, Paddle Checkout supportsApple Paywith no additional setup, plusother popular payment options.

Native in-app purchases


We'll launch Paddle Checkout in Safari then redirect users back to your app. Like the App Store, Paddle Checkout supportsApple Paywith no additional setup, plusother popular payment options.

[Apple Pay](/concepts/payment-methods/apple-pay)
[other popular payment options](/concepts/payment-methods/overview)
- Subscription lifecycle managementYou can use Paddle to handle all parts of the subscription lifecycle, including updating payment methods and canceling subscriptions using the prebuiltcustomer portal. We cover that elsewhere in our docs.

Subscription lifecycle management


You can use Paddle to handle all parts of the subscription lifecycle, including updating payment methods and canceling subscriptions using the prebuiltcustomer portal. We cover that elsewhere in our docs.

[customer portal](/concepts/customer-portal)

## Before you begin

[Before you begin](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#prerequisites)

### Sign up for Paddle

[Sign up for Paddle](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#paddle-prerequisites)

You'll need a Paddle account to get started. You can sign up for two kinds of account:

- Sandbox— for testing and evaluation
[Sandbox](/build/tools/sandbox)
- Live — for selling to customers

For this tutorial, we recommend signing up for a sandbox account. You can transition to a live account later when you've built your integration and you're ready to start selling. If you sign up for a live account, you'll need to:

- Complete account verificationWe'll ask you for some information to make sure that we can work together.

Complete account verification

[Complete account verification](/build/onboarding/set-up-checklist#verification)

We'll ask you for some information to make sure that we can work together.

- Request hosted checkout accessYou should contact support to prove eligibility to use hosted checkouts.

Request hosted checkout access

[Request hosted checkout access](mailto:sellers@paddle.com)

You should contact support to prove eligibility to use hosted checkouts.


While we're verifying your account or approving access to hosted checkouts, you can't launch a hosted checkout or sell on the Paddle platform.

[Sign up for a sandbox account.](https://sandbox-login.paddle.com/signup)

Sign up for a sandbox account.


### Prep your iOS development environment

[Prep your iOS development environment](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#dev-env-prerequisites)

As part of our tutorial, we're going to update our app to include a link to a hosted checkout for purchases. You'll need:

- Some knowledge of iOS development, access to your iOS project, and Xcode on macOS.
- Acorrectly configured URL schemeso you can redirect users back to your app.
[correctly configured URL scheme](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)

You don't need to make changes to your iOS app to create a hosted checkout in Paddle, so you can come back to this later if you're working with a developer.


## Overview

[Overview](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#tutorial-steps)

Add a hosted checkout to your app to link out for in-app purchases in five steps:

1. Map your product catalogCreate products and prices in Paddle that match your in-app purchase options.

Map your product catalog

[Map your product catalog](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#create-catalog)

Create products and prices in Paddle that match your in-app purchase options.

1. Create a hosted checkoutCreate a hosted checkout in the Paddle dashboard, including where to redirect customers to after purchase.

Create a hosted checkout

[Create a hosted checkout](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#create-hosted-checkout)

Create a hosted checkout in the Paddle dashboard, including where to redirect customers to after purchase.

1. Add a checkout button to your appCreate a button that opens the hosted checkout URL when tapped.

Add a checkout button to your app

[Add a checkout button to your app](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#add-button)

Create a button that opens the hosted checkout URL when tapped.

1. Handle fulfillment and provisioningUse RevenueCat or process webhooks to fulfill purchases after a customer completes a checkout.

Handle fulfillment and provisioning

[Handle fulfillment and provisioning](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#handle-fulfillment)

Use RevenueCat or process webhooks to fulfill purchases after a customer completes a checkout.

1. Take a test paymentMake a test purchase to make sure your purchase flow works correctly.

Take a test payment

[Take a test payment](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#test-implementation)

Make a test purchase to make sure your purchase flow works correctly.


## 1Map your product catalog

[1Map your product catalog](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#create-catalog)

Before we add a hosted checkout to our app, we need to set up our product catalog in Paddle to match the in-app purchases we offer.


### Model your pricing

[Model your pricing](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#model-create-catalog)

Acomplete productin Paddle is made up of two parts:

[complete product](/build/products/create-products-prices)
- A product entity that describes the item, like its name, description, and an image.
- At least one related price entity that describes how much and how often a product is billed.

You can create as many prices for a product as you want to describe all the ways they're billed.


In this example, we'll create a single product and single price for a one-time item calledLifetime Access.


### Create products and prices

[Create products and prices](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#paddle-create-catalog)

You cancreate products and pricesusing the Paddle dashboard or the API.

[create products and prices](/build/products/create-products-prices)
1. Go toPaddle > Catalog > Products.

Go toPaddle > Catalog > Products.

1. ClickNew product

ClickNew product

1. Enter details for your new product, then clickSavewhen you're done.

Enter details for your new product, then clickSavewhen you're done.

1. Under thePricessection on the page for your product, clickNew price

Under thePricessection on the page for your product, clickNew price

1. Enter details for your new price. Set the type toOne-timeto create a one-time price.

Enter details for your new price. Set the type toOne-timeto create a one-time price.

1. ClickSavewhen you're done.

ClickSavewhen you're done.

1. Click theoverflow buttonbutton next to a price in the list, then chooseCopy price IDfrom the menu. Keep this for later.

Click theoverflow buttonbutton next to a price in the list, then chooseCopy price IDfrom the menu. Keep this for later.


## 2Create a hosted checkout

[2Create a hosted checkout](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#create-hosted-checkout)

Next, create a hosted checkout. Ahosted checkoutis a link that users can use to make a purchase. It's unique to your account.

[hosted checkout](/concepts/sell/hosted-checkout-mobile-apps)

You can create multiple hosted checkouts if you have different apps or want to create links that redirect to different places in your app.


When creating a hosted checkout, you can set default prices. If you don't pass prices or a transaction to the checkout directly, the default prices are used instead.

> Add a custom subdomainto personalize your hosted checkout link with your company or app name, likeaeroedit.paddle.io. This is optional, but recommended for best customer experience and conversion rates.


Add a custom subdomainto personalize your hosted checkout link with your company or app name, likeaeroedit.paddle.io. This is optional, but recommended for best customer experience and conversion rates.

[Add a custom subdomain](/build/checkout/custom-subdomains)
1. Go toPaddle > Checkout > Hosted checkout.

Go toPaddle > Checkout > Hosted checkout.

1. ClickNew hosted checkout

ClickNew hosted checkout

1. Enter a name and a description. This is typically your app name and any details for your reference. They're not shown to customers.

Enter a name and a description. This is typically your app name and any details for your reference. They're not shown to customers.

1. Enter a redirect URL. This should be a custom URL scheme oruniversal linkthat bounces users back to your app when their purchase is completed, for examplemyapp://example-redirect.

Enter a redirect URL. This should be a custom URL scheme oruniversal linkthat bounces users back to your app when their purchase is completed, for examplemyapp://example-redirect.

[universal link](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content/)
1. Optionally, paste the price ID you copied previously to the list ofDefault pricesif you want this to be opened on every launch of the hosted checkout. You can add multiple price IDs if you have them to hand.

Optionally, paste the price ID you copied previously to the list ofDefault pricesif you want this to be opened on every launch of the hosted checkout. You can add multiple price IDs if you have them to hand.

1. ClickSavewhen you're done.

ClickSavewhen you're done.

1. Click theoverflow buttonbutton next to the hosted checkout you just created, then chooseCopy URLfrom the menu. Keep this for the next step.

Click theoverflow buttonbutton next to the hosted checkout you just created, then chooseCopy URLfrom the menu. Keep this for the next step.


## 3Add a checkout button to your app

[3Add a checkout button to your app](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#add-button)

Now, update your iOS app to add a button that:

1. Checks to see if in-app purchases are allowed on the device.

Checks to see if in-app purchases are allowed on the device.

1. Checks to see if a user already purchased the item.

Checks to see if a user already purchased the item.

1. Constructs a URL using your hosted checkout launch URL, and aprice_idquery parameter with the price ID you copied previously as the value.

Constructs a URL using your hosted checkout launch URL, and aprice_idquery parameter with the price ID you copied previously as the value.


Here's an example using SwiftUI:


```swift
12345678910111213141516171819201import SwiftUI
2import StoreKit // required for checking device payment capabilities using SKPaymentQueue
3
4struct PurchaseView: View {
5    let checkoutBaseURL = "https://pay.paddle.io/checkout/hsc_01jt8s46kx4nv91002z7vy4ecj_1as3scas9cascascasasx23dsa3asd2a" // replace with your checkout launch URL
6    let priceId = "pri_01h1vjg3sqjj1y9tvazkdqe5vt" // replace with a price ID or dynamically set it
7    
8    var body: some View {
9        VStack {
10            // Check if the device can make payments
11            if SKPaymentQueue.canMakePayments() {
12                // Create a purchase button with styling
13                Button("Buy now") {
14                    openCheckout()
15                }
16                .padding()
17                .background(Color.blue)
18                .foregroundColor(.white)
19                .cornerRadius(10)
20            } else {

```

> If you've set a default price for the hosted checkout, you don't need to pass aprice_idin the URL unless you want to open a checkout for a different price.


If you've set a default price for the hosted checkout, you don't need to pass aprice_idin the URL unless you want to open a checkout for a different price.


### Prefill informationRecommended

[Prefill informationRecommended](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#prefill-add-button)

To make for a more seamless user experience, you can useURL parametersto pass additional information to the hosted checkout.

[URL parameters](/paddlejs/hosted-checkout-url-parameters)

Unique identifier for this customer in RevenueCat. Used for fulfillment using entitlements in RevenueCat.


Email for this customer. You can't use if you're passingpaddle_customer_id.


Two-letter ISO 3166 country code for this customer.


ZIP or postal code of this address. Paddle Checkout only asks for this in countries with postal codes.


For a full list, seeHosted checkout URL query parameters

[Hosted checkout URL query parameters](/paddlejs/hosted-checkout-url-parameters)

In this updated example, we pass customer details and a unique identifier for the customer in RevenueCat.


```swift
12345678910111213141516171819201import SwiftUI
2import StoreKit // required for checking device payment capabilities using SKPaymentQueue
3
4struct PurchaseView: View {
5    let checkoutBaseURL = "https://pay.paddle.io/checkout/hsc_01jt8s46kx4nv91002z7vy4ecj_1as3scas9cascascasasx23dsa3asd2a" // replace with your checkout launch URL
6    let priceId = "pri_01h1vjg3sqjj1y9tvazkdqe5vt" // replace with a price ID or dynamically set it
7    
8    // Additional information
9    // In a real app, this would come from your user authentication platform
10    let appUserId = "85886aac-eef6-41df-8133-743cbb1daa4b"
11    let userEmail = "sam@example.com"
12    let countryCode = "US"
13    let postalCode = "10021"
14    
15    var body: some View {
16        VStack {
17            // Check if the device can make payments
18            if SKPaymentQueue.canMakePayments() {
19                // Create a purchase button with styling
20                Button("Buy now") {

```


## 4Handle fulfillment and provisioning

[4Handle fulfillment and provisioning](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#handle-fulfillment)

When a customer completes a purchase, they'll be redirected back to your app. At this point, you need to handle fulfillment and unlock the features they bought.


If you use theRevenueCat x Paddle integrationto handle entitlements, you're all set!

[RevenueCat x Paddle integration](https://www.paddle.com/revenuecat-integration-beta)

Here's how it works:

1. Paddle automatically sends data to RevenueCat about the completed checkout.

Paddle automatically sends data to RevenueCat about the completed checkout.

1. RevenueCat grants the user an entitlement based onyour product configuration.

RevenueCat grants the user an entitlement based onyour product configuration.

[your product configuration](https://www.revenuecat.com/docs/offerings/products-overview)
1. Use the RevenueCat SDK tocheck entitlement statusin your iOS app.

Use the RevenueCat SDK tocheck entitlement statusin your iOS app.

[check entitlement status](https://www.revenuecat.com/docs/customers/customer-info)

You can use webhooks to build your own fulfillment workflow. In this example, we'll grant users access when they've purchased ourLifetime Accessproduct.


#### Build a webhook handler

[Build a webhook handler](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#handler-handle-fulfillment)

When a customer creates or completes a transaction, Paddle can send a webhook to an endpoint you set up. You can store details of the transaction in your database and associate it with the user's account.


Add a new endpoint to the existing server-side code as set up inSet up the endpoint.

[Set up the endpoint](/build/mobile-apps/link-out-mobile-app-custom-workflow#setup-endpoint-create-transaction)

```typescript
12345678910111213141516171819201app.post("/paddle/webhooks", express.raw({ type: 'application/json' }), async (req, res) => {
2  try {
3    // You can verify the webhook signature here
4    // We don't cover this in the tutorial but it's best practice to do so
5    // https://developer.paddle.com/webhooks/signature-verification
6
7    const payload = JSON.parse(req.body.toString());
8    const { data, event_type } = payload;
9    const occurredAt = payload.occurred_at;
10
11    // Listen for vital events from Paddle
12    switch (event_type) {
13      // 1. Record transactions in the database
14
15      // Handle a new transaction
16      // You can create a Transaction database to store records and associate them to a user
17      case 'transaction.created':
18        // Find the user associated with this transaction
19        const userForTransaction = await User.findOne({ where: { paddleCustomerId: data.customer_id } });
20

```


#### Unlock user access

[Unlock user access](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#provision-access-handle-fulfillment)

When you receive thetransaction.completedwebhook, you can use the details to handle order fulfillment and provisioning.

[transaction.completed](/webhooks/transactions/transaction-completed)

The example below updates a user's access permissions in your database. After this, your iOS app can check for thelifetimeAccesspermission to unlock premium features.


```typescript
444546474849505152535455565758596061626344          await completedTransaction.update({
45            status: data.status,
46            subscriptionId: data.subscription_id,
47            invoiceId: data.invoice_id,
48            invoiceNumber: data.invoice_number,
49            billedAt: data.billed_at,
50            updatedAt: data.updated_at
51          });
52
53          // 2. Provision access to your app
54          // Fetch the user associated with this transaction
55          const user = await User.findOne({ where: { id: completedTransaction.userId } });
56
57          if (user) {
58            // Fetch the items from the transaction
59            const purchasedItems = data.items || [];
60
61            // Add what access the user has based on the items they purchased
62            // For this example, we're using access permissions and storing them in the user model on an accessPermissions field
63            // We also map the Paddle product IDs to the access permissions

```


#### Create a notification destination

[Create a notification destination](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#create-destination-handle-fulfillment)

To start receiving webhooks,create a notification destination. This is where you can tell Paddle which events you want to receive and where to deliver them to.

[create a notification destination](/webhooks/notification-destinations)
1. Go toPaddle > Developer Tools > Notifications.

Go toPaddle > Developer Tools > Notifications.

1. ClickNew destination.

ClickNew destination.

1. Give your destination a name.

Give your destination a name.

1. Make sure notification type is set towebhook— this is the default.

Make sure notification type is set towebhook— this is the default.

1. Enter the URL for your webhook handler, then check thetransaction.completedbox. You can always edit events later.

Enter the URL for your webhook handler, then check thetransaction.completedbox. You can always edit events later.

1. ClickSave destinationwhen you're done.

ClickSave destinationwhen you're done.


## 5Test the complete flow

[5Test the complete flow](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#test-implementation)

We're now ready to test the complete purchase flow end-to-end! If you're using a sandbox account, you can take a test payment usingour test card details:

[our test card details](/concepts/payment-methods/credit-debit-card)

| Email address | An email address you own |
| Country | Any valid country supported by Paddle |
| ZIP code(if required) | Any valid ZIP or postal code |
| Card number | 4242 4242 4242 4242 |
| Name on card | Any name |
| Expiration date | Any valid date in the future. |
| Security code | 100 |


## Next steps

[Next steps](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#next-steps)

That's it! Now you've built a purchase workflow that links out to Paddle Checkout, you might like to hook into other features of the Paddle platform.


### Learn more about Paddle

[Learn more about Paddle](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#learn-more-next-steps)

When you use Paddle, we take care of payments, tax, subscriptions, and metrics with one unified platform. Customers can self-serve with the portal, and Paddle handles any order inquiries for you.

[Read more](/concepts/payment-methods/overview)
[Read more](/concepts/profitwell-metrics)
[Read more](/concepts/customer-portal)

### Build a web checkout

[Build a web checkout](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#web-checkout-next-steps)

Our tutorial uses a hosted checkout to build a payment workflow. You can also Paddle.js to build pricing pages and signup flows on the web, then redirect people to your app.

[Read more](/build/onboarding/overview)
[Read more](/build/products/offer-localized-pricing)
[Read more](/paddlejs/events/overview)

### Build advanced subscription functionality

[Build advanced subscription functionality](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app#extend-checkout-next-steps)

Paddle Billing is designed for subscriptions as well as one-time items. You can use Paddle to build workflows to pause and resume subscriptions, flexibly change billing dates, and offer trials.

[Read more](/build/subscriptions/pause-subscriptions)
[Read more](/build/subscriptions/update-trials)
[Read more](/concepts/retain/overview)
- Add a hosted checkout to your mobile app
[Add a hosted checkout to your mobile app](#add-a-hosted-checkout-to-your-mobile-app)
- What are we building?
[What are we building?](#objectives)
- What's not covered
[What's not covered](#exclusions)
- Before you begin
[Before you begin](#prerequisites)
- Sign up for Paddle
[Sign up for Paddle](#paddle-prerequisites)
- Prep your iOS development environment
[Prep your iOS development environment](#dev-env-prerequisites)
- Overview
[Overview](#tutorial-steps)
- Map your product catalog
[Map your product catalog](#create-catalog)
- Model your pricing
[Model your pricing](#model-create-catalog)
- Create products and prices
[Create products and prices](#paddle-create-catalog)
- Create a hosted checkout
[Create a hosted checkout](#create-hosted-checkout)
- Add a checkout button to your app
[Add a checkout button to your app](#add-button)
- Prefill information
[Prefill information](#prefill-add-button)
- Handle fulfillment and provisioning
[Handle fulfillment and provisioning](#handle-fulfillment)
- Test the complete flow
[Test the complete flow](#test-implementation)
- Next steps
[Next steps](#next-steps)
- Learn more about Paddle
[Learn more about Paddle](#learn-more-next-steps)
- Build a web checkout
[Build a web checkout](#web-checkout-next-steps)
- Build advanced subscription functionality
[Build advanced subscription functionality](#extend-checkout-next-steps)

---

*Last scraped: 2025-12-15 20:19:18*
