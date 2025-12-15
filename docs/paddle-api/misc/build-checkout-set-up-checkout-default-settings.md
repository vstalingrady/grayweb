# Pass checkout settings

**Source:** https://developer.paddle.com/build/checkout/set-up-checkout-default-settings

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

# Pass checkout settings

[Pass checkout settings](/build/checkout/set-up-checkout-default-settings#pass-checkout-settings)

Pass settings to Paddle.js to determine how opened checkouts should work. Set default settings for all checkouts on a page to save time.


As well as passing items to a checkout, you can pass settings that tellPaddle.jshow a checkout should work.

[Paddle.js](/paddlejs/overview)

If you offer multiple products or plans, you might have more than one checkout button on a page. To save time, you can pass default settings that apply to all checkouts opened when including Paddle.js.


## How it works

[How it works](/build/checkout/set-up-checkout-default-settings#background)

You can pass settings to Paddle.js to determine how opened checkouts should work. You can do this in three ways:

- Pass data attributes to button that opens checkout.UseHTML data attributeson your checkout launcher element. The settings you pass apply only to the opened checkout.

Pass data attributes to button that opens checkout.


UseHTML data attributeson your checkout launcher element. The settings you pass apply only to the opened checkout.

[HTML data attributes](/paddlejs/html-data-attributes)
- Apply settings to only the opened checkout.PasssettingstoPaddle.Checkout.open(). The settings you pass apply only to the opened checkout.

Apply settings to only the opened checkout.


PasssettingstoPaddle.Checkout.open(). The settings you pass apply only to the opened checkout.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
- Apply settings to all checkouts opened on a page.Passcheckout.settingstoPaddle.Initialize(). The settings you pass apply to all checkouts.

Apply settings to all checkouts opened on a page.


Passcheckout.settingstoPaddle.Initialize(). The settings you pass apply to all checkouts.

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

If you have more than one checkout link on a page and all the checkouts you use have the same settings, we recommend using thePaddle.Initialize()method. This sets default settings that apply to all checkouts opened on the page, meaning you don't need to pass the same settings for each checkout.


UsePaddle.Checkout.open()or HTML data attributes to pass settings for each checkout on a page. HTML data attributes are generally recommended foroverlay checkouts, or when working with a CMS that has limited customization options.

[overlay checkouts](/build/checkout/build-overlay-checkout)

## Before you begin

[Before you begin](/build/checkout/set-up-checkout-default-settings#prerequisites)

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

## Required settings

[Required settings](/build/checkout/set-up-checkout-default-settings#required-settings)

If you're buildingan inline checkout, some settings are required:

[an inline checkout](/build/checkout/build-branded-inline-checkout)

Display mode for the checkout.


Class name of the<div>element where the checkout should be rendered.


Styles to apply to the checkout<div>.min-widthmust be set to286pxor above with checkout padding off;312pxwith checkout padding on. UseframeInitialHeightto set height.


Height in pixels of the<div>on load. Do not includepx. Recommended450.


The inline checkout footer includes a message to let customers know that Paddle is the merchant of record for the transaction. For compliance, the inline checkout frame must be sized so that the footer message is visible.

> frameStyleisn't required, but strongly recommended for styling the inline checkout frame. If not set, checkout frames inherit browser or default styles foriframeelements.


frameStyleisn't required, but strongly recommended for styling the inline checkout frame. If not set, checkout frames inherit browser or default styles foriframeelements.


## Recommended settings

[Recommended settings](/build/checkout/set-up-checkout-default-settings#recommended-settings)

### One-page checkout

[One-page checkout](/build/checkout/set-up-checkout-default-settings#one-page-checkout)

By default, Paddle presents customers with a multi-page checkout experience. You can present customers with a one-page experience to collect customer information and payment details on the same page.


Usevariantto presentone-pageormulti-pagecheckout experiences. Paddle Checkout defaults toone-pageby default.


Checkout experience presented to customers. Defaults tomulti-page.


### Dark mode

[Dark mode](/build/checkout/set-up-checkout-default-settings#dark-mode)

Usethemeto style a checkout fordarkorlightmode. Paddle Checkout defaults tolightby default.


Theme for the checkout. If omitted, defaults to light.


### Allow logout

[Allow logout](/build/checkout/set-up-checkout-default-settings#allow-logout)

If you're presenting an existing customer with options to upgrade, setallowLogouttofalse. This hides the option to change the customer on an opened checkout.


Whether the user can change their email once on the checkout.

> When you pass acustomerAuthTokento Paddle.js to authenticate a customer, or you pass anupsellobject to Paddle.js toshow an upsell flow,allowLogoutis ignored and set tofalse.


When you pass acustomerAuthTokento Paddle.js to authenticate a customer, or you pass anupsellobject to Paddle.js toshow an upsell flow,allowLogoutis ignored and set tofalse.

[show an upsell flow](/build/checkout/upsell-checkout)

### Locale

[Locale](/build/checkout/set-up-checkout-default-settings#locale)

Paddle Checkout uses the browser default locale iflocaleisn't passed. If you have a langauge selector on your website or app, we recommend passing the chosen locale to opened checkout so that it matches.


Language for the checkout. If omitted, the browser's default locale is used.


### Hide option to add discount

[Hide option to add discount](/build/checkout/set-up-checkout-default-settings#hide-option-to-add-discount)

Paddle Checkout includes an "Add Discount" option to let customers enter a discount code. If you don't offer discounts, you might like to hide this option.


Whether the option to add a discount is displayed at checkout. Requires the "display discount field on the checkout"option enabled in Paddle > Checkout > Checkout settings. Defaults totrue.


### Hide option to add tax number

[Hide option to add tax number](/build/checkout/set-up-checkout-default-settings#hide-option-to-add-tax-number)

Paddle Checkout includes an "Add tax number" option to let customers enter a tax number and business information. If you don't work with businesses, you might like to hide this option.


Whether the option to add a tax number is displayed at checkout. Defaults totrue.


## Set default settings during initialization

[Set default settings during initialization](/build/checkout/set-up-checkout-default-settings#default-settings)

Rather than passing checkout settings each time you create a link or callPaddle.Checkout.open, you can set default settings when you include Paddle.js. These settings apply to all checkouts opened on the page.


Use thePaddle.Initialize()method and pass your checkout defaults tocheckout.settings. You can do this in the same block where youinclude Paddle.json your page.

[include Paddle.js](/paddlejs/include-paddlejs)

This example sets up an inline checkout, then sets the checkoutthemetodark,localeto Spanish (es), andallowLogouttofalse:


```html
1234567891011121314151617181<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Initialize({
4    token: 'live_7d279f61a3499fed520f7cd8c08', // replace with a client-side token
5    pwCustomer: { },
6    checkout: {
7      settings: {
8        displayMode: "inline",
9        frameTarget: "checkout-container"
10        frameInitialHeight: "450",
11        frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
12        theme: "dark",
13        locale: "es",
14        allowLogout: false
15      }
16    } 
17  });
18</script>
```


To learn more, seePaddle.Initialize()

[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

## Pass settings for each checkout

[Pass settings for each checkout](/build/checkout/set-up-checkout-default-settings#checkout-settings)

You can pass settings for each checkout that you open on the page when you create a link or callPaddle.Checkout.open().


This example sets the checkoutdata-themetodark,data-localeto Spanish (es), anddata-allow-logouttofalse.


```html
123456789101112131415161718191<a 
2  href='#' 
3  class='paddle_button'
4  data-theme='dark'
5  data-locale='es'
6  data-allow-logout='false'
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


For a full list of HTML data attributes, seeHTML data attributes

[HTML data attributes](/paddlejs/html-data-attributes)

## Related pages

[Related pages](/build/checkout/set-up-checkout-default-settings#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/build/transactions/custom-data)
- Pass checkout settings
[Pass checkout settings](#pass-checkout-settings)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Required settings
[Required settings](#required-settings)
- Recommended settings
[Recommended settings](#recommended-settings)
- One-page checkout
[One-page checkout](#one-page-checkout)
- Dark mode
[Dark mode](#dark-mode)
- Allow logout
[Allow logout](#allow-logout)
- Locale
[Locale](#locale)
- Hide option to add discount
[Hide option to add discount](#hide-option-to-add-discount)
- Hide option to add tax number
[Hide option to add tax number](#hide-option-to-add-tax-number)
- Set default settings during initialization
[Set default settings during initialization](#default-settings)
- Pass settings for each checkout
[Pass settings for each checkout](#checkout-settings)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:55*
