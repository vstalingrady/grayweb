# Authentication

**Source:** https://developer.paddle.com/api-reference/about/authentication

---

- Overview
[Overview](/api-reference/overview)
- Authentication
- Authentication
[Authentication](/api-reference/about/authentication)
- Permissions
[Permissions](/api-reference/about/permissions)
- Manage API keys
[Manage API keys](/api-reference/about/api-keys)
- Rotate API keys
[Rotate API keys](/api-reference/about/rotate-api-keys)
- Core concepts
- Versioning
[Versioning](/api-reference/about/versioning)
- Paddle IDs
[Paddle IDs](/api-reference/about/paddle-ids)
- Data types
[Data types](/api-reference/about/data-types)
- Custom data
[Custom data](/api-reference/about/custom-data)
- Rate limiting
[Rate limiting](/api-reference/about/rate-limiting)
- Query & retrieval
- Default scopes
[Default scopes](/api-reference/about/default-scopes)
- Related entities
[Related entities](/api-reference/about/include-entities)
- Filter and sort
[Filter and sort](/api-reference/about/filter-search-sort)
- Pagination
[Pagination](/api-reference/about/pagination)
- Response handling
- Success responses
[Success responses](/api-reference/about/success-responses)
- Errors
[Errors](/api-reference/about/errors)
- Entity management
- Work with lists
[Work with lists](/api-reference/about/lists)
- Delete entities
[Delete entities](/api-reference/about/delete-archive-entities)
- Entities
- Products
- Prices
- Discounts
- Discount groups
- Customers
- Addresses
- Businesses
- Payment methods
- Customer portal sessions
- Transactions
- Subscriptions
- Adjustments
- Pricing preview
- Client-side tokens
- Reports
- Event types
- Events
- Notification settings
- Notifications
- Notification logs
- Simulation types
- Simulations
- Simulation runs
- Simulation run events

# Authentication

