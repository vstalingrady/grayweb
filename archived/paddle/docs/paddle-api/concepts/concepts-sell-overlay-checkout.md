# Overlay checkout

**Source:** https://developer.paddle.com/concepts/sell/overlay-checkout

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

# Overlay checkout

[Overlay checkout](/concepts/sell/overlay-checkout#overlay-checkout)

Overlay checkout is the quickest way to integrate Paddle with your website or app. Turn any element into a checkout link, letting Paddle handle the entire checkout process.


Integrate Paddle with a few lines of code using overlay checkout. Customers sign up and pay for subscriptions using an overlay.


Using overlay checkout, you can:

- Integrate Paddle quickly with a few lines of code.
- Choose whether to present a one-page or a multi-page checkout experience.
- Present an optimized checkout experience, where customers can sign up and pay without leaving your site.
- Create checkout links usingHTML data attributes— perfect for CMS-based sites.
[HTML data attributes](/paddlejs/html-data-attributes)
- UsePaddle.js eventsto build advanced checkout experiences.
[Paddle.js events](/paddlejs/events/overview)

## How it works

[How it works](/concepts/sell/overlay-checkout#background)

Overlay checkout works by showing an overlay with all the checkout details. You can turn any element on your page into a button that opens a checkout.


The overlay includes all checkout functionality including the items list, totals, and options for changing what's on the checkout.


Paddle automatically creates a subscription when a checkout completes,ready for you to provision.

[ready for you to provision](/build/subscriptions/provision-access-webhooks)

## Customer journey

[Customer journey](/concepts/sell/overlay-checkout#journey)
1. Customer launches overlay checkoutYou can turn any element on your page into a Paddle Checkout button,passing itemsor an existing transaction toPaddle.jsto say what the checkout is for.

#### Customer launches overlay checkout

[Customer launches overlay checkout](/concepts/sell/overlay-checkout#journey-eap-step-1)

You can turn any element on your page into a Paddle Checkout button,passing itemsor an existing transaction toPaddle.jsto say what the checkout is for.

[passing items](/build/checkout/pass-update-checkout-items)
[Paddle.js](/paddlejs/overview)
1. Customer enters their details on one screenOverlay checkout asks customers for their email,country, and (in some regions) ZIP or postal code. On the same screen, customers are presented with the card payment form, as well as options to pay with PayPal, Apple Pay, Google Pay, orother local payment method.

#### Customer enters their details on one screen

[Customer enters their details on one screen](/concepts/sell/overlay-checkout#journey-eap-step-2)

Overlay checkout asks customers for their email,country, and (in some regions) ZIP or postal code. On the same screen, customers are presented with the card payment form, as well as options to pay with PayPal, Apple Pay, Google Pay, orother local payment method.

[country](/concepts/sell/supported-countries-locales)
[other local payment method](/concepts/payment-methods/overview)
1. Checkout completedPaddle routes every payment to the best acquirer for that sale to get the best possible chance of success. Customers land ona success page that you can choose.

#### Checkout completed

[Checkout completed](/concepts/sell/overlay-checkout#journey-eap-step-3)

Paddle routes every payment to the best acquirer for that sale to get the best possible chance of success. Customers land ona success page that you can choose.

[a success page that you can choose](/build/checkout/handle-success-post-checkout)
1. Paddle creates a subscriptionPaddle automatically creates a subscription for the customer,ready for you to provision. The payment method the customer used is held on file for renewals or subscription changes.

#### Paddle creates a subscription

[Paddle creates a subscription](/concepts/sell/overlay-checkout#journey-step-4)

Paddle automatically creates a subscription for the customer,ready for you to provision. The payment method the customer used is held on file for renewals or subscription changes.

[ready for you to provision](/build/subscriptions/provision-access-webhooks)

## Next steps

[Next steps](/concepts/sell/overlay-checkout#next-steps)
[Read more](/build/checkout/build-overlay-checkout)
[Read more](/concepts/sell/branded-integrated-inline-checkout)
[Read more](/concepts/sell/sales-assisted-invoice)
- Overlay checkout
[Overlay checkout](#overlay-checkout)
- How it works
[How it works](#background)
- Customer journey
[Customer journey](#journey)
- Next steps
[Next steps](#next-steps)

---

*Last scraped: 2025-12-15 20:19:58*
