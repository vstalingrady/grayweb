# Recover abandoned checkouts

**Source:** https://developer.paddle.com/build/checkout/checkout-recovery

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

# Recover abandoned checkouts

[Recover abandoned checkouts](/build/checkout/checkout-recovery#recover-abandoned-checkouts)

Checkouts that don't result in a purchase are considered abandoned. Recover these checkouts with automated emails and discounts to incentivize purchases and increase conversion rates.


Customers often start purchasing products and leave without completing the transaction. This is known as an incomplete or abandoned checkout.


Paddle tracks abandoned transactions and can automatically send emails to customers to incentivize them to return and finish their purchase. This helps you convert more sales and recapture lost revenue so you leave no money on the table.

> Checkout recovery is enabled by default if it's enabled in Paddle Classic or if you joined Paddle after May 2, 2025. If you signed up for Paddle before this date, you need to manually turn it on.


Checkout recovery is enabled by default if it's enabled in Paddle Classic or if you joined Paddle after May 2, 2025. If you signed up for Paddle before this date, you need to manually turn it on.


## How it works

[How it works](/build/checkout/checkout-recovery#background)

When a customer opens a checkout, Paddle creates atransaction. If a customer doesn't make a purchase, the transaction is considered abandoned.

[transaction](/api-reference/transactions/overview)

Customers can enter their email address during the checkout flow. If they do, Paddle uses this address to send arecovery email60 minutes after the transaction was created. Only one email is sent per transaction.

[recovery email](/concepts/sell/checkout-recovery)

Emails contain predefined content which our team have optimized to best encourage customers to return. When a customer clicks the link in the email and completes the checkout, the transaction is considered recovered.


### Discounts

[Discounts](/build/checkout/checkout-recovery#background-discounts)

Discountslet you reduce the amount a customer pays when purchasing. As part of checkout recovery, you can offer a one-time, percentage-based discount to encourage customers to complete their abandoned transactions.

[Discounts](/api-reference/discounts/overview)

These discounts apply to the full value of the transaction and are only tied to the transaction being recovered. This means customers can't apply the discount to other checkouts and transactions.


We recommend offering a 10-20% discount as testing has found this range to be most effective.


If you choose to offer a discount, Paddle includes it in all checkout recovery emails. When customers click the link in the email, the checkout opens with the discount automatically applied.


Paddle doesn't send discounts to customers who:

- Have already applied a discountIf a discount was already applied during the original checkout, the recovery discount isn't included in the email.

Have already applied a discount


If a discount was already applied during the original checkout, the recovery discount isn't included in the email.

- Haven't agreed to Paddle's marketing consentCustomers must agree to receive marketing emails from Paddle to receive a recovery discount.

Haven't agreed to Paddle's marketing consent


Customers must agree to receive marketing emails from Paddle to receive a recovery discount.


If these conditions aren't met, customers still receive emails but without the discount offer.

> Discounts can't be stacked. If a customer adds a different discount to the checkout, it replaces the recovery discount.


Discounts can't be stacked. If a customer adds a different discount to the checkout, it replaces the recovery discount.


You can update the value of the discount value through the dashboard whenconfiguring checkout recovery. This can't be updated through the API.

[configuring checkout recovery](/build/checkout/checkout-recovery#configure-checkout-recovery)

### Migration from Paddle Classic

[Migration from Paddle Classic](/build/checkout/checkout-recovery#background-migration)

If you'remigrating from Paddle Classic to Paddle Billing, checkout recovery is automatically configured based on your existing Paddle Classic setup, including any discounts you've already configured.

[migrating from Paddle Classic to Paddle Billing](/migrate/overview)

Unlike Paddle Classic, Paddle Billing doesn't charge an additional fee for recovered transactions.


## Before you begin

[Before you begin](/build/checkout/checkout-recovery#prerequisites)

### Set up a checkout

[Set up a checkout](/build/checkout/checkout-recovery#prerequisites-checkout)

Paddle only sends emails to recoverautomatically-collected transactionscreated by a checkout. You need to set up either anoverlay checkoutor aninline checkout.

[automatically-collected transactions](/build/transactions/change-collection-mode-transaction)
[overlay checkout](/build/checkout/build-overlay-checkout)
[inline checkout](/build/checkout/build-branded-inline-checkout)
> You don't need to create a discount to offer one. The discount you add when configuring checkout recovery is automatically created and separate from your existing discounts.


You don't need to create a discount to offer one. The discount you add when configuring checkout recovery is automatically created and separate from your existing discounts.


## Configure checkout recovery

[Configure checkout recovery](/build/checkout/checkout-recovery#configure-checkout-recovery)
1. Go toPaddle > Checkout > Checkout Settings.

Go toPaddle > Checkout > Checkout Settings.

1. Click theRecoverytab.

Click theRecoverytab.

1. Toggle theCheckout recoveryslider on if it isn't already.

Toggle theCheckout recoveryslider on if it isn't already.

1. To offer a discount, toggle theApply a discountslider on and enter the percentage amount in the field.

To offer a discount, toggle theApply a discountslider on and enter the percentage amount in the field.

1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Preview an email

[Preview an email](/build/checkout/checkout-recovery#preview-email)

After you'veenabled checkout recovery, you can preview the email that Paddle sends to customers who abandon their checkout.

[enabled checkout recovery](/build/checkout/checkout-recovery#configure-checkout-recovery)
1. Go toPaddle > Checkout > Checkout Settings.

Go toPaddle > Checkout > Checkout Settings.

1. Click theRecoverytab.

Click theRecoverytab.

1. ClickPreview email

ClickPreview email

> Configuring a discountchanges the email that Paddle sends to customers.


Configuring a discountchanges the email that Paddle sends to customers.

[Configuring a discount](/build/checkout/checkout-recovery#background-discounts)

## Related pages

[Related pages](/build/checkout/checkout-recovery#related-pages)
[Read more](/build/checkout/build-overlay-checkout)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/build/products/offer-discounts-promotions-coupons)
- Recover abandoned checkouts
[Recover abandoned checkouts](#recover-abandoned-checkouts)
- How it works
[How it works](#background)
- Discounts
[Discounts](#background-discounts)
- Migration from Paddle Classic
[Migration from Paddle Classic](#background-migration)
- Before you begin
[Before you begin](#prerequisites)
- Set up a checkout
[Set up a checkout](#prerequisites-checkout)
- Configure checkout recovery
[Configure checkout recovery](#configure-checkout-recovery)
- Preview an email
[Preview an email](#preview-email)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:11*
