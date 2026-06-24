# Set your default payment link

**Source:** https://developer.paddle.com/build/transactions/default-payment-link

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

# Set your default payment link

[Set your default payment link](/build/transactions/default-payment-link#set-your-default-payment-link)

Your default payment link is a quick way to open Paddle Checkout for a transaction, and used when updating a payment method. Set it in the Paddle dashboard.


Transactions have a checkout payment link that you can use to open a checkout to collect for payment. Set a default payment link to tell Paddle which page in your app or website that checkout payment links should point to by default.


Your default payment link is also used to open a checkout to let customers update their payment method. It's included automatically in emails sent by Paddle to customers.

> You must set your default payment link to start selling with Paddle. You can't create transactions without it — includingmanually-collected transactions (invoices).


You must set your default payment link to start selling with Paddle. You can't create transactions without it — includingmanually-collected transactions (invoices).

[manually-collected transactions (invoices)](/build/invoices/create-issue-invoices)

## How it works

[How it works](/build/transactions/default-payment-link#background)

Every Paddle account has a default payment link. It's used for:

- Unique payment links againsttransactionsthat automatically open aPaddle Checkoutto collect for payment.
[transactions](/api-reference/transactions/overview)
[Paddle Checkout](/concepts/sell/self-serve-checkout)
- As a redirect for the payment method update URL against automatically-collected subscriptions to let customers update payment details.
- In emails sent by Paddle to customers to let them update their payment details for automatically-collected subscriptions.

Your default payment link should be a page for an approved website thatincludes Paddle.js. You don't need to do anything to get Paddle.js to open a checkout, it automatically opens a checkout for the transaction when the query parameter is present.

[includes Paddle.js](/paddlejs/include-paddlejs)

### Transaction payment links

[Transaction payment links](/build/transactions/default-payment-link#background-payment-links)

All automatically-collected transactions include a checkout payment link.


Manually-collected transactions don't include a checkout payment link by default, but you can setbilling_details.enable_checkouttotruewhencreating or updatingto include one. When enabled, this link is automatically included on invoice documents sent by Paddle.

[creating or updating](/build/invoices/create-issue-invoices)

Checkout payment links are returned in transaction responses ascheckout.url. They're made up of your default payment link with a_ptxnquery parameter appended. The value of the query parameter is the transaction ID. For example:


```undefined
11https://aeroedit.com/pay?_ptxn=txn_01h2b0qpjc0xt8k5aw6nsdec4p
```


In this example:


| Default payment link | https://aeroedit.com/pay |
| Query parameter key | ?_ptxn= |
| Query parameter value(transaction ID) | txn_01h2b0qpjc0xt8k5aw6nsdec4p |


You can pass any of your other approved websites ascheckout.urlwhencreating or updating a transactionto override the default checkout link, if you want to point to another page.

[creating or updating a transaction](/build/transactions/create-transaction)

### Payment method update links

[Payment method update links](/build/transactions/default-payment-link#background-payment-method-update-links)

For compliance, subscription emails from Paddle include a link to let customers update their payment method and cancel their subscription. Links are also returned when working withsubscription entitiesagainstsubscription.management_urls.

[subscription entities](/api-reference/subscriptions/overview)

The link toupdate a payment methodredirects to your default payment URL to open a checkout to update a payment method.

[update a payment method](/build/subscriptions/update-payment-details)

## Before you begin

[Before you begin](/build/transactions/default-payment-link#prerequisites)

### Get your website approved

[Get your website approved](/build/transactions/default-payment-link#prerequisites-domain-approval)

Add the website where your default payment link page is hosted toPaddle > Checkout > Website approval.


If you're using a sandbox account, your website is automatically approved right away. You should see a check mark.


For live accounts, website approval may take a few days as the Paddle verification team check your website.

[Learn more about website approval on the Paddle help center.](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)

Learn more about website approval on the Paddle help center.


## Build your default payment link page

[Build your default payment link page](/build/transactions/default-payment-link#build-page)

Your default payment link should be a page for an approved website thatincludes Paddle.js. It might be your checkout page, or you might create a separate page specifically for it.

[includes Paddle.js](/paddlejs/include-paddlejs)
> If your page callsPaddle.Checkout.open()on load with a list ofitemsor atransactionId, this takes priority over the query parameter.


If your page callsPaddle.Checkout.open()on load with a list ofitemsor atransactionId, this takes priority over the query parameter.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)

By default, Paddle.js opens an overlay checkout for the passed transaction. You canset default checkout settingsby passing them toPaddle.Initialize(). Paddle.js uses default settings when opening a checkout payment link.

[set default checkout settings](/build/checkout/set-up-checkout-default-settings#default-settings)
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)

This example sets default checkout settings for all checkouts opened on a page. When using a checkout payment link, Paddle.js opens an inline checkout with these settings.


```javascript
123456789101112131Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "inline",
6      theme: "light",
7      locale: "en",
8      frameTarget: "checkout-container",
9      frameInitialHeight: "450",
10      frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;"
11    }
12  }
13});
```


This example sets default checkout settings for all checkouts opened on a page. When using a checkout payment link, Paddle.js opens an overlay checkout with these settings.


Paddle.js opens an overlay checkout by default, but this is a good way topass additional settingslikelocaleandtheme.

[pass additional settings](/build/checkout/set-up-checkout-default-settings)

```javascript
123456789101Paddle.Initialize({
2  token: 'live_REDACTED_EXAMPLE_CLIENT_TOKEN', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "overlay",
6      theme: "light",
7      locale: "en"
8    }
9  }
10});
```


Grab the code fromthe overlay checkout tutorialto demo how opening a checkout using your default payment link works

[the overlay checkout tutorial](/build/checkout/build-overlay-checkout)

Copy this example into an editor, then replace the client-side token with a token from your system. Save and open in your browser, then append a_ptxnquery parameter with the value of a transaction ID to the URL to check that Paddle correctly opens a checkout for the transaction.


```html
12345678910111213141516171819201<!DOCTYPE html>
2<html lang="en" color-mode="user">
3<head>
4  <title>Overlay checkout demo</title>
5  <meta charset="utf-8">
6  <meta name="viewport" content="width=device-width, initial-scale=1">
7  <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
8  <style>
9    .page-container {
10      max-width: 900px;
11      margin: auto;
12      text-align: center;
13      margin-top: 2em;
14      padding-left: 1em;
15      padding-right: 1em;
16    }
17    .grid {
18      display: block;
19      margin-bottom: 1em;
20    }

```


Note that this page doesn't callPaddle.Checkout.open()on load. If you callPaddle.Checkout.open()with items or another transaction ID, this takes priority over the checkout payment link query parameter.

[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
> Usethe overlay checkout demo on CodePento test right away. Replace the client-side token with one from your system, then add?_ptxn=and the ID of a transaction from your Paddle system to the CodePen URL to preview.


Usethe overlay checkout demo on CodePento test right away. Replace the client-side token with one from your system, then add?_ptxn=and the ID of a transaction from your Paddle system to the CodePen URL to preview.

[the overlay checkout demo on CodePen](https://codepen.io/heymcgovern/pen/wvZMmGq)

## Set your default payment link

[Set your default payment link](/build/transactions/default-payment-link#set-default-link)

You can set your default payment link in the Paddle dashboard. You must set a default payment link — even if you only sell by invoice or only sell one-time products.

> Yoursandboxand live systems are separate. You should set a default payment link for both systems. They don't have to be the same.


Yoursandboxand live systems are separate. You should set a default payment link for both systems. They don't have to be the same.

[sandbox](/build/tools/sandbox)
1. Go toPaddle > Checkout > Checkout settings.

Go toPaddle > Checkout > Checkout settings.

1. Enter your website homepage under theDefault payment linkheading. If you don't have one, enterhttps://localhost/.

Enter your website homepage under theDefault payment linkheading. If you don't have one, enterhttps://localhost/.

1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Related pages

[Related pages](/build/transactions/default-payment-link#related-pages)
[Read more](/build/transactions/pass-transaction-checkout)
[Read more](/build/checkout/set-up-checkout-default-settings)
[Read more](/build/checkout/build-overlay-checkout)
- Set your default payment link
[Set your default payment link](#set-your-default-payment-link)
- How it works
[How it works](#background)
- Transaction payment links
[Transaction payment links](#background-payment-links)
- Payment method update links
[Payment method update links](#background-payment-method-update-links)
- Before you begin
[Before you begin](#prerequisites)
- Get your website approved
[Get your website approved](#prerequisites-domain-approval)
- Build your default payment link page
[Build your default payment link page](#build-page)
- Set your default payment link
[Set your default payment link](#set-default-link)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:18:31*
