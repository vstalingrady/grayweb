# Create products and prices

**Source:** https://developer.paddle.com/build/products/create-products-prices

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

# Create products and prices

[Create products and prices](/build/products/create-products-prices#create-products-and-prices)

Products and prices make up your catalog in Paddle. They hold information about what's being sold, how much items are being sold for, and how often a charge is made.


Your product catalog holds the products that are being sold to customers, including subscription plans, recurring addons, and one-time charges.


Create products and related prices to start billing.


## How it works

[How it works](/build/products/create-products-prices#background)

A complete product in Paddle is made up of two parts:

1. Aproduct entitythat describes the item, like its name, description, and an image.

Aproduct entitythat describes the item, like its name, description, and an image.

[product entity](/api-reference/products/overview)
1. At least one relatedprice entitythat describes how much and how often a product is billed.

At least one relatedprice entitythat describes how much and how often a product is billed.

[price entity](/api-reference/prices/overview)

Products are the items that customers buy — like subscription plans, recurring addons, or one-time charges. Prices describe how they pay for them.


In this example, Enterprise is a product and $3000/mo is a price for it.


When switching from monthly to yearly:

- Products remain the same — the name and details remain as Enterprise.
- Prices change — your page should fetch prices for products where the billing cycle is yearly rather than monthly.

You can create as many prices for a product as you want to describe all the ways it's billed. However, prices may only relate to one product.


### Billing cycle

[Billing cycle](/build/products/create-products-prices#background-billing-cycle)

The billing cycle against a price determines how often Paddle bills for it. You can set an interval and a frequency. This is typically things like every month, every three months, or every year, but you can be as flexible as you like.


Paddle supports multi-product subscriptions, letting youadd recurring addons alongside subscription plans. When building multi-product subscriptions, all items on a subscription must have the same billing period. This means that if a customer subscribes to your "Pro plan" with a yearly price, you must also create yearly price for any recurring addons. You can't add a monthly addon to a subscription for a yearly plan.

[add recurring addons alongside subscription plans](/build/subscriptions/add-remove-products-prices-addons)

### One-time charges

[One-time charges](/build/products/create-products-prices#background-one-time)

Prices don't have to have a billing cycle. These are called "one-time charges."


One-time charges can be billed to subscriptions. They're typically used for things like setup or onboarding fees at the start of a subscription, or data auditing or support incident fees during a subscription.


You might also use them to offer ebooks, access to webinars, or other learning resources to customers.


## Create a product

[Create a product](/build/products/create-products-prices#create-product)

Create products to describe items being sold. You can add prices to products afterward.


We recommend creating products using the Paddle dashboard.

1. Go toPaddle>Catalog>Products.

Go toPaddle>Catalog>Products.

1. ClickNew product

ClickNew product

1. Enter details for your new product.

Enter details for your new product.

1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Create a related price

[Create a related price](/build/products/create-products-prices#create-price)

Once you've created products, create related prices that describe how you bill for them. You can't sell a product without creating a price.


We recommend creating prices using the Paddle dashboard.

> Add price overrides to a price to set country specific prices. Price overrides let you override the base price with a custom price and currency for any country. See:Localize prices


Add price overrides to a price to set country specific prices. Price overrides let you override the base price with a custom price and currency for any country. See:Localize prices

[Localize prices](/build/products/offer-localized-pricing)
1. Go toPaddle>Catalog>Products, then click the product you want to add a price to in the list.

Go toPaddle>Catalog>Products, then click the product you want to add a price to in the list.

1. Under the Prices section, clickNew price

Under the Prices section, clickNew price

1. Enter details for your new price.

Enter details for your new price.

1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Review prices and products

[Review prices and products](/build/products/create-products-prices#list-products-prices)

Once you've created products and related prices, you can use theincludequery parameter in the Paddle API to review them. You can:

- Get a product and include its related prices
[Get a product and include its related prices](/build/products/create-products-prices#review-get-product)
- Get a price and include its related product
[Get a price and include its related product](/build/products/create-products-prices#review-get-price)
- List prices for a product
[List prices for a product](/build/products/create-products-prices#review-list-prices)

### Get a product and all prices

[Get a product and all prices](/build/products/create-products-prices#review-get-product)

To get a product and its related prices, send aGETrequest to the/products/{product_id}endpoint, using theincludequery parameter with the valueprices.


Return entities related to the specified product. Use a comma-separated list to specify multiple product IDs.


Include related entities in the response. Use a comma-separated list to specify multiple entities.


### Get a price and related product

[Get a price and related product](/build/products/create-products-prices#review-get-price)

To get a price and its related product, send aGETrequest to the/prices/{price_id}endpoint, using theincludequery parameter with the valueproduct.


Return entities related to the specified price. Use a comma-separated list to specify multiple price IDs.


Include related entities in the response.


### List prices for a product

[List prices for a product](/build/products/create-products-prices#review-list-prices)

To return a list of prices for a product, send aGETrequest to the/pricesendpoint, using theproduct_idquery parameter to filter byproduct_id.


You can pass a comma-separated list to list prices for more than one product.


Return entities related to the specified product. Use a comma-separated list to specify multiple product IDs.


## Events

[Events](/build/products/create-products-prices#related-notifications)

| product.created | Occurs when a product is created. |
| price.created | Occurs when a price is created. |
| product.updated | Occurs when a price is created and associated with a product. |

[product.created](/webhooks/products/product-created)
[price.created](/webhooks/prices/price-created)
[product.updated](/webhooks/products/product-updated)

## Related pages

[Related pages](/build/products/create-products-prices#related-pages)
[Read more](/build/products/offer-localized-pricing)
[Read more](/build/products/offer-discounts-promotions-coupons)
[Read more](/build/checkout/build-pricing-page)
- Create products and prices
[Create products and prices](#create-products-and-prices)
- How it works
[How it works](#background)
- Billing cycle
[Billing cycle](#background-billing-cycle)
- One-time charges
[One-time charges](#background-one-time)
- Create a product
[Create a product](#create-product)
- Create a related price
[Create a related price](#create-price)
- Review prices and products
[Review prices and products](#list-products-prices)
- Get a product and all prices
[Get a product and all prices](#review-get-product)
- Get a price and related product
[Get a price and related product](#review-get-price)
- List prices for a product
[List prices for a product](#review-list-prices)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:17:59*
