# Trials

**Source:** https://developer.paddle.com/concepts/subscriptions/trials

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

# Trials

[Trials](/concepts/subscriptions/trials#trials)

Offer trials for subscriptions to lower barriers to entry and increase conversion. Choose whether to require payment details at sign up or not, depending on your business strategy.


Trials are a powerful way to let customers try before they buy, giving you a chance to demonstrate your product's value before paying. They also give you a source of high-intent leads, with the option to require payment details to capture more serious leads.


Paddle gives you full control over the trial experience and lifecycle, with comprehensive management available using the API, SDKs, and dashboard.


### Increase conversion rates


Let customers experience value before committing, reducing initial barriers to purchase.


### Qualify high-intent leads


Optionally capture payment details to qualify customers and convert more predictably.


### Full lifecycle control


Extend, activate early, and make changes during trials to match your billing strategy.


### Global compliance


Paddle Checkout presents customers with compliant trial workflows based on customer jurisdiction.


### Multiple trial types


Choose between card-required and cardless trials to match your conversion strategy.


### Fewer tickets


Reduce the number of billing-related requests by letting customers try before they buy.


## How it works

[How it works](/concepts/subscriptions/trials#background)

Trials are a version of your app that customers can access for free for a limited time. They might also include other limitations, like offering a subset of features or a limited number of users. They're typically used for subscriptions, but you might use them for one-time apps too.


By showing a potential customer that your product fits their needs, trials create trust in your offering and reduce reluctance to pay, boosting your conversion rate in the process. They also increase customer satisfaction, since customers are more likely to be happy with a product they've tried and found to be a good fit for their needs.


### Trial types

[Trial types](/concepts/subscriptions/trials#trial-types)

Flexible trial types let you optimize conversion across different customer segments. Some customers prefer to try before providing payment details, while others are ready to commit upfront.


In Paddle, there are two kinds of trial:


#### Card-required trials

[Card-required trials](/concepts/subscriptions/trials#card-required-trials)

Customers must enter payment details at signup, but aren't charged until the trial ends.


Works well for:Qualifying higher-intent leads and enabling automatic conversion.


Keep in mind:You'll typically see a lower signup rate as customers may be hesitant to enter payment details.


Integration process:Use Paddle Checkout to capture payment details and create a subscription.


#### Cardless trialsDeveloper preview

[Cardless trialsDeveloper preview](/concepts/subscriptions/trials#cardless-trials-)

Customers can start their trial immediately without entering a credit card.


Works well for:Removing the biggest barrier to trial signup, getting more leads in the door.


Keep in mind:You'll typically see a lower conversion rate since customers haven't committed to paying yet.


Integration process:Use the API to create a transaction for a subscription with a trial period, then use Paddle Checkout to capture payment details later.

> "Card-required" and "cardless" are commonly used terms for these trial types in the SaaS and app space, but customers aren't limited to cards. They can use digital wallets or local payment options for subscriptions, too.


"Card-required" and "cardless" are commonly used terms for these trial types in the SaaS and app space, but customers aren't limited to cards. They can use digital wallets or local payment options for subscriptions, too.


### Trial lifecycle

[Trial lifecycle](/concepts/subscriptions/trials#lifecycle)

You have complete control over the trial lifecycle in Paddle. You can:

- Let customers upgrade or downgradeduring trials to match their needs.
- Extend trialsto give customers more time to experience value.
- Activate earlyto realize value from customers when they're ready to pay.
- Add one-time chargesduring trials and bill them at the end of the trial period.

Webhooksoccur throughout the trial lifecycle, so you can keep your app in sync with Paddle.

[Webhooks](/webhooks/overview)

## Customer journey

[Customer journey](/concepts/subscriptions/trials#journey)
1. Customers sign up and enter payment detailsPass items with a trial period to Paddle.js to open a checkout for them. Customers securely enter payment details and start their trial.Paddle Checkout handles compliance for you, making sure that the signup workflow is compliant with card network rules and evolving international legislation around trials.

#### Customers sign up and enter payment details

[Customers sign up and enter payment details](/concepts/subscriptions/trials#customers-sign-up-and-enter-payment-details)

Pass items with a trial period to Paddle.js to open a checkout for them. Customers securely enter payment details and start their trial.


Paddle Checkout handles compliance for you, making sure that the signup workflow is compliant with card network rules and evolving international legislation around trials.

1. Paddle automatically creates a subscriptionPaddle automatically creates a subscription for the customer when the checkout transaction is completed,ready for you to provision.The payment method the customer used is held on file for renewals or subscription changes.

#### Paddle automatically creates a subscription

[Paddle automatically creates a subscription](/concepts/subscriptions/trials#paddle-automatically-creates-a-subscription)

Paddle automatically creates a subscription for the customer when the checkout transaction is completed,ready for you to provision.

[ready for you to provision](/build/subscriptions/provision-access-webhooks)

The payment method the customer used is held on file for renewals or subscription changes.

1. Paddle sends an email about the trial endingWhen the trial period is getting close to ending, Paddle sends an email to the customer to remind them that the trial is ending.The email includes a link to the customer portal, where customers can manage their payment method.

#### Paddle sends an email about the trial ending

[Paddle sends an email about the trial ending](/concepts/subscriptions/trials#paddle-sends-an-email-about-the-trial-ending)

When the trial period is getting close to ending, Paddle sends an email to the customer to remind them that the trial is ending.


The email includes a link to the customer portal, where customers can manage their payment method.

1. Customer converts to payingWhen the trial period ends, Paddle automatically charges the payment method on file and transitions the subscription toactivestatus.

#### Customer converts to paying

[Customer converts to paying](/concepts/subscriptions/trials#customer-converts-to-paying)

When the trial period ends, Paddle automatically charges the payment method on file and transitions the subscription toactivestatus.


## Next steps

[Next steps](/concepts/subscriptions/trials#related-pages)
[Read more](/concepts/sell/self-serve-checkout)
[Read more](/build/subscriptions/update-trials)
[Read more](/build/subscriptions/cardless-trials)
- Trials
[Trials](#trials)
- How it works
[How it works](#background)
- Trial types
[Trial types](#trial-types)
- Trial lifecycle
[Trial lifecycle](#lifecycle)
- Customer journey
[Customer journey](#journey)
- Next steps
[Next steps](#related-pages)

---

*Last scraped: 2025-12-15 20:20:02*
