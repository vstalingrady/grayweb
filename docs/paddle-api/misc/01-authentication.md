# Authentication

Use Bearer authentication with API keys when making requests to the Paddle API.

## Types of Authentication Credentials

Paddle offers two types of authentication credentials:

### API Keys

Used to interact with the Paddle API in your backend. For example, building subscription upgrade and downgrade workflows.

- **Intended only for server-side use**
- Has full access to your data, limited only by the permissions assigned to the API key
- **Must be kept secure and secret**

### Client-Side Tokens

Used to work with Paddle.js in your frontend. For example, launching a checkout and previewing prices or transactions.

- **Intended only for client-side use**
- Limited to opening checkouts, previewing prices, and previewing transactions
- Safe to publish in your app code

> **Important**: This reference is about authenticating requests to the Paddle API in your backend. Don't call the Paddle API directly in your frontend. Use [Paddle.js](https://developer.paddle.com/paddlejs/include-paddlejs) with [client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens) instead.

## Get an API Key

An API key is required to authenticate requests to the Paddle API.

### 1. Create an API Key

Keys can be created for either sandbox or live environments. Go to **Paddle > Developer tools > Authentication** to create a key.

### 2. Assign Permissions

Permissions control what entities and operations the API key can access. Requests by keys without the required permissions fail with a `forbidden` error (403).

### 3. Check Format

Your API key should be:

- 69 characters long
- Prefixed with `pdl_`
- Contain `apikey_`
- Contain `sdbx_` (sandbox) or `live_` (live) depending on the environment

> **Security Warning**: Treat your API key like a password. Keep it safe and never share it with apps or people you don't trust.

## Authenticate Requests

All requests to the Paddle API require authentication unless explicitly stated. The API uses Bearer authentication.

To authenticate, pass your Paddle API key using the `Authorization` header and the `Bearer` prefix. For example:

```bash
Authorization: Bearer pdl_live_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO
```

Endpoints in the API have an `Access-Control-Allow-Origin` header to block direct access from browsers.

## Test Authentication

The quickest way to test authentication is to send a request to the `/event-types` endpoint. This endpoint returns data even without any entities in Paddle and doesn't require any permissions.

```bash
curl https://api.paddle.com/event-types -H "Authorization: Bearer pdl_live_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO"
```

### Response

If authentication is successful, you'll receive a response with a list of event types:

```json
{
  "data": [
    {
      "name": "subscription.created",
      "description": "Occurs when a subscription is created.",
      "group": "subscription",
      "available_versions": [1]
    },
    // ... more event types
  ],
  "meta": {
    "request_id": "9346b365-4cad-43a6-b7c1-48ff6a1c7836"
  }
}
```

## Common Errors

| Error Code | Status | Description |
|------------|--------|-------------|
| `unauthorized` | 401 | API key is missing or invalid |
| `forbidden` | 403 | API key doesn't have the required permissions |
| `authentication_malformed` | 401 | Authorization header is malformed |

## Related Pages

- [Manage API keys](https://developer.paddle.com/api-reference/about/api-keys)
- [Permissions](https://developer.paddle.com/api-reference/about/permissions)
- [Rotate API keys](https://developer.paddle.com/api-reference/about/rotate-api-keys)
- [Errors](https://developer.paddle.com/api-reference/about/errors)
