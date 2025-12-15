# Proration

**Source:** https://developer.paddle.com/concepts/subscriptions/proration

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

# Proration

[Proration](/concepts/subscriptions/proration#proration)

Choose how and when customers are charged when they upgrade or downgrade their subscription, or make other changes to items on it.


## How it works

[How it works](/concepts/subscriptions/proration#background)

Proration is how Paddle calculates what a customer should be billed for based on changes made in the current billing cycle.


For example, if a customer adds a product midway through their billing cycle, you can charge them for just the time they used rather than the entire period. If they replace a product, you can calculate the difference and charge them accurately.


You're in control of proration. When changing items on a subscription, you can choose:

- To prorate and bill now.
- To prorate and bill on the next billing date.
- Not to prorate, and to charge the full amount now.
- Not to prorate, and to charge the full amount on the next billing date.
- Not to bill at all.

Paddle's subscription billing engine calculates proration to the minute.


## Proration options

[Proration options](/concepts/subscriptions/proration#proration-options)

You can tell Paddle how you want to prorate when editing a subscription in the Paddle dashboard.


When updating items on a subscription using the API, include theproration_billing_modefield to tell Paddle how to handle proration. The options are:


| Value | Description |
| --- | --- |
| prorated_immediately | Prorated amount is calculated now. The customer is billed the prorated amount now. |
| full_immediately | Prorated amount isn't calculated. The customer is billed the full amount now. |
| prorated_next_billing_period | Prorated amount is calculated now. The customer is billed the prorated amount on their next renewal. |
| full_next_billing_period | Prorated amount isn't calculated. The customer is billed for the full amount on their next renewal. |
| do_not_bill | Prorated amount isn't calculated. The customer isn't billed for the prorated amount or the full amount. |

> Checkdetails.line_items.prorationagainsta transactionto see the rate of proration that Paddle used to calculate a total.


Checkdetails.line_items.prorationagainsta transactionto see the rate of proration that Paddle used to calculate a total.

[a transaction](/api-reference/transactions/overview)

## Related pages

[Related pages](/concepts/subscriptions/proration#related-pages)
[Read more](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[Read more](/build/subscriptions/add-remove-products-prices-addons)
[Read more](/build/subscriptions/change-billing-dates)
- Proration
[Proration](#proration)
- How it works
[How it works](#background)
- Proration options
[Proration options](#proration-options)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:55*
