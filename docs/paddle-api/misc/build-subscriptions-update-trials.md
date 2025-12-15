# Work with trials

**Source:** https://developer.paddle.com/build/subscriptions/update-trials

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

# Work with trials

[Work with trials](/build/subscriptions/update-trials#work-with-trials)

Add or remove recurring items, change quantities, and bill for one-time charges for subscriptions in trial. You can also pause trialing subscriptions, too.


Trials let customers try your app or service before paying for it. You can update trialing subscriptions to make changes to what a customer is billed for when they transition to a paid plan. You can also bill one-time charges to a subscription for things like data import or setup fees.


We recommend letting customers make changes to a trialing subscription as part of a workflow where they confirm and activate their subscription.

> Change the next billing date against a trialing subscription to extend or cut short the trial period. You can also activate a trialing subscription right away using the API. To learn more, seeExtend or activate a trial


Change the next billing date against a trialing subscription to extend or cut short the trial period. You can also activate a trialing subscription right away using the API. To learn more, seeExtend or activate a trial

[Extend or activate a trial](/build/subscriptions/extend-activate-change-date-trials)

## How it works

[How it works](/build/subscriptions/update-trials#background)

Whencustomers complete checkoutfor recurring items with a trial period, or youissue an invoicefor items with a trial period, Paddle creates a subscription with the statustrialing.

[customers complete checkout](/build/checkout/pass-update-checkout-items)
[issue an invoice](/build/invoices/create-issue-invoices)

You can make changes to trialing subscriptions to pause, add or remove items, change quantities, and bill for one-time charges. This lets you handle:

- Upgrades or downgradesReplacing items on a subscription to let customers upgrade or downgrade their plan while they're in trial.

Upgrades or downgrades


Replacing items on a subscription to let customers upgrade or downgrade their plan while they're in trial.

- Adding, removing, or changing itemsAdd or remove additional modules, or update quantities for seats or users before going live.

Adding, removing, or changing items


Add or remove additional modules, or update quantities for seats or users before going live.

- Bill for one-time chargesCharge for things like data import or setup fees during a trial period.

Bill for one-time charges


Charge for things like data import or setup fees during a trial period.

- Pause at the end of the trial periodPreserve any work a customer did in your app in trial if they're not ready to go live right away.

Pause at the end of the trial period


Preserve any work a customer did in your app in trial if they're not ready to go live right away.


Since customers aren't yet paying,prorationdoesn't apply when making changes to a trialing subscription. You must usedo_not_billas theproration_billing_modewhen sending requests.

[proration](/concepts/subscriptions/proration)
> Only theitemsandnext_billed_atfields can be updated for a subscription in trial. You can't update other fields against a subscription until it's activated.


Only theitemsandnext_billed_atfields can be updated for a subscription in trial. You can't update other fields against a subscription until it's activated.


## Before you begin

[Before you begin](/build/subscriptions/update-trials#prerequisites)

### Get subscription ID

[Get subscription ID](/build/subscriptions/update-trials#prerequisites-get-id)

To make changes to items on a trialing subscription, you'll need toget the subscription IDfor the subscription you want to change.

[get the subscription ID](/api-reference/subscriptions/list-subscriptions)

You can use thestatusquery parameter when listing with the valuetrialingto get a list of subscriptions in trial.


### Extract existing prices

[Extract existing prices](/build/subscriptions/update-trials#prerequisites-extract-prices)

You'll need to extract existing items on a subscription. This is because when updating subscription items, Paddle expects the complete list of items that you want to be on the subscription — including existing items. If you don't include an existing item, it's removed from the subscription.


To learn more, seeWork with lists

[Work with lists](/api-reference/about/lists)

## Update items

[Update items](/build/subscriptions/update-trials#update-items)

Update items on a trialing subscription to make changes to what a customer is billed for when activated. Replace items on a subscription toupgrade or downgrade; oradd, remove, or change itemsto change how Paddle bills for recurring products like additional modules or seats.

[upgrade or downgrade](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[add, remove, or change items](/build/subscriptions/add-remove-products-prices-addons)

Update items on a trialing subscription using the API in three steps:

1. Build a requestCreate anitemslist that includes existing items and new items, withdo_not_billas the proration billing mode.

Build a request

[Build a request](/build/subscriptions/update-trials#build-request-update-items)

Create anitemslist that includes existing items and new items, withdo_not_billas the proration billing mode.

1. Preview your changesPreview charging for the subscription, including the regular amount the customer pays and any immediate charges. This is optional, but recommended — you should present charge information to a customer about what they'll pay when transition to paying.

Preview your changes

[Preview your changes](/build/subscriptions/update-trials#preview-update-items)

Preview charging for the subscription, including the regular amount the customer pays and any immediate charges. This is optional, but recommended — you should present charge information to a customer about what they'll pay when transition to paying.

1. Update the subscriptionSend the request to apply the changes you previewed. Paddle updates the subscription.

Update the subscription

[Update the subscription](/build/subscriptions/update-trials#patch-update-items)

Send the request to apply the changes you previewed. Paddle updates the subscription.


### Build request

[Build request](/build/subscriptions/update-trials#build-request-update-items)

Build a request that includes anitemsarray. Your array should include an object for each item, where each object contains a price ID and a quantity.


Include existing price IDs that you extractedin the previous step, as well as any new items that you want to add.

[in the previous step](/build/subscriptions/update-trials#prerequisites)

For examples and specific guidance, see

- Add or remove items from a subscription
[Add or remove items from a subscription](/build/subscriptions/add-remove-products-prices-addons)
- Upgrade or downgrade a subscription
[Upgrade or downgrade a subscription](/build/subscriptions/replace-products-prices-upgrade-downgrade)

List of items on this subscription. Only recurring items may be added. Send the complete list of items that should be on this subscription, including existing items that you'd like to keep.


Paddle ID for the price to add to this subscription, prefixed withpri_.


Quantity of this item to add to the subscription. If updating an existing item and not changing the quantity, you may omitquantity.


Along with youritemsarray, you must include theproration_billing_modefield to tell Paddle how to bill for the added items.

[proration_billing_mode](/concepts/subscriptions/proration)

The only allowed value when changing items against a trialing subscription isdo_not_bill.


How Paddle should handle proration calculation for changes made to a subscription or its items. Required when makingchanges that impact billing.


For automatically-collected subscriptions, responses may take longer than usual if a proration billing mode thatcollects for payment immediately is used.


### Preview change

[Preview change](/build/subscriptions/update-trials#preview-update-items)

To preview, send aPATCHrequest to the/subscriptions/{subscription_id}/previewendpoint with the request you built.


Paddle ID of the subscription entity to work with.


### Update subscription

[Update subscription](/build/subscriptions/update-trials#patch-update-items)

To update, send aPATCHrequest to the/subscriptions/{subscription_id}endpoint with the request you built.


Paddle ID of the subscription entity to work with.


## Bill for one-time charges

[Bill for one-time charges](/build/subscriptions/update-trials#bill-one-time-charges)

Bill a one-time charge to a trialing subscription for things like onboarding or setup fees.


Bill for one-time charges using the API in three steps:

1. Build a requestCreate anitemslist that includes the one-time charges you want to bill for, then choose when to bill for them.

Build a request

[Build a request](/build/subscriptions/update-trials#build-request-create-charge)

Create anitemslist that includes the one-time charges you want to bill for, then choose when to bill for them.

1. Preview one-time chargePreview charging for the one-time charge. This is optional, but recommended — you should present charge information to the customer.

Preview one-time charge

[Preview one-time charge](/build/subscriptions/update-trials#preview-create-charge)

Preview charging for the one-time charge. This is optional, but recommended — you should present charge information to the customer.

1. Create one-time chargeSend the request to create your one-time charge. Paddle creates a transaction now or in the future.

Create one-time charge

[Create one-time charge](/build/subscriptions/update-trials#post-create-charge)

Send the request to create your one-time charge. Paddle creates a transaction now or in the future.


### Build request

[Build request](/build/subscriptions/update-trials#build-request-create-charge)

Build a request that includes anitemsarray. Your array should include an object for each one-time charge you want to add, where each object contains a price ID and a quantity.


You don't need to include existing recurring items on the subscription.


For a complete overview with examples, seeBill for one-time charges

[Bill for one-time charges](/build/subscriptions/bill-add-one-time-charge)

List of one-time charges to add to this subscription. Only prices where thebilling_cycleisnullmay be added.


Paddle ID for the price to add to this subscription, prefixed withpri_.


Quantity of this item to add to the subscription. If updating an existing item and not changing the quantity, you may omitquantity.


Along with youritemsarray, includeeffective_fromto tell Paddle when to bill for any one-time charges.


You can use any allowed value for trialing subscriptions.


When one-time charges should be billed.


### Preview charge

[Preview charge](/build/subscriptions/update-trials#preview-create-charge)

To preview, send aPOSTrequest to the/subscriptions/{subscription_id}/charge/previewendpoint with the request you built.


Paddle ID of the subscription entity to work with.


### Create one-time charge

[Create one-time charge](/build/subscriptions/update-trials#post-create-charge)

To bill for one-time charges, send aPOSTrequest to the/subscriptions/{subscription_id}/chargeendpoint with the request you built.


Paddle ID of the subscription entity to work with.


## Pause at the end of the trial period

[Pause at the end of the trial period](/build/subscriptions/update-trials#pause-subscription)

Pause a trialing subscription at the end of the trial period to preserve any work a customer did in your app in trial if they're not ready to go live right away. Paddle bills for the subscription on resume.


To pause a subscription using the API, send aPOSTrequest to the/subscriptions/{subscription_id}/pauseendpoint.


Paddle ID of the subscription entity to work with.


To learn more, seePause a subscription

[Pause a subscription](/build/subscriptions/pause-subscriptions)

## Related pages

[Related pages](/build/subscriptions/update-trials#related-pages)
[Read more](/build/subscriptions/add-remove-products-prices-addons)
[Read more](/build/subscriptions/bill-add-one-time-charge)
[Read more](/build/subscriptions/extend-activate-change-date-trials)
- Work with trials
[Work with trials](#work-with-trials)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Get subscription ID
[Get subscription ID](#prerequisites-get-id)
- Extract existing prices
[Extract existing prices](#prerequisites-extract-prices)
- Update items
[Update items](#update-items)
- Build request
[Build request](#build-request-update-items)
- Preview change
[Preview change](#preview-update-items)
- Update subscription
[Update subscription](#patch-update-items)
- Bill for one-time charges
[Bill for one-time charges](#bill-one-time-charges)
- Build request
[Build request](#build-request-create-charge)
- Preview charge
[Preview charge](#preview-create-charge)
- Create one-time charge
[Create one-time charge](#post-create-charge)
- Pause at the end of the trial period
[Pause at the end of the trial period](#pause-subscription)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:17*
