# Product and price reports

**Source:** https://developer.paddle.com/build/finance/reports/products-prices

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
- Report typesTransactionsTransaction line itemsAdjustmentsAdjustment line itemsProducts and pricesDiscountsPayout reconciliation
- Transactions
[Transactions](/build/finance/reports/transactions)
- Transaction line items
[Transaction line items](/build/finance/reports/transaction-line-items)
- Adjustments
[Adjustments](/build/finance/reports/adjustments)
- Adjustment line items
[Adjustment line items](/build/finance/reports/adjustment-line-items)
- Products and prices
[Products and prices](/build/finance/reports/products-prices)
- Discounts
[Discounts](/build/finance/reports/discounts)
- Payout reconciliation
[Payout reconciliation](/build/finance/reports/payout-reconciliation)
- Developer tools
- Use sandbox accounts
[Use sandbox accounts](/build/tools/sandbox)
- Connect Paddle and AI
[Connect Paddle and AI](/build/tools/mcp)

# Product and price reports

[Product and price reports](/build/finance/reports/products-prices#product-and-price-reports)

Generate detailed reports about your product catalog, including products and prices.


Productsandpricesform your product catalog. They're things that customers buy.

[Products](/api-reference/products/overview)
[prices](/api-reference/prices/overview)
> You cangenerate reportsthrough the dashboard or via the API.


You cangenerate reportsthrough the dashboard or via the API.

[generate reports](/build/finance/generate-reports)

## Report filters

[Report filters](/build/finance/reports/products-prices#report-filters)

When generating product and price reports, you can filter by:


| Field | Description |
| --- | --- |
| Product updated date | The date a product was last modified. Matches entities modified on or after the start date and before the end date. |
| Price updated date | The date a price was last modified. Matches entities modified on or after the start date and before the end date. |
| Product status | The status of the product or price.Active: Entity is active and can be used.Archived: Entity is archived, so can't be used. |
| Price status | The status of the product or price.Active: Entity is active and can be used.Archived: Entity is archived, so can't be used. |
| Price type | Kind of product or price.Custom: Non-catalog product or price. Typically created for a specific transaction or subscription. Not returned when listing products or prices or shown in the Paddle dashboard.Standard: Standard product or price. Can be considered part of your product catalog and reused across transactions and subscriptions easily. |
| Product type | Kind of product or price.Custom: Non-catalog product or price. Typically created for a specific transaction or subscription. Not returned when listing products or prices or shown in the Paddle dashboard.Standard: Standard product or price. Can be considered part of your product catalog and reused across transactions and subscriptions easily. |


The status of the product or price.

- Active: Entity is active and can be used.
- Archived: Entity is archived, so can't be used.

The status of the product or price.

- Active: Entity is active and can be used.
- Archived: Entity is archived, so can't be used.

Kind of product or price.

- Custom: Non-catalog product or price. Typically created for a specific transaction or subscription. Not returned when listing products or prices or shown in the Paddle dashboard.
- Standard: Standard product or price. Can be considered part of your product catalog and reused across transactions and subscriptions easily.

Kind of product or price.

- Custom: Non-catalog product or price. Typically created for a specific transaction or subscription. Not returned when listing products or prices or shown in the Paddle dashboard.
- Standard: Standard product or price. Can be considered part of your product catalog and reused across transactions and subscriptions easily.

## Report columns

[Report columns](/build/finance/reports/products-prices#report-columns)

Column headings on product and price reports mirror fields inthe Paddle API. Data is provided in the following columns:

[the Paddle API](/api-reference/overview)

Unique Paddle ID for this product, prefixed withpro_.


Status of this product.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Name of this product.


Short description for this product.


Tax category for this product. Used for charging the correct rate of tax. Selected tax category must be enabled on your Paddle account.


Image for this product. Included in the checkout and on some customer documents.


Reference or identifier for this entity from the solution where it was imported from.


Your own structured key-value data for this product.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


Unique Paddle ID for this product, prefixed withpro_.


Status of this product.


Type of item. Standard items are considered part of your catalog and are shown in the Paddle dashboard.


Name of this price, shown to customers at checkout and on invoices. Typically describes how often the related product bills.


Internal description for this price, not shown to customers. Typically notes for your team.


How tax is calculated for this price.


Base price. Amount in the lowest denomination for the currency, e.g. 10 USD = 1000 (cents).


Currency for the base price. Supported three-letter ISO 4217 currency code.


List of unit price overrides. Use to override the base price with a custom price and currency for a country or group of countries.


Minimum quantity of the product related to this price that can be bought. Required ifmaximumset.


Maximum quantity of the product related to this price that can be bought. Required ifminimumset. Must be greater than or equal to theminimumvalue.


Unit of time for how often this price should be charged.nullif price is non-recurring (one-time).


Amount of time for how often this price should be charged.nullif price is non-recurring (one-time).


Unit of time for the trial period for the product related to this price. The billing cycle begins once the trial period is over.nullfor no trial period.


Amount of time for the trial period for the product related to this price. The billing cycle begins once the trial period is over.nullfor no trial period.


Reference or identifier for this entity from the solution where it was imported from.


Your own structured key-value data for this price.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


## Related pages

[Related pages](/build/finance/reports/products-prices#related-pages)
[Read more](/build/finance/generate-reports)
[Read more](/api-reference/reports/overview)
[Read more](/api-reference/reports/create-report)
- Product and price reports
[Product and price reports](#product-and-price-reports)
- Report filters
[Report filters](#report-filters)
- Report columns
[Report columns](#report-columns)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:28*
