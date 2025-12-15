# Work with credit balances

**Source:** https://developer.paddle.com/build/customers/get-customer-credit-balances

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

# Work with credit balances

[Work with credit balances](/build/customers/get-customer-credit-balances#work-with-credit-balances)

See how much credit a customer has to use. Credit balances are automatically used to pay for future transactions or reduce the amount due on issued invoices.


When Paddle creates credits for prorated changes to a subscription, credit may be added to a credit balance for a customer.


You can check credit balances for a customer to see how much credit they have and how much they've previously used. Credit balances are automatically used to pay for future transactions or reduce the amount due on issued invoices.


## How it works

[How it works](/build/customers/get-customer-credit-balances#background)

Credit balances are stored againstcustomer entities. They hold information about how much credit a customer has available.

[customer entities](/api-reference/customers/overview)

Where customers are billed inmultiple currenciesand receive a credit, Paddle creates a credit balance for each currency. Credit balances can only be applied to transactions in the same currency.

[multiple currencies](/concepts/sell/supported-currencies)
> Credits in Paddle are always related to existing transactions.They adjust an amountthat's been paid, or an amount that's due on an issued invoice. They're not promotional credits, which are credits given to customers for things like referral schemes or promotions.


Credits in Paddle are always related to existing transactions.They adjust an amountthat's been paid, or an amount that's due on an issued invoice. They're not promotional credits, which are credits given to customers for things like referral schemes or promotions.

[They adjust an amount](/build/transactions/create-transaction-adjustments)

### Credits are for prorated subscription changes

[Credits are for prorated subscription changes](/build/customers/get-customer-credit-balances#background-create)

When customers make prorated changes to a subscription, it might result in a credit. This is common in downgrade scenarios, where customersswap to a less expensive planorremove itemsmidway through their billing cycle.

[swap to a less expensive plan](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[remove items](/build/subscriptions/add-remove-products-prices-addons)

When a prorated credit fully pays for a subscription change and there's an amount remaining, Paddle creates a credit balance for a customer to hold what's left.


You can checkdetails.totals.credit_to_balanceagainstthe related transactionfor a subscription change to see how much was added to a credit balance. This is included on invoices sent to customers from Paddle, too.

[the related transaction](/api-reference/transactions/overview)

### Credits are automatically applied

[Credits are automatically applied](/build/customers/get-customer-credit-balances#background-lifecycle)

Paddle automatically uses credit balances to pay for future transactions. Each credit balance has three totals:

- Balance:total available to use.
- Reserved:total temporarily reserved forbilledtransactions.
- Used:total amount of credit used.

In most cases, credit moves from thebalancetotal to theusedtotal when applied to a transaction. This is the case when a credit balance fully pays a transaction, or when the remaining balance of a transaction is successfully collected immediately.


However, when a transaction isbilled, like whenworking with an issued invoice, the credit applied to that transaction moves from thebalancetotal to thereservedtotal. It's not available for other transactions at this point, but it's not yet considered used.

[working with an issued invoice](/build/invoices/create-issue-invoices)

When abilledtransaction is fully paid and marked ascompleted, then the credit moves fromreservedtoused. If abilledtransaction iscanceled,reservedcredit returns tobalance.

[transaction iscanceled](/build/invoices/cancel-invoices)

## Before you begin

[Before you begin](/build/customers/get-customer-credit-balances#prerequisites)

Credit balances are for customers, so you'll need toget a customerto work with credit balances for them.

[get a customer](/api-reference/customers/get-customer)

Paddle creates a credit balance for a customer when they first have a credit. An emptydataarray is returned for customers who don't have any credit balances.


## Check credit balances for a customer

[Check credit balances for a customer](/build/customers/get-customer-credit-balances#check-credit-balance)

You can work with credit balances for a customer using the API.


Send a GET request to the/customers/{customer_id}/credit-balancesendpoint, passing the Paddle ID of the customer entity that you want to list credit balances for.


Paddle ID of the customer entity to work with.


### Response

[Response](/build/customers/get-customer-credit-balances#response-check-credit-balance)

If successful, Paddle responds with a list of credit balances for a customer.


In this example, a customer has a credit balance forUSD.


```json
123456789101112131415161{
2  "data": [
3    {
4      "customer_id": "ctm_01gw9m680k848184fpttwr0b7z",
5      "currency_code": "USD",
6      "balance": {
7        "available": "550",
8        "reserved": "900",
9        "used": "1300"
10      }
11    }
12  ],
13  "meta": {
14    "request_id": "32cf1966-ed49-47d6-a76a-a9b8f7843245"
15  }
16}
```


If successful, Paddle responds with a list of credit balances for a customer.


Paddle creates a credit balance when you take an action that results in a credit, like making prorated changes to a subscription. An emptydataarray is returned where a customer has no credit balances.


```json
1234561{
2  "data": [],
3  "meta": {
4    "request_id": "2d89f662-842b-4644-8915-3bb289d10912"
5  }
6}
```


## Apply a credit balance to a transaction

[Apply a credit balance to a transaction](/build/customers/get-customer-credit-balances#use-credit-balance)

Paddle automatically uses credit balances for a customer to pay or part-pay for transactions. You can't work with credits directly.

> Paddle creates a credit balance for each currency. Credit balances for a currency are only applied to transactions for that currency.


Paddle creates a credit balance for each currency. Credit balances for a currency are only applied to transactions for that currency.


You can checkdetails.totalsagainsta transactionget a breakdown of any credit applied to a transaction. In particular,creditdetails the total credit applied to a transaction andgrand_totallets you know the amount due after credits but before any payments.

[a transaction](/api-reference/transactions/overview)

Breakdown of the total for a transaction. These numbers can be negative when dealing with subscription updates that result in credit.


Subtotal before discount, tax, and deductions. If an item, unit price multiplied by quantity.


Total discount as a result of any discounts applied.


Except for percentage discounts, Paddle applies tax to discounts based on the line itemprice.tax_mode. Ifprice.tax_modefor a line item isinternal, Paddle removes tax from the discount applied.


Total tax on the subtotal.


Total after discount and tax.


Total credit applied to this transaction. This includes credits applied using a customer's credit balance and adjustments to abilledtransaction.


Additional credit generated from negativedetails.line_items. This credit is added to the customer balance.


Total due on a transaction after credits and any payments.


Total due on a transaction after credits but before any payments.


Total fee taken by Paddle for this transaction.nulluntil the transaction iscompletedand the fee is processed.


Total earnings for this transaction. This is the total minus the Paddle fee.nulluntil the transaction iscompletedand the fee is processed.


Three-letter ISO 4217 currency code of the currency used for this transaction.


## Create or add to a credit balance

[Create or add to a credit balance](/build/customers/get-customer-credit-balances#add-to-credit-balance)

Paddle automatically creates credits when customers make prorated changes to a subscription, and the changes result in a prorated credit that isn't fully used up on the related transaction for the subscription change. You can't add to a credit balance yourself.


You cancreate a credit adjustment for a transactionto reduce the amount due to pay on an issued invoice. Paddle doesn't add the credited amount to a credit balance because it's immediately applied to the invoice.

[create a credit adjustment for a transaction](/build/transactions/create-transaction-adjustments)

## Related pages

[Related pages](/build/customers/get-customer-credit-balances#related-pages)
[Read more](/build/transactions/create-transaction-adjustments)
[Read more](/api-reference/customers/list-credit-balances)
[Read more](/api-reference/adjustments/overview)
- Work with credit balances
[Work with credit balances](#work-with-credit-balances)
- How it works
[How it works](#background)
- Credits are for prorated subscription changes
[Credits are for prorated subscription changes](#background-create)
- Credits are automatically applied
[Credits are automatically applied](#background-lifecycle)
- Before you begin
[Before you begin](#prerequisites)
- Check credit balances for a customer
[Check credit balances for a customer](#check-credit-balance)
- Apply a credit balance to a transaction
[Apply a credit balance to a transaction](#use-credit-balance)
- Create or add to a credit balance
[Create or add to a credit balance](#add-to-credit-balance)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:45*
