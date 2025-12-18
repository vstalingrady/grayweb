# Brand inline checkout

**Source:** https://developer.paddle.com/build/checkout/brand-customize-inline-checkout

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

# Brand inline checkout

[Brand inline checkout](/build/checkout/brand-customize-inline-checkout#brand-inline-checkout)

Use the Paddle dashboard to brand inline checkout so it fits seamlessly into your app.


Inline checkout comes with over 50 styling options to let you create a checkout experience that's fully integrated with your app.


You can change colors, borders, shadows, text, and other options directly from your Paddle dashboard — no engineering resource needed.


## How it works

[How it works](/build/checkout/brand-customize-inline-checkout#background)

### Attributes you can change

[Attributes you can change](/build/checkout/brand-customize-inline-checkout#background-changes)

You can change:

- Checkout frame padding
- Font
- Text colors and sizes
- Border colors and widths, and how rounded borders are
- Hover states for buttons and links
- Focus states for buttons and links
- Positioning of labels for text boxes
- Checkbox colors

You can also change styles related to the checkout footer message. This unobtrusive message lets customers know that Paddle is the merchant of record for the transaction.


### What good looks like

[What good looks like](/build/checkout/brand-customize-inline-checkout#background-compliance)

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


## Before you begin

[Before you begin](/build/checkout/brand-customize-inline-checkout#prerequisites)

You'll need toinclude Paddle.js on your pageand pass aclient-side token.

[include Paddle.js on your page](/paddlejs/include-paddlejs)
[client-side token](/paddlejs/client-side-tokens)

To open a checkout, you'll need tocreate products and pricesandpass them to a checkout.

[create products and prices](/build/products/create-products-prices)
[pass them to a checkout](/build/checkout/pass-update-checkout-items)
> To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout


To get a step-by-step overview of how to build a complete checkout, including passing checkout settings and prefilling properties, seeBuild an overlay checkoutorbuild an inline checkout

[Build an overlay checkout](/build/checkout/build-overlay-checkout)
[build an inline checkout](/build/checkout/build-branded-inline-checkout)

## Get started

[Get started](/build/checkout/brand-customize-inline-checkout#get-started)

Go toPaddle > Checkout > Branded inline checkoutto get started.


## General

[General](/build/checkout/brand-customize-inline-checkout#general)

### Font

[Font](/build/checkout/brand-customize-inline-checkout#font)

The default font isLato, a popular humanist font that fits into most designs. You can choose from a selection of system fonts instead.

[Lato](https://fonts.google.com/specimen/Lato)

If your chosen font can't be loaded on a customer device, Paddle falls back to Helvetica Neue, Helvetica, Arial, then the system default sans-serif.


### Focus state

[Focus state](/build/checkout/brand-customize-inline-checkout#focus-state)

The focus state colors determine the border and shadow color when a field is selected. For text boxes, this means a customer has clicked into the field to enter their information.


### Checkout padding

[Checkout padding](/build/checkout/brand-customize-inline-checkout#checkout-padding)

Checkout padding is on by default. Turn it off to let your checkout fill the full width of the frame, which may be useful if you have your own padding set on your website.


## Buttons

[Buttons](/build/checkout/brand-customize-inline-checkout#buttons)

Some buttons are shown as part of checkout, for example:

- Pay Now
- Subscribe Now
- Pay by Card
- Change Payment Method
- Continue
- Cancel

Buttons are either primary or secondary:

- The primary button is the main thing you want a customer to do, like "Pay Now" or "Continue".
- Secondary buttons are for other actions, like "Change Payment Method".

You can customize button size, text color, borders, and hover states using the options in the Button section.


We recommend that you make your primary button appear more prominent than your secondary button to guide customers through checkout.


## Inputs

[Inputs](/build/checkout/brand-customize-inline-checkout#inputs)

Inputs are fields where customers enter their details. This includes the labels (e.g. "Cardholder name") and input boxes themselves.


You can choose where labels appear relative to the field that they're describing, or turn them off altogether for a cleaner design. The placeholder fields in Paddle Checkout give customers an idea of what they should input in a field.

> For compatibility, labels always show at the top-left of input fields on mobile devices.


For compatibility, labels always show at the top-left of input fields on mobile devices.


## Links

[Links](/build/checkout/brand-customize-inline-checkout#links)

Some links are shown as part of checkout, for example:

- Add Coupon
- Add a VAT number

You can change the text size and color of these links. We recommend styling them so they stand out to against other text on your page.


## Messages

[Messages](/build/checkout/brand-customize-inline-checkout#messages)

Every checkout includes a message to let customers know that Paddle is the merchant of record for the transaction.


Checkout also shows a message to let customers know that a coupon was applied successfully.


You can change the font size, border colors, background colors, and how rounded the containers are.

> It's important that customers know who they're buying from. When customizing checkout, make sure the checkout footer message is visible and legible to remain legally compliant.


It's important that customers know who they're buying from. When customizing checkout, make sure the checkout footer message is visible and legible to remain legally compliant.


## Related pages

[Related pages](/build/checkout/brand-customize-inline-checkout#related-pages)
[Read more](/build/checkout/build-branded-inline-checkout)
[Read more](/build/checkout/prefill-checkout-properties)
- Brand inline checkout
[Brand inline checkout](#brand-inline-checkout)
- How it works
[How it works](#background)
- Attributes you can change
[Attributes you can change](#background-changes)
- What good looks like
[What good looks like](#background-compliance)
- Before you begin
[Before you begin](#prerequisites)
- Get started
[Get started](#get-started)
- General
[General](#general)
- Font
[Font](#font)
- Focus state
[Focus state](#focus-state)
- Checkout padding
[Checkout padding](#checkout-padding)
- Buttons
[Buttons](#buttons)
- Inputs
[Inputs](#inputs)
- Links
[Links](#links)
- Messages
[Messages](#messages)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:43*
