# Manage client-side tokens

**Source:** https://developer.paddle.com/paddlejs/client-side-tokens

---

- Overview
[Overview](/paddlejs/overview)
- Setup & Authentication
- Manage client-side tokens
[Manage client-side tokens](/paddlejs/client-side-tokens)
- Include and initialize Paddle.js
[Include and initialize Paddle.js](/paddlejs/include-paddlejs)
- Test Retain x Paddle.js
[Test Retain x Paddle.js](/paddlejs/test-retain)
- Methods
- Paddle.Initialize()
[Paddle.Initialize()](/paddlejs/methods/paddle-initialize)
- Paddle.Update()
[Paddle.Update()](/paddlejs/methods/paddle-update)
- Paddle.Environment.set()
[Paddle.Environment.set()](/paddlejs/methods/paddle-environment-set)
- Paddle.Checkout.open()
[Paddle.Checkout.open()](/paddlejs/methods/paddle-checkout-open)
- Paddle.Checkout.updateCheckout()
[Paddle.Checkout.updateCheckout()](/paddlejs/methods/paddle-checkout-updatecheckout)
- Paddle.Checkout.updateItems()
[Paddle.Checkout.updateItems()](/paddlejs/methods/paddle-checkout-updateitems)
- Paddle.Checkout.close()
[Paddle.Checkout.close()](/paddlejs/methods/paddle-checkout-close)
- Paddle.PricePreview()
[Paddle.PricePreview()](/paddlejs/methods/paddle-pricepreview)
- Paddle.Retain.demo()
[Paddle.Retain.demo()](/paddlejs/methods/paddle-retain-demo)
- Paddle.Retain.initCancellationFlow()
[Paddle.Retain.initCancellationFlow()](/paddlejs/methods/paddle-retain-initcancellationflow)
- Paddle.Spinner.show()
[Paddle.Spinner.show()](/paddlejs/methods/paddle-spinner-show)
- Paddle.Spinner.hide()
[Paddle.Spinner.hide()](/paddlejs/methods/paddle-spinner-hide)
- Paddle.Status.libraryVersion
[Paddle.Status.libraryVersion](/paddlejs/methods/paddle-status-libraryversion)
- Paddle.TransactionPreview()
[Paddle.TransactionPreview()](/paddlejs/methods/paddle-transactionpreview)
- Hosted checkouts
- URL parameters
[URL parameters](/paddlejs/hosted-checkout-url-parameters)
- HTML data attributes
- HTML data attributes
[HTML data attributes](/paddlejs/html-data-attributes)
- Events
- Overview
[Overview](/paddlejs/events/overview)
- General
- Items
- Customer
- Payment
- Discount
- Upsell

# Manage client-side tokens

