# Hosted checkout for mobile apps

**Source:** https://developer.paddle.com/concepts/sell/hosted-checkout-mobile-apps

---

- Overview
[Overview](/concepts/overview)
- What is Paddle?
[What is Paddle?](/concepts/how-paddle-works/overview)
- Sell with Paddle
- Paddle Checkout
[Paddle Checkout](/concepts/sell/self-serve-checkout)
- Overlay checkout
[Overlay checkout](/concepts/sell/overlay-checkout)
- Inline checkout
[Inline checkout](/concepts/sell/branded-integrated-inline-checkout)
- Hosted checkout
[Hosted checkout](/concepts/sell/hosted-checkout-mobile-apps)
- Upsell checkout
[Upsell checkout](/concepts/sell/upsell-checkout)
- Invoices
[Invoices](/concepts/sell/sales-assisted-invoice)
- Customer portal
[Customer portal](/concepts/customer-portal)
- Checkout recovery
[Checkout recovery](/concepts/sell/checkout-recovery)
- Supported currencies
[Supported currencies](/concepts/sell/supported-currencies)
- Supported countries
[Supported countries](/concepts/sell/supported-countries-locales)
- Payment methods
- Overview
[Overview](/concepts/payment-methods/overview)
- Cards
[Cards](/concepts/payment-methods/credit-debit-card)
- Bank or wire transfer
[Bank or wire transfer](/concepts/payment-methods/wire-transfer)
- PayPal
[PayPal](/concepts/payment-methods/paypal)
- Apple Pay
[Apple Pay](/concepts/payment-methods/apple-pay)
- Google Pay
[Google Pay](/concepts/payment-methods/google-pay)
- iDEAL
[iDEAL](/concepts/payment-methods/ideal)
- Bancontact
[Bancontact](/concepts/payment-methods/bancontact)
- BLIK
[BLIK](/concepts/payment-methods/blik)
- MB WAY
[MB WAY](/concepts/payment-methods/mb-way)
- Pix
[Pix](/concepts/payment-methods/pix)
- UPI
[UPI](/concepts/payment-methods/upi)
- Alipay
[Alipay](/concepts/payment-methods/alipay)
- WeChat Pay
[WeChat Pay](/concepts/payment-methods/wechat-pay)
- Korean payment methods
- Dunning and retention
- Paddle Retain
[Paddle Retain](/concepts/retain/overview)
- Payment Recovery
[Payment Recovery](/concepts/retain/payment-recovery-dunning)
- Cancellation Flows
[Cancellation Flows](/concepts/retain/cancellation-flows-surveys)
- Term Optimization
[Term Optimization](/concepts/retain/term-optimization)
- Subscriptions and billing
- Trials
[Trials](/concepts/subscriptions/trials)
- Proration
[Proration](/concepts/subscriptions/proration)
- Grow
- ProfitWell Metrics
[ProfitWell Metrics](/concepts/profitwell-metrics)
- AI and automation
- Model Context Protocol (MCP)
[Model Context Protocol (MCP)](/concepts/mcp)

# Hosted checkout for mobile apps

