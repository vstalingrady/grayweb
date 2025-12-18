# Prefill checkout properties

**Source:** https://developer.paddle.com/build/checkout/prefill-checkout-properties

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

# Prefill checkout properties

[Prefill checkout properties](/build/checkout/prefill-checkout-properties#prefill-checkout-properties)

Prefill checkout fields to save customers time and increase checkout conversion


You can prefill properties on a checkout for a smoother checkout experience for customers. You might do this when:

- You capture some information about a prospect on the page before they interact with your checkout.
- You've built an integration with a CRM solution that passes email or other information as parameters on signup links.
- You're working with a logged-in customer, presenting them with upgrade options.

## How it works

[How it works](/build/checkout/prefill-checkout-properties#background)

Paddle Checkoutis optimized for conversion, asking customers for:

[Paddle Checkout](/concepts/sell/self-serve-checkout)
- Email address
- Country
- ZIP/postal code, or region (only in some markets)
[only in some markets](/concepts/sell/supported-countries-locales)
- Payment details

Customers can also add a discount and information about their business, like a VAT or tax number.


You can pass data to a checkout to prefill properties, reducing purchase friction for customers and increasing conversion. You can prefill all customer details. You can't prefill payment details, but you canpresent saved payment methodsfor returning customers.

[present saved payment methods](/build/checkout/saved-payment-methods)

Prefilling works with bothoverlay checkoutandinline checkout. You can useHTML data attributesorJavaScript properties.

[overlay checkout](/build/checkout/build-overlay-checkout)
[inline checkout](/build/checkout/build-branded-inline-checkout)
[HTML data attributes](/paddlejs/html-data-attributes)
[JavaScript properties](/paddlejs/methods/paddle-checkout-open)

## Before you begin

[Before you begin](/build/checkout/prefill-checkout-properties#prerequisites)

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

## Pass customer or business information

[Pass customer or business information](/build/checkout/prefill-checkout-properties#pass-objects)

In this example, there's a signup button that includes an email address field. The page has a country selector.


You could use HTML attributes or JavaScript properties to prefill this information in checkout:


| # | Description | HTML attribute | JavaScript property |
| --- | --- | --- | --- |
| 1 | Country | data-customer-address-country-code | customer.address.countryCode |
| 2 | Email address | data-customer-email | customer.email |


Add data attributes to your checkout launcher to prefill those values on a checkout.


```html
123456789101112131415161718191<a 
2  href='#' 
3  class='paddle_button'
4  data-theme='light'
5  data-customer-address-country-code='US'
6  data-customer-email='jo@example.com'
7  data-items='[
8    {
9      "priceId": "pri_01gs59hve0hrz6nyybj56z04eq",
10      "quantity": 1
11    },
12    {
13      "priceId": "pri_01gs59p7rcxmzab2dm3gfqq00a",
14      "quantity": 1
15    }
16  ]'
17>
18  Buy Now
19</a>
```


For a full list of fields you can prefill, seeHTML data attributes

[HTML data attributes](/paddlejs/html-data-attributes)

## Pass customer, address, and business IDs

[Pass customer, address, and business IDs](/build/checkout/prefill-checkout-properties#pass-paddle-ids)

Instead of passing customer email, address, and business information, you can pass an existing customer ID, address ID, or business ID.


You might do this if you're working with a logged-in customer who's looking to upgrade or purchase another subscription, or if you have a CRM integration that creates entities in Paddle for prospects.

> Customer ID, address ID, and business ID replace other customer, address, and business fields. For example, you should pass either customer ID or customer email — not both.


Customer ID, address ID, and business ID replace other customer, address, and business fields. For example, you should pass either customer ID or customer email — not both.


Add data attributes to your checkout launcher to prefill those values on a checkout.


```html
12345678910111213141516171819201<a 
2  href='#' 
3  class='paddle_button'
4  data-theme='light'
5  data-customer-id='ctm_01gm82kny0ad1tk358gxmsq87m'
6  data-customer-address-id='add_01gm82v81g69n9hdb0v9sw6j40'
7  data-business-id='biz_01gnymqsj1etmestb4yhemdavm'
8  data-items='[
9    {
10      "priceId": "pri_01gm81eqze2vmmvhpjg13bfeqg",
11      "quantity": 1
12    },
13    {
14      "priceId": "pri_01gm82kny0ad1tk358gxmsq87m",
15      "quantity": 1
16    }
17  ]'
18>
19  Buy Now
20</a>
```


For a full list of fields that you can prefill, seeHTML data attributes

[HTML data attributes](/paddlejs/html-data-attributes)

## Apply a discount

[Apply a discount](/build/checkout/prefill-checkout-properties#pass-discount)

You can pass the Paddle ID of a discount entity or its discount code to a checkout to automatically apply it — no need for customers to enter a code.

> enabled_for_checkoutmust betrueagainstthe discount entityto apply it to a checkout.


enabled_for_checkoutmust betrueagainstthe discount entityto apply it to a checkout.

[the discount entity](/api-reference/discounts/overview)

Add data attributes to your checkout launcher to prefill those values on a checkout.


```html
12345678910111213141516171819201<a href='#' 
2	class='paddle_button'
3	data-display-mode='overlay'
4	data-theme='light'
5	data-locale='en'
6	data-items='[
7      {
8          "priceId": "pri_01gm81eqze2vmmvhpjg13bfeqg",
9          "quantity": 1
10      },
11      {
12          "priceId": "pri_01gm82kny0ad1tk358gxmsq87m",
13          "quantity": 1
14      },
15      {
16          "priceId": "pri_01gm82v81g69n9hdb0v9sw6j40",
17          "quantity": 1
18      }
19  ]'
20  data-discount-id='dsc_01gp0ynsntfpyw2spd2md1wqx1'

```


To learn more, seeHTML data attributes

[HTML data attributes](/paddlejs/html-data-attributes)

## Build a one-page checkout

[Build a one-page checkout](/build/checkout/prefill-checkout-properties#build-one-page-checkout)

### One-page checkout experience

[One-page checkout experience](/build/checkout/prefill-checkout-properties#opc-build-one-page-checkout)

Passvariantwith the valueone-pageasa checkout settingto present customers with a one-page checkout experience. Paddle Checkout collects customer information and payment details on the same page.

[a checkout setting](/build/checkout/set-up-checkout-default-settings)

```javascript
1234567891011121314151617181var itemsList = [
2  {
3    priceId: 'pri_01gm81eqze2vmmvhpjg13bfeqg',
4    quantity: 1
5  },
6  {
7    priceId: 'pri_01gm82kny0ad1tk358gxmsq87m',
8    quantity: 1
9  }
10];
11
12Paddle.Checkout.open({
13  settings: {
14    displayMode: "overlay",
15    variant: "one-page"
16  },
17  items: itemsList,
18});
```


### Multi-page checkout

[Multi-page checkout](/build/checkout/prefill-checkout-properties#mpc-build-one-page-checkout)

If you prefer the multi-page checkout experience, Paddle skips the first page of checkout when all required fields are prefilled. This means customers land on a screen where all they need to do is enter their payment details.


To jump to the second page on the multi-page inline checkout, prefill either required properties or Paddle IDs:


| Description | HTML attribute | JavaScript property |
| --- | --- | --- |
| Country | data-customer-address-country-code | customer.address.countryCode |
| Email address | data-customer-email | customer.email |
| ZIP/postal code (only where required) | data-customer-address-postal-code | customer.address.postalCode |
| Region (only for United Arab Emirates) | data-customer-address-region | customer.address.region |

[only where required](/concepts/sell/supported-countries-locales)
[only for United Arab Emirates](/concepts/sell/supported-countries-locales)

## Related pages

[Related pages](/build/checkout/prefill-checkout-properties#related-pages)
[Read more](/build/products/offer-discounts-promotions-coupons)
[Read more](/paddlejs/html-data-attributes)
[Read more](/paddlejs/methods/paddle-checkout-open)
- Prefill checkout properties
[Prefill checkout properties](#prefill-checkout-properties)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Pass customer or business information
[Pass customer or business information](#pass-objects)
- Pass customer, address, and business IDs
[Pass customer, address, and business IDs](#pass-paddle-ids)
- Apply a discount
[Apply a discount](#pass-discount)
- Build a one-page checkout
[Build a one-page checkout](#build-one-page-checkout)
- One-page checkout experience
[One-page checkout experience](#opc-build-one-page-checkout)
- Multi-page checkout
[Multi-page checkout](#mpc-build-one-page-checkout)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:36*