[Manage client-side tokens](/paddlejs/client-side-tokens#manage-client-side-tokens)

Create, update, and revoke client-side tokens used to initialize Paddle.js in your frontend.


Client-side tokens let you interact with the Paddle platform in frontend code, like webpages or mobile apps.

- They're intended only for client-side use.
- They're limited to opening checkouts, previewing prices, and previewing transactions.
- They're safe to publish and expose in your code.

By integrating with Paddle.js using client-side tokens, you are able to open checkouts, build custom checkout experiences, and preview prices in a pricing page.

> Looking to integrate Paddle in your backend? Use thePaddle APIwithAPI keysinstead.


Looking to integrate Paddle in your backend? Use thePaddle APIwithAPI keysinstead.

[Paddle API](/api-reference/overview)
[API keys](/api-reference/about/api-keys)

## How it works

[How it works](/paddlejs/client-side-tokens#background)

When youinitialize Paddle.js, you include a client-side token. Paddle uses your client-side token to identify your account and verify that you have permission to perform the requested action.

[initialize Paddle.js](/paddlejs/include-paddlejs)

```html
1234561<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Initialize({ 
4    token: 'live_7d279f61a3499fed520f7cd8c08' // replace with a client-side token
5  });
6</script>
```

> Never useAPI keyswith Paddle.js. API keys should be kept secret and away from the frontend.Revoke the keyif it has been compromised. Useclient-side tokensstarting withtest_orlive_.


Never useAPI keyswith Paddle.js. API keys should be kept secret and away from the frontend.Revoke the keyif it has been compromised. Useclient-side tokensstarting withtest_orlive_.

[API keys](/api-reference/about/api-keys#format)
[Revoke the key](/api-reference/about/api-keys#revoke-api-key)
[client-side tokens](/paddlejs/client-side-tokens)
`test_`
`live_`

### Sandbox vs live workspaces

[Sandbox vs live workspaces](/paddlejs/client-side-tokens#sandbox-vs-live-tokens)

Paddle has separatesandboxand live workspaces, each with their own set of client-side tokens. This separation helps you safely test your integration without affecting real customer data or transactions.

[sandbox](/build/tools/sandbox)

#### Sandbox client-side tokens

[Sandbox client-side tokens](/paddlejs/client-side-tokens#sandbox-client-side-tokens)
- Use these tokens as you build and test your integration.

Use these tokens as you build and test your integration.

- They only work in the sandbox environment where no real money is involved.

They only work in the sandbox environment where no real money is involved.

- Sandbox client-side tokens containtest_.

Sandbox client-side tokens containtest_.

- Create a sandbox client-side token in thesandbox dashboard.

Create a sandbox client-side token in thesandbox dashboard.

[sandbox dashboard](https://sandbox-vendors.paddle.com/authentication-v2)

#### Live client-side tokens

[Live client-side tokens](/paddlejs/client-side-tokens#live-client-side-tokens)
- Use these tokens only when you're ready to process real transactions in your production app.

Use these tokens only when you're ready to process real transactions in your production app.

- They only work in the live environment where real money is involved.

They only work in the live environment where real money is involved.

- Live client-side tokens containlive_.

Live client-side tokens containlive_.

- Create a live client-side token in thelive dashboard.

Create a live client-side token in thelive dashboard.

[live dashboard](https://vendors.paddle.com/authentication-v2)

### Format

[Format](/paddlejs/client-side-tokens#format)

Client-side tokens always follow a specific format.

- Always start withtest_orlive_to show theenvironmentthey're used for.
[environment](/paddlejs/client-side-tokens#sandbox-vs-live-tokens)
- Contains a random string of 27 characters in length after the environment prefix.

```bash
121test_4s7gd50ap72ms92nnsa20ma61lt
2live_7d279f61a3499fed520f7cd8c08
```


```bash
11^(test|live)_[a-zA-Z0-9]{27}$
```


## Create a client-side token

[Create a client-side token](/paddlejs/client-side-tokens#create-client-side-token)
1. Go toPaddle > Developer Tools > Authentication.

Go toPaddle > Developer Tools > Authentication.

1. Click theClient-side tokenstab.

Click theClient-side tokenstab.

1. ClickNew client-side token

ClickNew client-side token

1. Enter a name and description for the client-side token.

Enter a name and description for the client-side token.

1. ClickSavewhen you're done.

ClickSavewhen you're done.

1. Click theoverflow buttonbutton next to the client-side token you want to use, then chooseCopy

Click theoverflow buttonbutton next to the client-side token you want to use, then chooseCopy

> You're ready to use the client-side token toinitialize Paddle.js.


You're ready to use the client-side token toinitialize Paddle.js.

[initialize Paddle.js](/paddlejs/include-paddlejs)

## Revoke a client-side token

[Revoke a client-side token](/paddlejs/client-side-tokens#revoke-client-side-token)

Client-side tokens are safe to expose publicly in your frontend code. However, you may still want to revoke a token so it can no longer be used to authenticate Paddle.js.

> Revoking a token is a permanent action.  Make sure your client-side token isn't still used in production before revoking it to prevent disruption to customers.


Revoking a token is a permanent action.  Make sure your client-side token isn't still used in production before revoking it to prevent disruption to customers.

1. Go toPaddle > Developer Tools > Authentication.

Go toPaddle > Developer Tools > Authentication.

1. Click theClient-side tokenstab.

Click theClient-side tokenstab.

1. Click theoverflow buttonbutton next to the client-side token you want to revoke, then chooseRevoke

Click theoverflow buttonbutton next to the client-side token you want to revoke, then chooseRevoke

1. Confirm you want to revoke the client-side token by filling in the confirmation box.

Confirm you want to revoke the client-side token by filling in the confirmation box.


## Events

[Events](/paddlejs/client-side-tokens#related-notifications)

| client_token.created | Occurs when a client-side token is created. |
| client_token.updated | Occurs when a client-side token is updated with astatusofrevoked. |
| client_token.revoked | Occurs when a client-side token is revoked. |

[client_token.created](/webhooks/transactions/transaction-created)
[client_token.updated](/webhooks/transactions/transaction-updated)
[client_token.revoked](/webhooks/transactions/transaction-ready)

## Related pages

[Related pages](/paddlejs/client-side-tokens#related-pages)
[Read more](/paddlejs/include-paddlejs)
[Read more](/paddlejs/methods/paddle-initialize)
[Read more](/build/checkout/set-up-checkout-default-settings)
- Manage client-side tokens
[Manage client-side tokens](#manage-client-side-tokens)
- How it works
[How it works](#background)
- Sandbox vs live workspaces
[Sandbox vs live workspaces](#sandbox-vs-live-tokens)
- Format
[Format](#format)
- Create a client-side token
[Create a client-side token](#create-client-side-token)
- Revoke a client-side token
[Revoke a client-side token](#revoke-client-side-token)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:20:33*
