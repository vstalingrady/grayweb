# Revise customer details on a billed or completed transaction

**Source:** https://developer.paddle.com/build/sell/transactions/revise-transaction-customer-details

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

# Revise customer details on a billed or completed transaction

[Revise customer details on a billed or completed transaction](/build/sell/transactions/revise-transaction-customer-details#revise-customer-details-on-a-billed-or-completed-transaction)

Revise a transaction to update customer, address, and business information for a transaction that's billed or completed.


Sometimes customers might want to update their details after they'vecompleted a checkout, or after you'veissued an invoice. For example, they might want to add a tax number or fill out their address.

[completed a checkout](/concepts/sell/self-serve-checkout)
[issued an invoice](/build/invoices/create-issue-invoices)

You can revise a transaction to update somecustomer,address, orbusinessdetails for it. The existingtransaction entityremains on your system unchanged for recordkeeping purposes.

[customer](/api-reference/customers/overview)
[address](/api-reference/addresses/overview)
[business](/api-reference/businesses/overview)
[transaction entity](/api-reference/transactions/overview)

## How it works

[How it works](/build/sell/transactions/revise-transaction-customer-details#background)

Paddle automatically sends customers an email receipt when a transaction is completed, like when a customer completes checkout or a subscription renews. Email receipts include a PDF invoice that customers can retain for recordkeeping.


It's common for customers to want to update their details on the included PDF. For example,Paddle Checkoutonly requires that customers enter their country (and in some cases their ZIP code) to keep the checkout journey short. In this case, customers might want to populate the other fields that are part of their address, like their street address and state.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

As billed and completed transactions are financial records, they can't be deleted or changed directly. Instead, you can revise customer, address, and business information for a transaction. The related customer information for that transaction is updated, but the existingtransaction entityremains on your system unchanged for recordkeeping purposes.

[transaction entity](/api-reference/transactions/overview)

### Related entities

[Related entities](/build/sell/transactions/revise-transaction-customer-details#related-entities-background)

Completed and billed transactions must have a relatedcustomerandaddress entity, and may have a relatedbusiness entity. They're linked using thecustomer_id,address_id, andbusiness_idfields. You can usetheincludequery parameterto get the related customer, address, and business entities for a transaction.

[customer](/api-reference/customers/overview)
[address entity](/api-reference/addresses/overview)
[business entity](/api-reference/businesses/overview)
`customer_id`
`address_id`
`business_id`
[theincludequery parameter](/api-reference/about/include-entities)

When a customer, address, or business is set against a transaction, Paddle creates a relationship between the transaction and the related entity at that moment. This means that if you update a customer, address, or business after it's been set against a transaction, those changes aren't reflected when you use theincludequery parameter to get the related entities.


You can revise a transaction to update the customer, address, and business entities for a transaction. When you revise a transaction, you're only updating the customer, address, and business information for that particular transaction. The related customer, address, and business entities aren't updated.


### Adjustments

[Adjustments](/build/sell/transactions/revise-transaction-customer-details#adjustments-background)

Adjustmentsare another way you can describe updates to a transaction after it's been billed or completed. However, they're used to describe financial changes, likerefunding or creditingsome or all the items on a transaction.

[Adjustments](/api-reference/adjustments/overview)
[refunding or crediting](/build/transactions/create-transaction-adjustments)

When you revise customer information for a transaction, Paddle may create an adjustment if there are financial changes. For example, if you add a valid tax or VAT number, Paddle automatically creates an adjustment to refund any tax where applicable.


#### Revise a transaction

[Revise a transaction](/build/sell/transactions/revise-transaction-customer-details#revise-a-transaction)
- Describes customer information updates to a billed or completed transaction.
- For example, adding extra address details or adding a tax number.
- Revises customer, address, and business entities for the transaction.
- Customer receives a revised invoice PDF.

To learn more, seeRevise a transaction

[Revise a transaction](/build/sell/transactions/revise-transaction-customer-details)

#### Create an adjustment

[Create an adjustment](/build/sell/transactions/revise-transaction-customer-details#create-an-adjustment)
- Describes financial updates to a billed or completed transaction.
- For example, refunding or crediting some or all line items for a transaction.
- Creates a new, separate adjustment entity related to the transaction.
- Customer receives a credit note PDF.

To learn more, seeRefund or credit a transaction

[Refund or credit a transaction](/build/transactions/create-transaction-adjustments)

In both cases, the existingtransaction entityremains on your system unchanged for recordkeeping purposes.

[transaction entity](/api-reference/transactions/overview)
> You can't revise customer information for a transaction that has an adjustment.


You can't revise customer information for a transaction that has an adjustment.


## Revise a transaction

[Revise a transaction](/build/sell/transactions/revise-transaction-customer-details#revise-transaction)

Revise a transaction using the API in three steps:

1. Build requestBuild a request that includes the customer information that you want to update.

Build request

[Build request](/build/sell/transactions/revise-transaction-customer-details#build-revise-transaction)

Build a request that includes the customer information that you want to update.

1. Revise transactionSend the request to revise the transaction. Paddle revises the related entities.

Revise transaction

[Revise transaction](/build/sell/transactions/revise-transaction-customer-details#post-revise-transaction)

Send the request to revise the transaction. Paddle revises the related entities.

1. Get transaction including revised information— optionalGet the related customer, address, and business for a transaction using theincludeparameter to see the revised information.

Get transaction including revised information— optional

[Get transaction including revised information— optional](/build/sell/transactions/revise-transaction-customer-details#get-included-information-revise-transaction)

Get the related customer, address, and business for a transaction using theincludeparameter to see the revised information.


### Build request

[Build request](/build/sell/transactions/revise-transaction-customer-details#build-revise-transaction)

Build a request that includes the fields you want to revise.


If details are staying the same, you don't need to include them in your request.


You can revise:

- Customer name
- Business name and tax or VAT number (tax_identifier)
- Address details, apart from the country

You can't remove a valid tax or VAT number, only replace it with another valid one.

> For compliance, transactions can only be revised once. Include all the information you want to update in your request. You can't make another request after.


For compliance, transactions can only be revised once. Include all the information you want to update in your request. You can't make another request after.


Revised customer information for this transaction.


Revised name of the customer for this transaction.


Revised business information for this transaction.


Revised name of the business for this transaction.


Revised tax or VAT number for this transaction. You can't remove a valid tax or VAT number, only replace it with another valid one. Paddle automatically creates an adjustment to refund any tax where applicable.


Revised address information for this transaction.


Revised first line of the address for this transaction.


Revised second line of the address for this transaction.


Revised city of the address for this transaction.


Revised state, county, or region of the address for this transaction.


#### Request

[Request](/build/sell/transactions/revise-transaction-customer-details#request-build-revise-transaction)

```json
12345678910111{
2  "customer": {
3    "name": "Sam Miller"
4  },
5  "business": {
6    "tax_identifier": "AB0123456789"
7  },
8  "address": {
9    "first_line": "3811 Ditmars Blvd"
10  }
11}
```


### Revise transaction

[Revise transaction](/build/sell/transactions/revise-transaction-customer-details#post-revise-transaction)

Send aPOSTrequest to the/transactions/{transaction_id}/reviseendpoint with the request you built.


Paddle ID of the transaction entity to work with.


#### Response

[Response](/build/sell/transactions/revise-transaction-customer-details#response-build-revise-transaction)

If successful, Paddle responds with a copy of the transaction entity. As the information revised is customer, address, and business details, it's not included in the response.


revised_atis set to the date and time you revised this transaction.


```json
151617181920212223242526272829303132333415    "billing_period": {
16      "starts_at": "2024-04-12T10:18:47.635628Z",
17      "ends_at": "2024-05-12T10:18:47.635628Z"
18    },
19    "currency_code": "USD",
20    "discount_id": null,
21    "created_at": "2024-04-12T10:12:33.2014Z",
22    "updated_at": "2024-07-26T08:46:00.746349Z",
23    "billed_at": "2024-04-12T10:18:48.294633Z",
24    "revised_at": "2024-07-26T08:46:00.746349Z",
25    "items": [
26      {
27        "price": {
28          "id": "pri_01gsz8x8sawmvhz1pv30nge1ke",
29          "description": "Monthly",
30          "type": "standard",
31          "name": "Monthly (per seat)",
32          "product_id": "pro_01gsz4t5hdjse780zja8vvr7jg",
33          "billing_cycle": {
34            "interval": "month",

```


### Get a transaction including revised informationOptional

[Get a transaction including revised informationOptional](/build/sell/transactions/revise-transaction-customer-details#get-included-information-revise-transaction)

Paddle automatically sends a copy of the revised invoice to customers, so you don't need to do anything.


You canget a transactionusing theincludeparameter with thecustomer,address, andbusinessvalues to see the revised customer information. You might present this to a customer in a billing screen in your frontend.

[get a transaction](/api-reference/transactions/get-transaction)

Paddle ID of the transaction entity to work with.


Include related entities in the response. Use a comma-separated list to specify multiple entities.


#### Response

[Response](/build/sell/transactions/revise-transaction-customer-details#response-extract-transaction-items-create-refund)

If successful, Paddle responds with the transaction entity with the revised customer, address, and business included.


```json
12345678910111213141516171819201{
2  "data": {
3    "id": "txn_01j1f27bnwg90nggkgkf52hy34",
4    "status": "completed",
5    "customer_id": "ctm_01j1f28efp7j4p1ae0hqnd144s",
6    "address_id": "add_01j1f28egce2412sjnzp4pxdqg",
7    "business_id": null,
8    "custom_data": null,
9    "origin": "web",
10    "collection_mode": "automatic",
11    "subscription_id": "sub_01j1f28ywb5hn78y2y5tym9y4k",
12    "invoice_id": "inv_01j1f28yyr4abcmbf94g66p9ht",
13    "invoice_number": "325-11071",
14    "billing_details": null,
15    "billing_period": {
16      "starts_at": "2024-06-28T09:19:26.694403Z",
17      "ends_at": "2024-07-28T09:19:26.694403Z"
18    },
19    "currency_code": "USD",
20    "discount_id": null,

```


## Update customer, business, and address entities

[Update customer, business, and address entities](/build/sell/transactions/revise-transaction-customer-details#update-customer-entities)

When you revise customer information for a transaction, only the customer information for this transaction is updated. The related customer, address, and business entities aren't updated.


Usethe dashboard or the Paddle API to update the customer, address, and business entitiesso that future transactions use the latest data.

[the dashboard or the Paddle API to update the customer, address, and business entities](/build/customers/create-update-customers)

## Common errors

[Common errors](/build/sell/transactions/revise-transaction-customer-details#related-errors)

| transaction_invalid_status_to_revise | You're trying to revise a transaction that's notbilledorcompleted. |
| transaction_revised_limit_reached | You're trying to revise a transaction that's already been revised. |
| transaction_adjusted_unable_to_revise | You're trying to revise a transaction that has an adjustment. |

[transaction_invalid_status_to_revise](/errors/transactions/transaction_invalid_status_to_revise)
[transaction_revised_limit_reached](/errors/transactions/transaction_revised_limit_reached)
[transaction_adjusted_unable_to_revise](/errors/transactions/transaction_adjusted_unable_to_revise)

## Events

[Events](/build/sell/transactions/revise-transaction-customer-details#related-events)

| transaction.updated | Occurs when customer, address, or business information is revised for a transaction.revised_atis set to the date and time of the revision. |
| transaction.revised | Occurs when customer, address, or business information is revised for a transaction. |

[transaction.updated](/webhooks/transactions/transaction-updated)
[transaction.revised](/webhooks/transactions/transaction-revised)

## Related pages

[Related pages](/build/sell/transactions/revise-transaction-customer-details#related-pages)
[Read more](/build/customers/create-update-customers)
[Read more](/build/transactions/create-transaction-adjustments)
[Read more](/api-reference/transactions/revise-transaction)
- Revise customer details on a billed or completed transaction
[Revise customer details on a billed or completed transaction](#revise-customer-details-on-a-billed-or-completed-transaction)
- How it works
[How it works](#background)
- Related entities
[Related entities](#related-entities-background)
- Adjustments
[Adjustments](#adjustments-background)
- Revise a transaction
[Revise a transaction](#revise-transaction)
- Build request
[Build request](#build-revise-transaction)
- Revise transaction
[Revise transaction](#post-revise-transaction)
- Get a transaction including revised information
[Get a transaction including revised information](#get-included-information-revise-transaction)
- Update customer, business, and address entities
[Update customer, business, and address entities](#update-customer-entities)
- Common errors
[Common errors](#related-errors)
- Events
[Events](#related-events)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:44*
