# Work with custom subdomains

**Source:** https://developer.paddle.com/build/checkout/custom-subdomains

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

Early access


# Work with custom subdomains

[Work with custom subdomains](/build/checkout/custom-subdomains#work-with-custom-subdomains)

Personalize hosted checkout links using custom subdomains to build customer confidence and improve conversion.


Custom subdomains help bridge the gap between your app and the checkout flow by putting your company or app name in the hosted checkout link, reducing cart abandonment and building the confidence customers need to complete their purchase.


## How it works

[How it works](/build/checkout/custom-subdomains#background)

You can usehosted checkoutsto let users securely make purchases outside your app — no hosting required. Customers tap a button in your app to open a checkout that's fully hosted by Paddle, then they're redirected to your app when they complete their purchase.

[hosted checkouts](/concepts/sell/hosted-checkout-mobile-apps)

By default, hosted checkouts are hosted atpay.paddle.io. For a more branded experience, you can add a custom subdomain to your account and use it for hosted checkout. For example, your hosted checkout can be hosted ataeroedit.paddle.io/pay. This helps to build customer confidence, improving conversion.


Custom subdomains for sandbox accounts are separate, and follow the formataeroedit.sandbox.paddle.io, whereaeroeditis your custom subdomain. Custom subdomains on sandbox don't require approval.


Once you add a custom subdomain, you can set it as the default. Your default custom subdomain is used for new hosted checkouts. You can use any custom subdomain for hosted checkouts, not just your default.


You can add up to 10 custom subdomains. To keep the Paddle platform safe for everyone, custom subdomains have to be approved by Paddle before you can use them. You'll get an email from the Paddle team to let you know when your subdomain has been approved.

> Custom subdomains are available in early access for sandbox accounts. To get access to custom subdomains on your live account ahead of general release, join our early access program. Fill out the form to join the waitlist and we'll reach out when space is available.Join the waitlist


Custom subdomains are available in early access for sandbox accounts. To get access to custom subdomains on your live account ahead of general release, join our early access program. Fill out the form to join the waitlist and we'll reach out when space is available.

[Join the waitlist](https://paddlecom.typeform.com/to/gwzUamWO)

## Add a custom subdomain

[Add a custom subdomain](/build/checkout/custom-subdomains#add-custom-subdomain)
1. Go toPaddle > Checkout > Custom subdomains.

Go toPaddle > Checkout > Custom subdomains.

1. ClickNew custom subdomain

ClickNew custom subdomain

1. Enter a descriptive name and an optional description to help you identify this custom subdomain. These aren't shown to customers.

Enter a descriptive name and an optional description to help you identify this custom subdomain. These aren't shown to customers.

1. Enter the subdomain you want to use in theSubdomainfield. This is the part that goes beforepaddle.io. For example, enteraeroeditto useaeroedit.paddle.io.

Enter the subdomain you want to use in theSubdomainfield. This is the part that goes beforepaddle.io. For example, enteraeroeditto useaeroedit.paddle.io.

1. ClickSavewhen you're done.

ClickSavewhen you're done.

1. Wait for an email from Paddle to say that your custom subdomain has been approved.

Wait for an email from Paddle to say that your custom subdomain has been approved.


## Set a custom subdomain as default

[Set a custom subdomain as default](/build/checkout/custom-subdomains#default-custom-subdomain)

Your default custom subdomain is used for new hosted checkouts that you create.

1. Go toPaddle > Checkout > Custom subdomains.

Go toPaddle > Checkout > Custom subdomains.

1. Find the subdomain you want to be the default in the list, then click theoverflow buttonaction menu and chooseSet as default

Find the subdomain you want to be the default in the list, then click theoverflow buttonaction menu and chooseSet as default


## Use a custom subdomain for a hosted checkout

[Use a custom subdomain for a hosted checkout](/build/checkout/custom-subdomains#custom-subdomain-hosted-checkout)

To use your custom subdomain for a hosted checkout, copy a link using your default custom subdomain or copy the Paddle URL and swappay.paddle.iowith your custom subdomain.


### Use your default custom subdomain

[Use your default custom subdomain](/build/checkout/custom-subdomains#default-custom-subdomain-hosted-checkout)
1. Go toPaddle > Checkout > Hosted checkouts.

Go toPaddle > Checkout > Hosted checkouts.

1. Find the hosted checkout you want to use with a custom domain, then click theoverflow buttonbutton.

Find the hosted checkout you want to use with a custom domain, then click theoverflow buttonbutton.

1. ChooseCopy custom URLto get a hosted checkout link that uses your default custom subdomain.

ChooseCopy custom URLto get a hosted checkout link that uses your default custom subdomain.


### Use another custom subdomain

[Use another custom subdomain](/build/checkout/custom-subdomains#different-custom-subdomain-hosted-checkout)
1. Go toPaddle > Checkout > Hosted checkouts.

Go toPaddle > Checkout > Hosted checkouts.

1. Find the hosted checkout you want to use with a custom domain, then click theoverflow buttonbutton.

Find the hosted checkout you want to use with a custom domain, then click theoverflow buttonbutton.

1. ChooseCopy Paddle URLto get a hosted checkout link that usespay.paddle.ioorsandbox.pay.paddle.io.

ChooseCopy Paddle URLto get a hosted checkout link that usespay.paddle.ioorsandbox.pay.paddle.io.

1. Paste the URL somewhere and replacepaywith the custom subdomain you want to use and add/payto the path. For example, replacepaywithaeroeditinpay.paddle.ioif your subdomain isaeroedit.

Paste the URL somewhere and replacepaywith the custom subdomain you want to use and add/payto the path. For example, replacepaywithaeroeditinpay.paddle.ioif your subdomain isaeroedit.


Your complete URL should look something like this:


```undefined
11https://aeroedit.paddle.io/pay/hsc_01jt8s46kx4nv91002z7vy4ecj_1as3scas9cascascasasx23dsa3asd2a
```


## Related pages

[Related pages](/build/checkout/custom-subdomains#related-pages)
[Read more](/build/mobile-apps/link-out-mobile-app-hosted-checkout-app)
[Read more](/concepts/sell/hosted-checkout-mobile-apps)
- Work with custom subdomains
[Work with custom subdomains](#work-with-custom-subdomains)
- How it works
[How it works](#background)
- Add a custom subdomain
[Add a custom subdomain](#add-custom-subdomain)
- Set a custom subdomain as default
[Set a custom subdomain as default](#default-custom-subdomain)
- Use a custom subdomain for a hosted checkout
[Use a custom subdomain for a hosted checkout](#custom-subdomain-hosted-checkout)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:01*