[Hosted checkout for mobile apps](/concepts/sell/hosted-checkout-mobile-apps#hosted-checkout-for-mobile-apps)

Hosted checkout is the quickest way to let mobile app users make purchases outside your app. Present users with a secure, optimized checkout experience that redirects back to your app.


Quickly add a mobile purchase flow using hosted checkout. Customers tap a button in your app to open a checkout, then they're redirected to your app when they complete their purchase.


Hosted checkout is fully hosted by Paddle, meaning you can add it in minutes — no need to build or host a checkout on your own infrastructure.


### Lower fees than IAPs


Go directly to your users and save on App Store fees, while boosting customer LTV.


### Build customer relationships


Collect email and demographic data, and communicate directly with customers.


### Seamless user experience


Users are automatically redirected back to your app after completing their purchase.


### Multiple payment methods


Offer Apple Pay, Google Pay, PayPal, and other payment methods without any additional setup.


### Chargeback protection


Paddle handles chargebacks, fights fraud, and prevents card attacks for you.


### Built-in buyer support


Customers can self-serve using the customer portal, and Paddle handles order inquiries.

> Access to hosted checkouts on live accounts is limited to approved mobile app companies. It's available on allsandbox accountsfor evaluation and testing. To request approval,contact support.


Access to hosted checkouts on live accounts is limited to approved mobile app companies. It's available on allsandbox accountsfor evaluation and testing. To request approval,contact support.

[sandbox accounts](/build/tools/sandbox)
[contact support](mailto:sellers@paddle.com)

## How it works

[How it works](/concepts/sell/hosted-checkout-mobile-apps#background)

With recent developments in legislation around the App Store, you can link users in theUnited Statesto an external checkout for purchases in iOS apps.


Use hosted checkout to add a secure, optimized payment experience to your app.


Instead of processing payments through the App Store, you can direct users to a Paddle-hosted checkout page,personalized with your company or app name in the URL. When users complete a purchase, they're seamlessly redirected back to your app where you can handle fulfillment.

[personalized with your company or app name in the URL](/build/checkout/custom-subdomains)

As amerchant of record, Paddle comes with all the benefits of the App Store — including global payments, tax compliance, fraud prevention, and buyer support — with lower fees and more control over the purchase flow.

[merchant of record](https://mor.paddle.com/)

Typical payment service providers (PSPs) aren't set up to handle these tasks, leaving app developers to take on responsibility for compliance, global tax remittance, and handling refunds and chargebacks.


|  | Paddle | App Store | PSPs |
| --- | --- | --- | --- |
| Payouts | Every 30 days | Up to 60 days | From 7 days |
| Fees | As low as 3-6% | 30% | Average ~3% |
| Relationship with customers | Direct | Mediated by Apple | Direct |
| Payment handling and optimization |  |  |  |
| Global tax compliance and remittance |  |  |  |
| Fraud prevention and chargeback protection |  |  | Sometimes, for a fee |
| Buyer support for billing issues |  |  |  |
| Subscription billing |  |  | Sometimes, for a fee |
| Integration with RevenueCat for entitlements |  |  | Sometimes |
| Churn prevention and dunning workflows |  |  |  |
| Control over the checkout experience |  |  |  |
| Global and local payment methods |  |  | Sometimes, for a fee |
| Flexible discount and pricing options |  |  |  |


## Customer experience

[Customer experience](/concepts/sell/hosted-checkout-mobile-apps#journey)
1. Customer launches a checkoutYou can create a hosted checkout link in Paddle, then present users with a button to open a new browser window to pay using Paddle Checkout.For enhanced conversion, you can personalize hosted checkout links so they include your company or app name.

#### Customer launches a checkout

[Customer launches a checkout](/concepts/sell/hosted-checkout-mobile-apps#journey-step-1)

You can create a hosted checkout link in Paddle, then present users with a button to open a new browser window to pay using Paddle Checkout.


For enhanced conversion, you can personalize hosted checkout links so they include your company or app name.

1. Customer enters their detailsPaddle Checkout presents customers with a secure, optimized payment experience. It automatically calculates taxes and displays product information in a compliant way.Customers can pay using card, Apple Pay, Google Pay, PayPal, or other local payment methods.

#### Customer enters their details

[Customer enters their details](/concepts/sell/hosted-checkout-mobile-apps#journey-step-2)

Paddle Checkout presents customers with a secure, optimized payment experience. It automatically calculates taxes and displays product information in a compliant way.


Customers can pay using card, Apple Pay, Google Pay, PayPal, or other local payment methods.

1. Checkout completedPaddle routes every payment to the best acquirer for that sale to get the best possible chance of success.When payment is complete, customers are automatically redirected to a screen in your app that you specify.

#### Checkout completed

[Checkout completed](/concepts/sell/hosted-checkout-mobile-apps#journey-step-3)

Paddle routes every payment to the best acquirer for that sale to get the best possible chance of success.


When payment is complete, customers are automatically redirected to a screen in your app that you specify.

1. You fulfil the orderWhen users return to your app, you can immediately unlock the purchased content or features.Paddle integrates withRevenueCat for entitlements, or you can build a custom workflow usingwebhooks.

#### You fulfil the order

[You fulfil the order](/concepts/sell/hosted-checkout-mobile-apps#journey-step-4)

When users return to your app, you can immediately unlock the purchased content or features.


Paddle integrates withRevenueCat for entitlements, or you can build a custom workflow usingwebhooks.

[RevenueCat for entitlements](https://www.paddle.com/revenuecat-integration-beta)
[webhooks](/webhooks/overview)

## Next steps

[Next steps](/concepts/sell/hosted-checkout-mobile-apps#related-pages)
[Read more](/build/mobile-apps/overview)
[Read more](/concepts/customer-portal)
[Read more](/concepts/payment-methods/overview)
- Hosted checkout for mobile apps
[Hosted checkout for mobile apps](#hosted-checkout-for-mobile-apps)
- How it works
[How it works](#background)
- Customer experience
[Customer experience](#journey)
- Next steps
[Next steps](#related-pages)

---

*Last scraped: 2025-12-15 20:20:03*
