# Create or update customers

**Source:** https://developer.paddle.com/build/customers/create-update-customers

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

# Create or update customers

[Create or update customers](/build/customers/create-update-customers#create-or-update-customers)

Customers, addresses, and businesses are the people and businesses that make purchases. Paddle automatically creates customers as part of checkout.


Customers are the people and businesses that make purchases. Paddle creates customers for you as part of checkout, or you can create them yourself.

> If you're looking to update customer, address, and business information on a completed checkout or issued invoice, seeRevise customer details on a billed or completed transaction


If you're looking to update customer, address, and business information on a completed checkout or issued invoice, seeRevise customer details on a billed or completed transaction

[Revise customer details on a billed or completed transaction](/build/sell/transactions/revise-transaction-customer-details)

## How it works

[How it works](/build/customers/create-update-customers#background)

All purchases in Paddle require a customer. Customers are lightweight entities that hold key information like name, email, and localization information. They have two subentities:

- Addresses, which hold information about billing addresses
- Businesses, which hold information that you need when working with a business

Customers can have multiple addresses and businesses against them — useful when you're dealing with a large customer with offices in different locations. They can be linked to multiple subscriptions, too.


### Paddle Checkout creates customers

[Paddle Checkout creates customers](/build/customers/create-update-customers#background-checkout)

If you offer products using a self-serve motion, letting customers sign up and pay for subscriptions using a checkout, you don't generally need to create customers yourself.Paddle Checkoutautomatically creates customers, addresses, and businesses as part of the checkout process.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

When a customer enters an email address at checkout and there's already an existing customer entity for them in your system, Paddle uses the existing customer entity rather than creating a new one. This means transactions and subscriptions for the same customer are kept together, and lets you create complex multi-subscription offerings.


Paddle always creates a new address for a customer, even if matching addresses are found. This is because addresses are closely related to payment methods.


### Required fields for invoicing

[Required fields for invoicing](/build/customers/create-update-customers#background-invoicing)

To make buying as frictionless as possible,Paddle Checkoutonly asks for the required information to complete a purchase online. This includes a customer's email address and country.

[Paddle Checkout](/concepts/sell/self-serve-checkout)

Asinvoicesare legal documents, Paddle requires more data against customers and addresses to make sure that they're compliant across the markets we serve.

[invoices](/concepts/sell/sales-assisted-invoice)

|  | Checkout (automatically-collected transactions) | Invoices (manually-collected transactions) |
| --- | --- | --- |
| customer.name |  |  |
| customer.email |  |  |
| address.first_line |  |  |
| address.second_line |  |  |
| address.city |  |  |
| address.postal_code | In some markets |  |
| address.region | In some markets |  |
| address.country_code |  |  |


You don't have to set a business for a transaction, even when working with an invoice.


### Update information for completed transactions

[Update information for completed transactions](/build/customers/create-update-customers#revise-transaction-background)

Billed and completed transactions are considered financial records for compliance purposes. This means they can't be deleted or changed directly. If you update a customer, address, or business after it's been added to a transaction, the information against the transaction isn't updated.


You can revise customer information for billed or completed transactions to update information like tax or VAT number, address details, or customer name.


To learn more, seeRevise customer details on a billed or completed transaction

[Revise customer details on a billed or completed transaction](/build/sell/transactions/revise-transaction-customer-details#background)

## Create a customer

[Create a customer](/build/customers/create-update-customers#create-customer)

Create a customer to create a transaction for a person or business.

> Customer email addresses must be unique in your system. Customers can be linked to multiple subscriptions, so there's no need to create a new customer for each subscription.


Customer email addresses must be unique in your system. Customers can be linked to multiple subscriptions, so there's no need to create a new customer for each subscription.

1. Go toPaddle > Customers.

Go toPaddle > Customers.

1. ClickNew customer

ClickNew customer

1. Enter the details for your new customer.

Enter the details for your new customer.


| Name | Full name of this customer. |
| Email | Email address for this customer. |

1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Create an address

[Create an address](/build/customers/create-update-customers#create-address)

Create an address related to a customer to say where a person or business is located.

1. Go toPaddle > Customers.

Go toPaddle > Customers.

1. Find the customer you'd like to add an address to in the list, then click theoverflow buttonbutton and chooseView customer. If you haven't created a customer already, you can create one.

Find the customer you'd like to add an address to in the list, then click theoverflow buttonbutton and chooseView customer. If you haven't created a customer already, you can create one.

1. Under theAddressesheading, clickNew address

Under theAddressesheading, clickNew address

1. Enter the details for your new customer.

Enter the details for your new customer.


| Description | Memorable description for this address. |
| First line | First line of this address. |
| Second line | Second line of this address. |
| City | City of this address. |
| ZIP code | ZIP or postal code of this address. Required for some countries. |
| Region | State, county, or region of this address. You can enter state codes for theUnited States. |
| Country code | Country of this address. |

1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Create a business

[Create a business](/build/customers/create-update-customers#create-business)

You should add a business if you're dealing with a company. You don't need to add a business if you're working with a private individual.

1. Go toPaddle > Customers.

Go toPaddle > Customers.

1. Find the customer you'd like to add a business to in the list, then click theoverflow buttonbutton and chooseView customer. If you haven't created a customer already, you can create one.

Find the customer you'd like to add a business to in the list, then click theoverflow buttonbutton and chooseView customer. If you haven't created a customer already, you can create one.

1. Under theBusinessesheading, clickNew business

Under theBusinessesheading, clickNew business

1. Enter the details for your new business.

Enter the details for your new business.


| Name | Name of this business. |
| Tax identifier | Tax or VAT number for this business. You can find a valid list of tax number formats on thePaddle help center. |
| Company number | Company number for this business. |
| Contacts | List of contacts related to this business. Business contacts automatically receive copies of invoices sent by Paddle. |

[Paddle help center](https://www.paddle.com/help/sell/tax/what-format-should-i-use-for-my-vat-id)
1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Common errors

[Common errors](/build/customers/create-update-customers#related-errors)

| customer_already_exists | There's already a customer entity with the email address that you're using to create or update a customer.List customersusing the API, passing theemailquery parameter to find the existing entity. |
| customer_email_invalid | Email address for a customer is invalid. Check that there are no unsupported characters and it's formatted correctly. |
| address_location_not_allowed | Paddle doesn't support the country for an address. Check that thecountry is supported. |

[customer_already_exists](/errors/customers/customer_already_exists)
[List customers](/api-reference/customers/list-customers)
[customer_email_invalid](/errors/customers/customer_email_invalid)
[address_location_not_allowed](/errors/addresses/address_location_not_allowed)
[country is supported](/concepts/sell/supported-countries-locales)

## Events

[Events](/build/customers/create-update-customers#related-notifications)

| customer.created | Occurs when you create a customer, or when Paddle.js creates a customer at checkout. |
| address.created | Occurs when you create an address, or when Paddle.js creates an address at checkout. |
| business.created | Occurs when you create a business, or when Paddle.js creates a business at checkout. |

[customer.created](/webhooks/customers/customer-created)
[address.created](/webhooks/addresses/address-created)
[business.created](/webhooks/businesses/business-created)

## Related pages

[Related pages](/build/customers/create-update-customers#related-pages)
[Read more](/build/transactions/create-transaction)
[Read more](/build/sell/transactions/revise-transaction-customer-details)
[Read more](/build/subscriptions/update-payment-details)
- Create or update customers
[Create or update customers](#create-or-update-customers)
- How it works
[How it works](#background)
- Paddle Checkout creates customers
[Paddle Checkout creates customers](#background-checkout)
- Required fields for invoicing
[Required fields for invoicing](#background-invoicing)
- Update information for completed transactions
[Update information for completed transactions](#revise-transaction-background)
- Create a customer
[Create a customer](#create-customer)
- Create an address
[Create an address](#create-address)
- Create a business
[Create a business](#create-business)
- Common errors
[Common errors](#related-errors)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:23*
