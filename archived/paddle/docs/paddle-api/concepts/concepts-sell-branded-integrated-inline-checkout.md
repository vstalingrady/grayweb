# Inline checkout

**Source:** https://developer.paddle.com/concepts/sell/branded-integrated-inline-checkout

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

# Inline checkout

[Inline checkout](/concepts/sell/branded-integrated-inline-checkout#inline-checkout)

Inline checkout lets you create integrated checkout experiences. You display information about items and totals, letting Paddle take care of capturing customer and payment details.


Build integrated checkout experiences with inline checkout. Customers sign up and pay for subscriptions as part of your app or website, making for a seamless experience.


Using inline checkout, you can:

- Create checkout experiences that are fully integrated with your app or website.
- Choose whether to present a one-page or a multi-page checkout experience.
- Let Paddle securely capture customer and payment information in an optimized checkout frame.
- Display items, totals, and other information from Paddle on your page.
- UsePaddle.js methodsandeventsto build advanced checkout experiences.
[Paddle.js methods](/paddlejs/methods/paddle-initialize)
[events](/paddlejs/events/overview)

## How it works

[How it works](/concepts/sell/branded-integrated-inline-checkout#background)

Inline checkout works by embedding a frame with Paddle Checkout into your website or app.


The checkout frame handles collecting customer information and capturing payment details. Your page displays the items list, totals, and options for changing what's on the checkout.Paddle.jslets your page and the checkout frame interact with each other.

[Paddle.js](/paddlejs/overview)

Paddle automatically creates a subscription when a checkout completes,ready for you to provision.

[ready for you to provision](/build/subscriptions/provision-access-webhooks)

It's important that customers know who they're buying from, what they're buying, and how much they're paying.


To build an inline checkout that's compliant and optimized for conversion, your implementation must include:

1. If recurring, how often it recurs and the total to pay on renewal. If a trial, how long the trial lasts.

If recurring, how often it recurs and the total to pay on renewal. If a trial, how long the trial lasts.

1. A description of what's being purchased.

A description of what's being purchased.

1. Transaction totals, including subtotal, total tax, and grand total. Be sure to include the currency too.

Transaction totals, including subtotal, total tax, and grand total. Be sure to include the currency too.

1. The full inline checkout frame, including the checkout footer that has information about Paddle, our terms of sale, and our privacy policy.

The full inline checkout frame, including the checkout footer that has information about Paddle, our terms of sale, and our privacy policy.

1. A link to your refund policy, if it differs from the Paddle.com standard refund policy.

A link to your refund policy, if it differs from the Paddle.com standard refund policy.


## Customer journey

[Customer journey](/concepts/sell/branded-integrated-inline-checkout#journey)
1. Customer opens a checkoutYou can open inline checkout bypassing itemsor an existing transaction. UsePaddle.jsto show and update on-page information, andPaddle.js methodsto update items based on customer interaction.

#### Customer opens a checkout

[Customer opens a checkout](/concepts/sell/branded-integrated-inline-checkout#journey-eap-step-1)

You can open inline checkout bypassing itemsor an existing transaction. UsePaddle.jsto show and update on-page information, andPaddle.js methodsto update items based on customer interaction.

[passing items](/build/checkout/pass-update-checkout-items)
[Paddle.js](/paddlejs/events/overview)
[Paddle.js methods](/paddlejs/methods/paddle-checkout-updateitems)
1. Customer enters their details on one screenInline checkout asks customers for their email,country, and (in some regions) ZIP or postal code. On the same screen, customers are presented with the card payment form, as well as options to pay with PayPal, Apple Pay, Google Pay, orother local payment method.You canprefill customer detailsand present saved payment methods to speed up checkout.

#### Customer enters their details on one screen

[Customer enters their details on one screen](/concepts/sell/branded-integrated-inline-checkout#journey-eap-step-2)

Inline checkout asks customers for their email,country, and (in some regions) ZIP or postal code. On the same screen, customers are presented with the card payment form, as well as options to pay with PayPal, Apple Pay, Google Pay, orother local payment method.

[country](/concepts/sell/supported-countries-locales)
[other local payment method](/concepts/payment-methods/overview)

You canprefill customer detailsand present saved payment methods to speed up checkout.

[prefill customer details](/build/checkout/prefill-checkout-properties)
1. Checkout completedPaddle routes every payment to the best acquirer for that sale to get the best possible chance of success. Customers entera success workflow that you can build.

#### Checkout completed

[Checkout completed](/concepts/sell/branded-integrated-inline-checkout#journey-step-4)

Paddle routes every payment to the best acquirer for that sale to get the best possible chance of success. Customers entera success workflow that you can build.

[a success workflow that you can build](/build/checkout/handle-success-post-checkout)
1. Paddle creates a subscriptionPaddle automatically creates a subscription for the customer,ready for you to provision. The payment method the customer used is held on file for renewals or subscription changes.

#### Paddle creates a subscription

[Paddle creates a subscription](/concepts/sell/branded-integrated-inline-checkout#journey-step-5)

Paddle automatically creates a subscription for the customer,ready for you to provision. The payment method the customer used is held on file for renewals or subscription changes.

[ready for you to provision](/build/subscriptions/provision-access-webhooks)

## Next steps

[Next steps](/concepts/sell/branded-integrated-inline-checkout#next-steps)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/concepts/sell/overlay-checkout)
[Read more](/concepts/sell/sales-assisted-invoice)
- Inline checkout
[Inline checkout](#inline-checkout)
- How it works
[How it works](#background)
- Customer journey
[Customer journey](#journey)
- Next steps
[Next steps](#next-steps)

---

*Last scraped: 2025-12-15 20:19:57*
