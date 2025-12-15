# Upsell checkout

**Source:** https://developer.paddle.com/concepts/sell/upsell-checkout

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

Early access


# Upsell checkout

[Upsell checkout](/concepts/sell/upsell-checkout#upsell-checkout)

Upsell checkouts are designed to convert customers returning for immediate subsequent purchases. Present customers with a streamlined checkout experience using previous transaction details.


Upsell checkouts are optimized to minimize friction and maximize conversion rates by reusing details and consent acknowledgments from the preceding transaction.


Open an upsell checkout immediately after a transaction completes to encourage the purchase of additional items and expand your revenue.


### Reduce checkout friction


Cut cognitive load for customers by reducing the checkout footprint, helping them purchase quickly.


### Increase conversion rates


Boost your conversion with post-purchase flows designed for upsells, compliant out-of-the-box.


### One-click payment methods


Saved card, PayPal, Apple Pay, and Google Pay details are reused for a one-click payment experience.


## How it works

[How it works](/concepts/sell/upsell-checkout#background)

Upsell checkouts are typically used as part of a post-purchase flow, encouraging customers to buy additional items or add-ons after their initial transaction.


They work by taking customer, consent, andpayment method detailsfrom a previous transaction to show a streamlined checkout experience to customers.

[payment method details](/build/checkout/saved-payment-methods)

A single button is shown so customers can purchase any additional items in one-click.

> You must use one-page,inline checkoutsto present upsell checkouts.


You must use one-page,inline checkoutsto present upsell checkouts.

[inline checkouts](/concepts/sell/branded-integrated-inline-checkout)

## Customer journey

[Customer journey](/concepts/sell/upsell-checkout#background-journey)
1. Customer completes initial purchaseWhen making their initial purchase, customers enter their personal, billing, and business details.They may also check a box to consent tosaving their payment methodfor future purchases when completing payment.

#### Customer completes initial purchase

[Customer completes initial purchase](/concepts/sell/upsell-checkout#journey-details-initial-purchase)

When making their initial purchase, customers enter their personal, billing, and business details.


They may also check a box to consent tosaving their payment methodfor future purchases when completing payment.

[saving their payment method](/build/checkout/saved-payment-methods)
1. Customer opens an upsell checkoutAfter the initial transaction is complete, you open a new inline, one-page checkout for the upsell.Customers are presented with a one-click payment flow if the customer is authenticated, has saved payment methods, and the upsell occurs within thesame session.Their last used payment method is automatically selected.

#### Customer opens an upsell checkout

[Customer opens an upsell checkout](/concepts/sell/upsell-checkout#journey-details-upsell-purchase)

After the initial transaction is complete, you open a new inline, one-page checkout for the upsell.


Customers are presented with a one-click payment flow if the customer is authenticated, has saved payment methods, and the upsell occurs within thesame session.

[same session](/build/checkout/upsell-checkout#background-same-session)

Their last used payment method is automatically selected.

1. Customer skips the upsellOptionalCustomers can optionally click the "No thanks" button to skip the upsell and continue their journey.Youdecide what happens next. For example, you can show a popup window to confirm the customer wants to skip the upsell, or open a new checkout with an improved upsell offer.

#### Customer skips the upsellOptional

[Customer skips the upsellOptional](/concepts/sell/upsell-checkout#journey-details-customer-portal)

Customers can optionally click the "No thanks" button to skip the upsell and continue their journey.


Youdecide what happens next. For example, you can show a popup window to confirm the customer wants to skip the upsell, or open a new checkout with an improved upsell offer.

[decide what happens next](/build/checkout/upsell-checkout#handle-canceled-upsells)
1. Checkout completedCustomers can click to purchase instead. Paddle routes every payment to the best acquirer for that sale to get the best possible chance of success. Customers entera success workflow that you can build, and you could choose to open another upsell checkout as part of your flow.

#### Checkout completed

[Checkout completed](/concepts/sell/upsell-checkout#journey-details-customer-portal)

Customers can click to purchase instead. Paddle routes every payment to the best acquirer for that sale to get the best possible chance of success. Customers entera success workflow that you can build, and you could choose to open another upsell checkout as part of your flow.

[a success workflow that you can build](/build/checkout/handle-success-post-checkout)

## Next steps

[Next steps](/concepts/sell/upsell-checkout#related-pages)
[Read more](/build/checkout/upsell-checkout)
[Read more](/concepts/sell/branded-integrated-inline-checkout)
[Read more](/build/checkout/saved-payment-methods)
- Upsell checkout
[Upsell checkout](#upsell-checkout)
- How it works
[How it works](#background)
- Customer journey
[Customer journey](#background-journey)
- Next steps
[Next steps](#related-pages)

---

*Last scraped: 2025-12-15 20:19:32*