[Authentication](/api-reference/about/authentication#authentication)

Use Bearer authentication with API keys when making requests to the Paddle API.


Paddle offers two types of authentication credentials:


#### API keys

[API keys](/api-reference/about/authentication#api-keys)

Used to interact with the Paddle API in your backend. For example, building subscription upgrade and downgrade workflows.

- Intended only for server-side use.
- Has full access to your data, limited only by the permissions assigned to the API key.
- Must be kept secure and secret.

#### Client-side tokens

[Client-side tokens](/api-reference/about/authentication#client-side-tokens)

Used to work with Paddle.js in your frontend. For example, launching a checkout and previewing prices or transactions.

- Intended only for client-side use.
- Limited to opening checkouts, previewing prices, and previewing transactions.
- Safe to publish in your app code.
> This reference is about authenticating requests to the Paddle API in your backend. Don't call the Paddle API directly in your frontend. UsePaddle.jswithclient-side tokensinstead.


This reference is about authenticating requests to the Paddle API in your backend. Don't call the Paddle API directly in your frontend. UsePaddle.jswithclient-side tokensinstead.

[Paddle.js](/paddlejs/include-paddlejs)
[client-side tokens](/paddlejs/client-side-tokens)

## Get an API key

[Get an API key](/api-reference/about/authentication#get-api-key)

AnAPI keyis required to authenticate requests to the Paddle API.

[API key](/api-reference/about/api-keys)
1. Create an API keyKeys can be created for eithersandbox or live environments. Go toPaddle > Developer tools > Authenticationto create a key.

Create an API key

[Create an API key](/api-reference/about/api-keys#create-api-key)

Keys can be created for eithersandbox or live environments. Go toPaddle > Developer tools > Authenticationto create a key.

[sandbox or live environments](/api-reference/about/api-keys#sandbox-vs-live-keys)
1. Assign permissionsPermissions control what entities and operations the API key can access. Requests by keys without the required permissions fail with aforbiddenerror (403).

Assign permissions

[Assign permissions](/api-reference/about/api-keys#permissions)

Permissions control what entities and operations the API key can access. Requests by keys without the required permissions fail with aforbiddenerror (403).

[forbidden](/errors/shared/forbidden)
1. Check formatYour API key should be 69 characters long, be prefixed withpdl_, containapikey_, and containsdbx_orlive_depending on the environment.

Check format

[Check format](/api-reference/about/api-keys#format)

Your API key should be 69 characters long, be prefixed withpdl_, containapikey_, and containsdbx_orlive_depending on the environment.

> Treat your API key like a password. Keep it safe and never share it with apps or people you don't trust.


Treat your API key like a password. Keep it safe and never share it with apps or people you don't trust.


## Authenticate requests

[Authenticate requests](/api-reference/about/authentication#authenticate-requests)

All requests to the Paddle API require authentication unless explicitly stated. The API uses Bearer authentication.


To authenticate, pass your Paddle API key using theAuthorizationheader and theBearerprefix. For example:


```bash
11Authorization: Bearer pdl_live_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO
```


Endpoints in the API have anAccess-Control-Allow-Originheader to block direct access from browsers.


## Test authentication

[Test authentication](/api-reference/about/authentication#test-authentication)

The quickest way to test authentication is to send a request to the/event-typesendpoint. This endpoint returns data even without any entities in Paddle and doesn't require any permissions.


```bash
11curl https://api.paddle.com/event-types -H "Authorization: Bearer pdl_live_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO"
```


### Response

[Response](/api-reference/about/authentication#test-authentication-response)

If successful, you should get a response that includes adataarray and ametaobject.


```json
12345678910111213141516171819201{
2  "data": [
3    {
4      "name": "transaction.billed",
5      "description": "Occurs when a transaction is billed. Its status field changes to billed and billed_at is populated.",
6      "group": "Transaction",
7      "available_versions": [
8        1
9      ]
10    },
11    {
12      "name": "transaction.canceled",
13      "description": "Occurs when a transaction is canceled. Its status field changes to canceled.",
14      "group": "Transaction",
15      "available_versions": [
16        1
17      ]
18    },
19    {
20      "name": "transaction.completed",

```


If unsuccessful, Paddle returns a 403 error with information about what went wrong and how to troubleshoot.

> Check thepermissions assigned to your API keyatPaddle > Developer tools > Authenticationto ensure the key works with the endpoint you're trying to access.


Check thepermissions assigned to your API keyatPaddle > Developer tools > Authenticationto ensure the key works with the endpoint you're trying to access.

[permissions assigned to your API key](/api-reference/about/permissions)

## Common errors

[Common errors](/api-reference/about/authentication#common-errors)

| authentication_missing | The request doesn't include anAuthorizationheader. Check that you're provided a header using Bearer authentication in your request. |
| authentication_malformed | TheAuthorizationheader is in the wrong format. Check that you set theAuthorizationheader toBearer <INSERT_API_KEY>. |
| invalid_token | The API key you're trying to access isn't correct. Check that you have provided thecorrect API key, that it's in thecorrect environment, and that it hasn't beenrevoked. |
| forbidden | The API key you're trying to use doesn't have the required permissions to perform the requested action. Check that the API key has the necessarypermissions. |

[authentication_missing](/errors/shared/authentication_missing)
[authentication_malformed](/errors/shared/authentication_malformed)
[invalid_token](/errors/shared/invalid_token)
[correct API key](/api-reference/about/api-keys#format)
[correct environment](/api-reference/about/api-keys#sandbox-vs-live-keys)
[revoked](/api-reference/about/api-keys#revoke-api-key)
[forbidden](/errors/shared/forbidden)
[permissions](/api-reference/about/api-keys#permissions)

## Related pages

[Related pages](/api-reference/about/authentication#related-pages)
[Read more](/api-reference/about/versioning)
[Read more](/api-reference/about/errors)
- Authentication
[Authentication](#authentication)
- Get an API key
[Get an API key](#get-api-key)
- Authenticate requests
[Authenticate requests](#authenticate-requests)
- Test authentication
[Test authentication](#test-authentication)
- Response
[Response](#test-authentication-response)
- Common errors
[Common errors](#common-errors)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:24:40*
