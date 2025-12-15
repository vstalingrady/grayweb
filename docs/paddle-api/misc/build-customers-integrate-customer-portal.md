# Use customer portal links in your app

**Source:** https://developer.paddle.com/build/customers/integrate-customer-portal

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

# Use customer portal links in your app

[Use customer portal links in your app](/build/customers/integrate-customer-portal#use-customer-portal-links-in-your-app)

Add customer portal links to your app to hand off core billing workflows to Paddle, letting customers manage subscriptions, payments, and account information.


The customer portalgives customers a centralized place to manage purchases made from your Paddle account. You can link to the customer portal to add core subscription management, billing information, and payment history to your app.

[The customer portal](/concepts/customer-portal)

## How it works

[How it works](/build/customers/integrate-customer-portal#background)

When integrating Paddle, you need to build workflows to let customers manage their subscriptions, payments, and account information. You can do this in two ways:

- Build your own workflowsYou can use the Paddle API to build your own billing management screens. For example, you can use the cancel subscription operation tobuild a workflow to let customers canceltheir subscription.

Build your own workflows


You can use the Paddle API to build your own billing management screens. For example, you can use the cancel subscription operation tobuild a workflow to let customers canceltheir subscription.

[build a workflow to let customers cancel](/build/subscriptions/cancel-subscriptions)
- Link to the customer portal from your appYou can link tothe customer portal, letting Paddle handle billing management. For example, you can link to the cancel subscription page in the customer portal to let customers cancel their subscription.

Link to the customer portal from your app


You can link tothe customer portal, letting Paddle handle billing management. For example, you can link to the cancel subscription page in the customer portal to let customers cancel their subscription.

[the customer portal](/concepts/customer-portal)

While building your own workflows is great for deep integration, the customer portal is fully hosted by Paddle and includes core billing functionality out-of-the-box, making it quicker to integrate.


### Customer portal sessions

[Customer portal sessions](/build/customers/integrate-customer-portal#background-security)

You can link directly to the customer portal, where customers can log in using their email address. However, for the best customer experience, we recommend creating acustomer portal sessionwhen linking to a customer portal from your app.

[customer portal session](/api-reference/customer-portals/overview)

Customer portal sessions generate authenticated links that automatically sign a customer in to the customer portal. This makes sense in the context of your app, where customers are already signed in and linking to a screen that asks them to log in again might cause confusion.


Authenticated links include atokenparameter, which Paddle uses to identify the customer and present their information in the portal. These tokens are unique and impossible to guess, restricted to a particular customer, and automatically expire. They can only be generated with the Paddle API using a valid API key.

> Customer portal sessions are temporary and shouldn't be cached. Create a new customer portal session each time you want to generate authenticated links to the customer portal.


Customer portal sessions are temporary and shouldn't be cached. Create a new customer portal session each time you want to generate authenticated links to the customer portal.


### Deep links

[Deep links](/build/customers/integrate-customer-portal#background-deeplinks)

As well as linking to the customer portal homepage, you can create links that take customers to specific pages in the portal. For example, you can create links that take customers to the cancellation page for a specific subscription. This means you can add buttons or links to your app for particular workflows, like updating payment details or canceling a subscription.


## Before you begin

[Before you begin](/build/customers/integrate-customer-portal#prerequisites)

Customer portal sessions are forcustomers, so you'll need the Paddle ID of a customer that you want to generate authenticated links for. You canlist customers using the Paddle APIor search for them in the dashboard.

[customers](/api-reference/customers/overview)
[list customers using the Paddle API](/api-reference/customers/list-customers)

## Generate an authenticated link to the customer portal homepage

[Generate an authenticated link to the customer portal homepage](/build/customers/integrate-customer-portal#create-homepage-link)

Create a customer portal session for a customer to generate an authenticated link to the customer portal homepage. Customers can do things like see their past payments and download invoices.


Send aPOSTrequest to the/{customer_id}/portal-sessionsendpoint. You don't need to include a request body.


Paddle ID of the customer that you want to create a customer portal session for.


### Response

[Response](/build/customers/integrate-customer-portal#response-create-homepage-link)

If successful, Paddle returns the new customer portal session entity.urls.general.overviewis an authenticated link to the customer portal homepage for a customer.


```json
123456789101112131415161{
2  "data": {
3    "id": "cpls_01jcgezdnnd1t0c7wdrdher9vv",
4    "customer_id": "ctm_01jcdaf4zgm2fxw3nc0e4fn137",
5    "urls": {
6      "general": {
7        "overview": "https://customer-portal.paddle.com/cpl_01gsx07ferwf96qnjz1mrc6h0q?action=overview&token=pga_eyJhbGciOiJFZERTQSIsImtpZCI6Imp3a18wMWhkazBuOHF3OG55NTJ5cGNocGNhazA1ayIsInR5cCI6IkpXVCJ9.eyJpZCI6InBnYV8wMWpjZ2V6ZG52MmpkYTk3eHR2dHF3ZjN5bSIsInNlbGxlci1pZCI6IjEwODg5IiwidHlwZSI6InN0YW5kYXJkIiwidmVyc2lvbiI6IjEiLCJ1c2FnZSI6ImN1c3RvbWVyLXBvcnRhbC1zZXNzaW9uIiwic2NvcGUiOiJjdXN0b21lci5jaGVja291dC5jcmVhdGUgY3VzdG9tZXIuY2hlY2tvdXQucmVhZCBjdXN0b21lci5jdXN0b21lci5yZWFkIGN1c3RvbWVyLmN1c3RvbWVyLnVwZGF0ZSBjdXN0b21lci5jdXN0b21lci1hZGRyZXNzLnJlYWQgY3VzdG9tZXIuY3VzdG9tZXItcGF5bWVudC1tZXRob2QucmVhZCBjdXN0b21lci5jdXN0b21lci1wYXltZW50LW1ldGhvZC5kZWxldGUgY3VzdG9tZXIuaW52b2ljZS5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1jYW5jZWwuY3JlYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1wYXltZW50LnJlYWQgY3VzdG9tZXIuc3Vic2NyaXB0aW9uLXBheW1lbnQudXBkYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi51cGRhdGUgY3VzdG9tZXIudHJhbnNhY3Rpb24ucmVhZCBjdXN0b21lci50cmFuc2FjdGlvbi5vcmlnaW4ucmVhZCIsImlzcyI6Imd1ZXN0YWNjZXNzLXNlcnZpY2UiLCJzdWIiOiJjdG1fMDFqY2RhZjR6Z20yZnh3M25jMGU0Zm4xMzciLCJleHAiOjE3MzE1MTA4MDEsImlhdCI6MTczMTQyNDQwMX0.Wh-U6mgB77_lqrERJPU5dql4yq523CjlYT3kHIUbYll7sSG-QmJV7jRmg9pBCFPxMlCxsBI-8pe1Nt3FucOKBg"
8      },
9      "subscriptions": []
10    },
11    "created_at": "2024-11-12T15:13:21.077605273Z"
12  },
13  "meta": {
14    "request_id": "bd45eef1-a078-421b-b5d8-281a37c40f07"
15  }
16}
```


## Generate links for subscription management workflows

[Generate links for subscription management workflows](/build/customers/integrate-customer-portal#create-subscription-deeplinks)

Pass an array of subscriptions when creating a customer portal session for a customer to generate deep links that let customers make changes to their subscriptions.

1. Get subscriptionsGet the subscriptions that you want to create deep links for.

Get subscriptions

[Get subscriptions](/build/customers/integrate-customer-portal#get-subscriptions-create-subscription-deeplinks)

Get the subscriptions that you want to create deep links for.

1. Build requestBuild a request that includes a list of subscriptions.

Build request

[Build request](/build/customers/integrate-customer-portal#build-request-create-subscription-deeplinks)

Build a request that includes a list of subscriptions.

1. Create your portal sessionSend the request to create a customer portal session. Paddle creates it and generates authenticated links for you.

Create your portal session

[Create your portal session](/build/customers/integrate-customer-portal#post-create-subscription-deeplinks)

Send the request to create a customer portal session. Paddle creates it and generates authenticated links for you.


### Get subscriptions

[Get subscriptions](/build/customers/integrate-customer-portal#get-subscriptions-create-subscription-deeplinks)

To create deep links for subscriptions, you'll need their Paddle IDs. You can list subscriptions filtered bycustomer_idto return a paginated list of subscriptions for a customer.


Return entities related to the specified customer. Use a comma-separated list to specify multiple customer IDs.


#### Response

[Response](/build/customers/integrate-customer-portal#response)

If successful, Paddle responds with a paginated list of subscriptions for a customer.


For each subscription you want to generate deep links for, extract theidand save these for later — we'll use this in the next step.


```json
12345678910111213141516171819201{
2  "data": [
3    {
4      "id": "sub_01jcgfqad406rsfjcgq44g9djq",
5      "status": "active",
6      "customer_id": "ctm_01jcdaf4zgm2fxw3nc0e4fn137",
7      "address_id": "add_01jcgfpv9rn7kpb0d2yjdexbkr",
8      "business_id": null,
9      "currency_code": "USD",
10      "created_at": "2024-11-12T15:26:24.164Z",
11      "updated_at": "2024-11-12T15:26:24.164Z",
12      "started_at": "2024-11-12T15:26:23.357178Z",
13      "first_billed_at": "2024-11-12T15:26:23.357178Z",
14      "next_billed_at": "2024-12-12T15:26:23.357178Z",
15      "paused_at": null,
16      "canceled_at": null,
17      "collection_mode": "automatic",
18      "billing_details": null,
19      "current_billing_period": {
20        "starts_at": "2024-11-12T15:26:23.357178Z",

```


### Build request

[Build request](/build/customers/integrate-customer-portal#build-request-create-subscription-deeplinks)

Build a request that includes asubscription_idsarray.


Your array should contain a list of strings, where each string is the Paddle ID of a subscription that you want to generate deep links for.


List of subscription to create authenticated customer portal deep links for.


#### Request

[Request](/build/customers/integrate-customer-portal#request-create-subscription-deeplinks)

This example creates a customer portal session with deep links for two subscriptions.


```json
1234561{
2  "subscription_ids": [
3    "sub_01jcgfqad406rsfjcgq44g9djq",
4    "sub_01jcdafvpe5hm4vczfefsbwhvp"
5  ]
6}
```


### Create customer portal

[Create customer portal](/build/customers/integrate-customer-portal#post-create-subscription-deeplinks)

Send aPOSTrequest to the/{customer_id}/portal-sessionsendpoint with the request you built.


Paddle ID of the customer that you want to create a customer portal session for.


#### Response

[Response](/build/customers/integrate-customer-portal#response-create-subscription-deeplinks)

If successful, Paddle returns the new customer portal session entity. It includesurls.general.overview, which is an authenticated link to the customer portal homepage for a customer.


Thesubscriptionsarray includes an object for each subscription passed in the request. For each subscription, Paddle generates an authenticatedcancel_subscriptionandupdate_subscription_payment_methodlink.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "cpls_01jcggxbs9b4tff8zy7kfwwr1s",
4    "customer_id": "ctm_01jcdaf4zgm2fxw3nc0e4fn137",
5    "urls": {
6      "general": {
7        "overview": "https://customer-portal.paddle.com/cpl_01gsx07ferwf96qnjz1mrc6h0q?action=overview&token=pga_eyJhbGciOiJFZERTQSIsImtpZCI6Imp3a18wMWhkazBuOHF3OG55NTJ5cGNocGNhazA1ayIsInR5cCI6IkpXVCJ9.eyJpZCI6InBnYV8wMWpjZ2d4YnNmNTEzcGY1MjZyNjZrbTMxOSIsInNlbGxlci1pZCI6IjEwODg5IiwidHlwZSI6InN0YW5kYXJkIiwidmVyc2lvbiI6IjEiLCJ1c2FnZSI6ImN1c3RvbWVyLXBvcnRhbC1zZXNzaW9uIiwic2NvcGUiOiJjdXN0b21lci5jaGVja291dC5jcmVhdGUgY3VzdG9tZXIuY2hlY2tvdXQucmVhZCBjdXN0b21lci5jdXN0b21lci5yZWFkIGN1c3RvbWVyLmN1c3RvbWVyLnVwZGF0ZSBjdXN0b21lci5jdXN0b21lci1hZGRyZXNzLnJlYWQgY3VzdG9tZXIuY3VzdG9tZXItcGF5bWVudC1tZXRob2QucmVhZCBjdXN0b21lci5jdXN0b21lci1wYXltZW50LW1ldGhvZC5kZWxldGUgY3VzdG9tZXIuaW52b2ljZS5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1jYW5jZWwuY3JlYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1wYXltZW50LnJlYWQgY3VzdG9tZXIuc3Vic2NyaXB0aW9uLXBheW1lbnQudXBkYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi51cGRhdGUgY3VzdG9tZXIudHJhbnNhY3Rpb24ucmVhZCBjdXN0b21lci50cmFuc2FjdGlvbi5vcmlnaW4ucmVhZCIsImlzcyI6Imd1ZXN0YWNjZXNzLXNlcnZpY2UiLCJzdWIiOiJjdG1fMDFqY2RhZjR6Z20yZnh3M25jMGU0Zm4xMzciLCJleHAiOjE3MzE1MTI4MzAsImlhdCI6MTczMTQyNjQzMH0.DHHFoLwIDWCt9F9hZmGTG3G-uhi9tUltTbMSY6Nf-vVplemJYrcC_PyF97Wm88bmHEO1f8LL3agMYNFDwvzADw"
8      },
9      "subscriptions": [
10        {
11          "id": "sub_01jcgfqad406rsfjcgq44g9djq",
12          "cancel_subscription": "https://customer-portal.paddle.com/cpl_01gsx07ferwf96qnjz1mrc6h0q?action=cancel_subscription&subscription_id=sub_01jcgfqad406rsfjcgq44g9djq&token=pga_eyJhbGciOiJFZERTQSIsImtpZCI6Imp3a18wMWhkazBuOHF3OG55NTJ5cGNocGNhazA1ayIsInR5cCI6IkpXVCJ9.eyJpZCI6InBnYV8wMWpjZ2d4YnNmNTEzcGY1MjZyNjZrbTMxOSIsInNlbGxlci1pZCI6IjEwODg5IiwidHlwZSI6InN0YW5kYXJkIiwidmVyc2lvbiI6IjEiLCJ1c2FnZSI6ImN1c3RvbWVyLXBvcnRhbC1zZXNzaW9uIiwic2NvcGUiOiJjdXN0b21lci5jaGVja291dC5jcmVhdGUgY3VzdG9tZXIuY2hlY2tvdXQucmVhZCBjdXN0b21lci5jdXN0b21lci5yZWFkIGN1c3RvbWVyLmN1c3RvbWVyLnVwZGF0ZSBjdXN0b21lci5jdXN0b21lci1hZGRyZXNzLnJlYWQgY3VzdG9tZXIuY3VzdG9tZXItcGF5bWVudC1tZXRob2QucmVhZCBjdXN0b21lci5jdXN0b21lci1wYXltZW50LW1ldGhvZC5kZWxldGUgY3VzdG9tZXIuaW52b2ljZS5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1jYW5jZWwuY3JlYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1wYXltZW50LnJlYWQgY3VzdG9tZXIuc3Vic2NyaXB0aW9uLXBheW1lbnQudXBkYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi51cGRhdGUgY3VzdG9tZXIudHJhbnNhY3Rpb24ucmVhZCBjdXN0b21lci50cmFuc2FjdGlvbi5vcmlnaW4ucmVhZCIsImlzcyI6Imd1ZXN0YWNjZXNzLXNlcnZpY2UiLCJzdWIiOiJjdG1fMDFqY2RhZjR6Z20yZnh3M25jMGU0Zm4xMzciLCJleHAiOjE3MzE1MTI4MzAsImlhdCI6MTczMTQyNjQzMH0.DHHFoLwIDWCt9F9hZmGTG3G-uhi9tUltTbMSY6Nf-vVplemJYrcC_PyF97Wm88bmHEO1f8LL3agMYNFDwvzADw",
13          "update_subscription_payment_method": "https://customer-portal.paddle.com/cpl_01gsx07ferwf96qnjz1mrc6h0q?action=update_subscription_payment_method&subscription_id=sub_01jcgfqad406rsfjcgq44g9djq&token=pga_eyJhbGciOiJFZERTQSIsImtpZCI6Imp3a18wMWhkazBuOHF3OG55NTJ5cGNocGNhazA1ayIsInR5cCI6IkpXVCJ9.eyJpZCI6InBnYV8wMWpjZ2d4YnNmNTEzcGY1MjZyNjZrbTMxOSIsInNlbGxlci1pZCI6IjEwODg5IiwidHlwZSI6InN0YW5kYXJkIiwidmVyc2lvbiI6IjEiLCJ1c2FnZSI6ImN1c3RvbWVyLXBvcnRhbC1zZXNzaW9uIiwic2NvcGUiOiJjdXN0b21lci5jaGVja291dC5jcmVhdGUgY3VzdG9tZXIuY2hlY2tvdXQucmVhZCBjdXN0b21lci5jdXN0b21lci5yZWFkIGN1c3RvbWVyLmN1c3RvbWVyLnVwZGF0ZSBjdXN0b21lci5jdXN0b21lci1hZGRyZXNzLnJlYWQgY3VzdG9tZXIuY3VzdG9tZXItcGF5bWVudC1tZXRob2QucmVhZCBjdXN0b21lci5jdXN0b21lci1wYXltZW50LW1ldGhvZC5kZWxldGUgY3VzdG9tZXIuaW52b2ljZS5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1jYW5jZWwuY3JlYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1wYXltZW50LnJlYWQgY3VzdG9tZXIuc3Vic2NyaXB0aW9uLXBheW1lbnQudXBkYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi51cGRhdGUgY3VzdG9tZXIudHJhbnNhY3Rpb24ucmVhZCBjdXN0b21lci50cmFuc2FjdGlvbi5vcmlnaW4ucmVhZCIsImlzcyI6Imd1ZXN0YWNjZXNzLXNlcnZpY2UiLCJzdWIiOiJjdG1fMDFqY2RhZjR6Z20yZnh3M25jMGU0Zm4xMzciLCJleHAiOjE3MzE1MTI4MzAsImlhdCI6MTczMTQyNjQzMH0.DHHFoLwIDWCt9F9hZmGTG3G-uhi9tUltTbMSY6Nf-vVplemJYrcC_PyF97Wm88bmHEO1f8LL3agMYNFDwvzADw"
14        },
15        {
16          "id": "sub_01jcdafvpe5hm4vczfefsbwhvp",
17          "cancel_subscription": "https://customer-portal.paddle.com/cpl_01gsx07ferwf96qnjz1mrc6h0q?action=cancel_subscription&subscription_id=sub_01jcdafvpe5hm4vczfefsbwhvp&token=pga_eyJhbGciOiJFZERTQSIsImtpZCI6Imp3a18wMWhkazBuOHF3OG55NTJ5cGNocGNhazA1ayIsInR5cCI6IkpXVCJ9.eyJpZCI6InBnYV8wMWpjZ2d4YnNmNTEzcGY1MjZyNjZrbTMxOSIsInNlbGxlci1pZCI6IjEwODg5IiwidHlwZSI6InN0YW5kYXJkIiwidmVyc2lvbiI6IjEiLCJ1c2FnZSI6ImN1c3RvbWVyLXBvcnRhbC1zZXNzaW9uIiwic2NvcGUiOiJjdXN0b21lci5jaGVja291dC5jcmVhdGUgY3VzdG9tZXIuY2hlY2tvdXQucmVhZCBjdXN0b21lci5jdXN0b21lci5yZWFkIGN1c3RvbWVyLmN1c3RvbWVyLnVwZGF0ZSBjdXN0b21lci5jdXN0b21lci1hZGRyZXNzLnJlYWQgY3VzdG9tZXIuY3VzdG9tZXItcGF5bWVudC1tZXRob2QucmVhZCBjdXN0b21lci5jdXN0b21lci1wYXltZW50LW1ldGhvZC5kZWxldGUgY3VzdG9tZXIuaW52b2ljZS5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1jYW5jZWwuY3JlYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1wYXltZW50LnJlYWQgY3VzdG9tZXIuc3Vic2NyaXB0aW9uLXBheW1lbnQudXBkYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi51cGRhdGUgY3VzdG9tZXIudHJhbnNhY3Rpb24ucmVhZCBjdXN0b21lci50cmFuc2FjdGlvbi5vcmlnaW4ucmVhZCIsImlzcyI6Imd1ZXN0YWNjZXNzLXNlcnZpY2UiLCJzdWIiOiJjdG1fMDFqY2RhZjR6Z20yZnh3M25jMGU0Zm4xMzciLCJleHAiOjE3MzE1MTI4MzAsImlhdCI6MTczMTQyNjQzMH0.DHHFoLwIDWCt9F9hZmGTG3G-uhi9tUltTbMSY6Nf-vVplemJYrcC_PyF97Wm88bmHEO1f8LL3agMYNFDwvzADw",
18          "update_subscription_payment_method": "https://customer-portal.paddle.com/cpl_01gsx07ferwf96qnjz1mrc6h0q?action=update_subscription_payment_method&subscription_id=sub_01jcdafvpe5hm4vczfefsbwhvp&token=pga_eyJhbGciOiJFZERTQSIsImtpZCI6Imp3a18wMWhkazBuOHF3OG55NTJ5cGNocGNhazA1ayIsInR5cCI6IkpXVCJ9.eyJpZCI6InBnYV8wMWpjZ2d4YnNmNTEzcGY1MjZyNjZrbTMxOSIsInNlbGxlci1pZCI6IjEwODg5IiwidHlwZSI6InN0YW5kYXJkIiwidmVyc2lvbiI6IjEiLCJ1c2FnZSI6ImN1c3RvbWVyLXBvcnRhbC1zZXNzaW9uIiwic2NvcGUiOiJjdXN0b21lci5jaGVja291dC5jcmVhdGUgY3VzdG9tZXIuY2hlY2tvdXQucmVhZCBjdXN0b21lci5jdXN0b21lci5yZWFkIGN1c3RvbWVyLmN1c3RvbWVyLnVwZGF0ZSBjdXN0b21lci5jdXN0b21lci1hZGRyZXNzLnJlYWQgY3VzdG9tZXIuY3VzdG9tZXItcGF5bWVudC1tZXRob2QucmVhZCBjdXN0b21lci5jdXN0b21lci1wYXltZW50LW1ldGhvZC5kZWxldGUgY3VzdG9tZXIuaW52b2ljZS5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1jYW5jZWwuY3JlYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi1wYXltZW50LnJlYWQgY3VzdG9tZXIuc3Vic2NyaXB0aW9uLXBheW1lbnQudXBkYXRlIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi5yZWFkIGN1c3RvbWVyLnN1YnNjcmlwdGlvbi51cGRhdGUgY3VzdG9tZXIudHJhbnNhY3Rpb24ucmVhZCBjdXN0b21lci50cmFuc2FjdGlvbi5vcmlnaW4ucmVhZCIsImlzcyI6Imd1ZXN0YWNjZXNzLXNlcnZpY2UiLCJzdWIiOiJjdG1fMDFqY2RhZjR6Z20yZnh3M25jMGU0Zm4xMzciLCJleHAiOjE3MzE1MTI4MzAsImlhdCI6MTczMTQyNjQzMH0.DHHFoLwIDWCt9F9hZmGTG3G-uhi9tUltTbMSY6Nf-vVplemJYrcC_PyF97Wm88bmHEO1f8LL3agMYNFDwvzADw"
19        }
20      ]

```


## Related pages

[Related pages](/build/customers/integrate-customer-portal#related-pages)
[Read more](/concepts/customer-portal)
[Read more](/api-reference/customer-portals/overview)
- Use customer portal links in your app
[Use customer portal links in your app](#use-customer-portal-links-in-your-app)
- How it works
[How it works](#background)
- Customer portal sessions
[Customer portal sessions](#background-security)
- Deep links
[Deep links](#background-deeplinks)
- Before you begin
[Before you begin](#prerequisites)
- Generate an authenticated link to the customer portal homepage
[Generate an authenticated link to the customer portal homepage](#create-homepage-link)
- Response
[Response](#response-create-homepage-link)
- Generate links for subscription management workflows
[Generate links for subscription management workflows](#create-subscription-deeplinks)
- Get subscriptions
[Get subscriptions](#get-subscriptions-create-subscription-deeplinks)
- Build request
[Build request](#build-request-create-subscription-deeplinks)
- Create customer portal
[Create customer portal](#post-create-subscription-deeplinks)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:37*
