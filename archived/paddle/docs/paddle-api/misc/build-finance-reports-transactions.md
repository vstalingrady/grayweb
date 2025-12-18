# Transaction reports

**Source:** https://developer.paddle.com/build/finance/reports/transactions

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

# Transaction reports

[Transaction reports](/build/finance/reports/transactions#transaction-reports)

Generate detailed reports about revenue received, past due invoices, draft and issued invoices, and canceled transactions.


Transactionscapture and calculate revenue for both checkouts and invoices. They hold information about a customer purchase.

[Transactions](/api-reference/transactions/overview)
> You cangenerate reportsthrough the dashboard or via the API.


You cangenerate reportsthrough the dashboard or via the API.

[generate reports](/build/finance/generate-reports)

## Report filters

[Report filters](/build/finance/reports/transactions#report-filters)

When generating transaction reports, you can filter by:


| Field | Description |
| --- | --- |
| Updated date | The date a transaction was last modified. Matches entities modified on or after the start date and before the end date. |
| Status | The current status of the transaction.Completed: Transaction is completed. Payment collected successfully and fully processed.Paid: Transaction is fully paid, but hasn't yet been processed internally.Draft: Transaction is missing required fields. Typically the first stage of a checkout before customer details are captured.Ready: Transaction has all the required fields to be marked asbilledorcompleted.Billed: Transaction has been updated tobilled. Billed transactions get an invoice number and are considered a legal record. They can't be changed. Typically used as part of an invoice workflow.Past due: Transaction is past due. Occurs for automatically-collected transactions when the related subscription is in dunning, and for manually-collected transactions when payment terms have elapsed.Canceled: Transaction has been updated tocanceled. If an invoice, it's no longer due. |
| Origin | Where or why the transaction was created.Created via the API: Transaction created via the Paddle API.Created via the checkout (web): Transaction created automatically by Paddle.js for a checkout.Scheduled subscription renewal: Transaction created automatically by Paddle as a result of a subscription renewal.One-time subscription charge: Transaction created automatically by Paddle as a result of a one-time charge for a subscription.Subscription update: Transaction created automatically by Paddle as a result of an update to a subscription.Payment method update: Transaction created automatically as part of updating a payment method. May be a zero value transaction. |
| Currency | The currency of the transaction. |
| Collection mode | How the customer has been asked to pay.All: Show both modes.Manual: Payment is collected manually. Customers are sent an invoice with payment terms and can make a payment offline or using a checkout.Auto: Payment is collected automatically using a checkout initially, then using a payment method on file. |


The current status of the transaction.

- Completed: Transaction is completed. Payment collected successfully and fully processed.
- Paid: Transaction is fully paid, but hasn't yet been processed internally.
- Draft: Transaction is missing required fields. Typically the first stage of a checkout before customer details are captured.
- Ready: Transaction has all the required fields to be marked asbilledorcompleted.
- Billed: Transaction has been updated tobilled. Billed transactions get an invoice number and are considered a legal record. They can't be changed. Typically used as part of an invoice workflow.
- Past due: Transaction is past due. Occurs for automatically-collected transactions when the related subscription is in dunning, and for manually-collected transactions when payment terms have elapsed.
- Canceled: Transaction has been updated tocanceled. If an invoice, it's no longer due.

Where or why the transaction was created.

- Created via the API: Transaction created via the Paddle API.
- Created via the checkout (web): Transaction created automatically by Paddle.js for a checkout.
- Scheduled subscription renewal: Transaction created automatically by Paddle as a result of a subscription renewal.
- One-time subscription charge: Transaction created automatically by Paddle as a result of a one-time charge for a subscription.
- Subscription update: Transaction created automatically by Paddle as a result of an update to a subscription.
- Payment method update: Transaction created automatically as part of updating a payment method. May be a zero value transaction.

How the customer has been asked to pay.

- All: Show both modes.
- Manual: Payment is collected manually. Customers are sent an invoice with payment terms and can make a payment offline or using a checkout.
- Auto: Payment is collected automatically using a checkout initially, then using a payment method on file.

## Report columns

[Report columns](/build/finance/reports/transactions#report-columns)

Column headings on transaction reports mirror fields inthe Paddle API. Data is provided in the following columns:

[the Paddle API](/api-reference/overview)

Unique Paddle ID for this transaction entity, prefixed withtxn_.


Status of this transaction.


Invoice number for this transaction. Automatically generated by Paddle when you mark a transaction asbilledwherecollection_modeismanual.


Paddle ID of the customer that this transaction is for, prefixed withctm_.


Email address for the customer that this transaction is for.


Paddle ID of the address that this transaction is for, prefixed withadd_.


Supported two-letter ISO 3166-1 alpha-2 country code of the address that this transaction is for.


Paddle ID of the business that this transaction is for, prefixed withbiz_.


Name of the business that this transaction is for.


Comma-separated list of price IDs on this transaction.


Comma-separated list of discount IDs on this transaction.


Paddle ID of the subscription that this transaction is for, prefixed withsub_.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


RFC 3339 datetime string of when this transaction was marked asbilled.nullfor transactions that are notbilledorcompleted.


RFC 3339 datetime string of when payment was last captured for this transaction.


RFC 3339 datetime string of when the balance for this transaction was last updated.


RFC 3339 datetime string of when this transaction was marked ascompleted.nullfor transactions that are notcompleted.


Type of payment method used for the last payment attempt for this transaction.


How this transaction was created.


How payment is collected for this transaction.automaticfor checkout,manualfor invoices.


Your own structured key-value data.


Amount of time for the payment terms set for this transaction. Only present for manually-collected transactions.


Unit of time for the payment terms set for this transaction. Only present for manually-collected transactions.


RFC 3339 datetime string of when the billing period for this transaction starts.


RFC 3339 datetime string of when the billing period for this transaction ends.


Notes or other information included on the invoice document generated for this transaction. Only present for manually-collected transactions.


Customer purchase order number. Only present for manually-collected transactions.


Whether the related transaction may be paid using a Paddle Checkout. Only present for manually-collected transactions.


Supported three-letter ISO 4217 currency code for this transaction.


Subtotal before discount, tax, and deductions in the transaction currency. If an item, unit price multiplied by quantity.


Total discount as a result of any discounts applied in the transaction currency.


Total tax on the subtotal in the transaction currency.


Total after discount and tax in the transaction currency.


Total credit applied to this transaction. This includes credits applied using a customer's credit balance and adjustments to abilledtransaction.


Total due on a transaction after credits but before any payments in the transaction currency.


Total fee taken by Paddle for this transaction in the transaction currency.nulluntil the transaction iscompletedand the fee is processed.


Total earnings for this transaction in the transaction currency . This is the total minus the Paddle fee.nulluntil the transaction iscompletedand the fee is processed.


Three-letter ISO 4217 currency code of your balance currency. If your primary currency has changed, this reflects the primary currency at the time the transaction was billed.


Exchange rate used to convert between the transaction currency to your balance currency.1.0if currencies match.


Total before tax and fees in your balance currency.


Total discount as a result of any discounts applied in your balance currency.


Total tax on the subtotal in your balance currency.


Total after discount and tax in your balance currency.


Total fee taken by Paddle for this transaction in your balance currency.nulluntil the transaction iscompletedand the fee is processed.


Total earnings for this transaction in your balance currency. This is the total minus the Paddle fee.nulluntil the transaction iscompletedand the fee is processed.


Additional credit generated from negativedetails.line_items. This credit is added to the customer balance.


## Related pages

[Related pages](/build/finance/reports/transactions#related-pages)
[Read more](/build/finance/generate-reports)
[Read more](/api-reference/reports/overview)
[Read more](/api-reference/reports/create-report)
- Transaction reports
[Transaction reports](#transaction-reports)
- Report filters
[Report filters](#report-filters)
- Report columns
[Report columns](#report-columns)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:19:25*
