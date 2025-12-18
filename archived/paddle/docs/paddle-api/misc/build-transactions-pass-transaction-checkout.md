# Pass a transaction to a checkout

**Source:** https://developer.paddle.com/build/transactions/pass-transaction-checkout

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

# Pass a transaction to a checkout

[Pass a transaction to a checkout](/build/transactions/pass-transaction-checkout#pass-a-transaction-to-a-checkout)

Pass an existing transaction to Paddle.js to open a checkout to collect for it. You can do this for automatically and manually-collected transactions.


Transactionshold all the information about a customer purchase, including customer details, items, calculated tax and localized pricing, and payments.

[Transactions](/api-reference/transactions/overview)

Paddle creates transactions automatically when checkouts are opened, but you can alsocreate your own transactionsand pass them to a checkout.

[create your own transactions](/build/transactions/create-transaction)

## How it works

[How it works](/build/transactions/pass-transaction-checkout#background)

All purchases are transactions. You can work with transactions using Paddle.js in two ways:


#### Pass items

[Pass items](/build/transactions/pass-transaction-checkout#pass-items)

When you open a checkout,Paddle.jsautomatically creates a transaction for you.

[Paddle.js](/paddlejs/overview)
1. Pass items to Paddle.js usingHTML data attributesorPaddle.Checkout.open().

Pass items to Paddle.js usingHTML data attributesorPaddle.Checkout.open().

[HTML data attributes](/paddlejs/html-data-attributes)
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
1. Paddle.js automatically creates a transaction for the items passed.

Paddle.js automatically creates a transaction for the items passed.

1. Customers pay usingPaddle Checkout.

Customers pay usingPaddle Checkout.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

This is a typical self-service workflow, where customers sign up and pay using your website.


To learn more, seePass or update checkout items

[Pass or update checkout items](/build/checkout/pass-update-checkout-items)

#### Pass transactions

[Pass transactions](/build/transactions/pass-transaction-checkout#pass-transactions)

You can alsocreate a transaction manually using the API, then pass this to Paddle.js.

[create a transaction manually using the API](/build/transactions/create-transaction)
1. You create a transaction using the API or the Paddle dashboard.

You create a transaction using the API or the Paddle dashboard.

1. Pass transaction to Paddle.js usingHTML data attributesorPaddle.Checkout.open().

Pass transaction to Paddle.js usingHTML data attributesorPaddle.Checkout.open().

[HTML data attributes](/paddlejs/html-data-attributes)
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
1. Customers pay usingPaddle Checkout.

Customers pay usingPaddle Checkout.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

This is more typical when working with sales-assisted customers who want to pay an invoice by card.


You can pass automatically-collected transactions and manually-collected transactions wherebilling_details.enable_checkoutistrueto a checkout.


## Before you begin

[Before you begin](/build/transactions/pass-transaction-checkout#prerequisites)

To pass a transaction to a checkout, you'll need to firstcreate a transaction using the API.

[create a transaction using the API](/build/transactions/create-transaction)

You'll also need tobuild an inlineoroverlay checkoutto pass a transaction to.

[build an inline](/build/checkout/build-branded-inline-checkout)
[overlay checkout](/build/checkout/build-overlay-checkout)

If you haven't already, you'll need to:

- Adda default payment linkto your checkout underPaddle > Checkout > Checkout settings > Default payment link.
[a default payment link](/build/transactions/default-payment-link)
- Get your default payment link domain approved if you're working with the live environment.
[Learn more about website approval on the Paddle help center.](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)

Learn more about website approval on the Paddle help center.


## Use checkout payment link

[Use checkout payment link](/build/transactions/pass-transaction-checkout#default-url)

The simplest way to pass a transaction to a checkout is to usea checkout payment link.

[a checkout payment link](/build/transactions/default-payment-link)

Automatically-collected transactions, and manually-collected transactions wherebilling_details.enable_checkoutistrue, include acheckout.url. This is made up of your default payment link, with a_ptxnquery parameter and the transaction ID appended.


Provided your default checkout link pageincludes Paddle.js, it automatically opens a checkout for the transaction passed in the URL. The opened checkoutinherits settings fromcheckout.settingsinPaddle.Initialize().

[includes Paddle.js](/paddlejs/include-paddlejs)
[inherits settings fromcheckout.settingsinPaddle.Initialize()](/build/checkout/set-up-checkout-default-settings)

You can:

- SetallowLogouttofalsetoprevent customers from changing their details
[prevent customers from changing their details](/build/checkout/set-up-checkout-default-settings#allow-logout)
- Mark a transaction asbilledtostop customers from editing items on it
[stop customers from editing items on it](/build/checkout/pass-update-checkout-items#prevent-changes-to-items-on-a-checkout)
> Pass an approved domain ascheckout.urlwhen creating or updating a transaction to override the domain that Paddle uses to generate your checkout payment link.


Pass an approved domain ascheckout.urlwhen creating or updating a transaction to override the domain that Paddle uses to generate your checkout payment link.


## Pass a transaction to Paddle.js

[Pass a transaction to Paddle.js](/build/transactions/pass-transaction-checkout#pass-transaction)

When building pages withPaddle.js, you can pass a transaction ID to a checkout usingHTML data attributesor when you callPaddle.Checkout.open().

[Paddle.js](/paddlejs/overview)
[HTML data attributes](/paddlejs/html-data-attributes)
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

You should do this instead of passing an array ofitems.


Adddata-transaction-idas an attribute to your checkout launcher to open a checkout for the passed transaction.


```html
1234567891<a href="#" 
2  class="paddle_button"
3  data-display-mode="overlay"
4  data-theme="light"
5  data-locale="en"
6  data-transaction-id="txn_01h0j589qt1nee24210teqtz57"
7>
8	Buy now
9</a>
```


## Related pages

[Related pages](/build/transactions/pass-transaction-checkout#related-pages)
[Read more](/build/transactions/default-payment-link)
[Read more](/build/transactions/create-transaction)
[Read more](/build/invoices/create-issue-invoices)
- Pass a transaction to a checkout
[Pass a transaction to a checkout](#pass-a-transaction-to-a-checkout)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Use checkout payment link
[Use checkout payment link](#default-url)
- Pass a transaction to Paddle.js
[Pass a transaction to Paddle.js](#pass-transaction)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:06*
