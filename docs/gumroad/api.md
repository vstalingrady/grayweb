# Gumroad API Documentation (Full Scrape)

## Introduction

The Gumroad OAuth API is based around REST. We return JSON for every request, including errors.
To start using the API, you'll need to register your OAuth application. Note: The Verify License API endpoint does not require an OAuth application.
After creating an application, you'll be given a unique application id and application secret.

## Authentication

On the application page, click Generate access token to get the token you will use with the API.

## Scopes

We've provided six scopes that you may request when the user authorizes your application.

## API Errors

Gumroad uses HTTP status codes to indicate the status of a request.
200 OK everything worked as expected.
400 Bad Request you probably missed a required parameter.
401 Unauthorized you did not provide a valid access token.
402 Request Failed the parameters were valid but request failed.
404 Not Found the requested item doesn't exist.
500, 502, 503, 504 Server Error something else went wrong on our end.

Errors responses from the api will follow the following format:

```json
{ "success": false, "message": "The product could not be found." }
```

## Products

### Retrieve all products

`GET https://api.gumroad.com/v2/products`

```bash
curl https://api.gumroad.com/v2/products -d "access_token=ACCESS_TOKEN" -X GET
```

### Retrieve product details

`GET https://api.gumroad.com/v2/products/:id`

### Delete product

`DELETE https://api.gumroad.com/v2/products/:id`

## Variant categories

Retrieve, create, edit, and delete variant categories.

## Offer codes

Retrieve, create, edit, and delete offer codes.

## User

Retrieve the user's data.
`GET https://api.gumroad.com/v2/user`

## Resource subscriptions (Webhooks)

Subscribe to resources like "sale", "refund", "subscription_updated", "subscription_ended".
`PUT https://api.gumroad.com/v2/resource_subscriptions`

```bash
curl https://api.gumroad.com/v2/resource_subscriptions \
  -d "access_token=ACCESS_TOKEN" \
  -d "resource_name=sale" \
  -d "post_url=https://postatmebro.com" \
  -X PUT
```

## Sales

### Retrieve all sales

`GET https://api.gumroad.com/v2/sales`

### Retrieve sale details

`GET https://api.gumroad.com/v2/sales/:id`

## Subscribers

### Retrieve all subscribers for a product

`GET https://api.gumroad.com/v2/products/:product_id/subscribers`

### Retrieve subscriber details

`GET https://api.gumroad.com/v2/subscribers/:id`

## Licenses

### Verify a license

`POST https://api.gumroad.com/v2/licenses/verify`

```bash
curl https://api.gumroad.com/v2/licenses/verify \
  -d "product_id=32-nPAicqbLj8B_WswVlMw==" \
  -d "license_key=YOUR_CUSTOMERS_LICENSE_KEY" \
  -X POST
```

## Gumroad Ping (Webhooks)

Gumroad Ping is a simple alert that notifies you in real time whenever one of your products is purchased.
The ping comes in the form of an HTTP POST request to the URL specified in account settings. The payload is `x-www-form-urlencoded`.

### Retries

If the endpoint does not return a 200 OK, the POST is retried once an hour for up to 3 hours.

### Common Parameters

- `seller_id`: Your user ID.
- `product_id`: The ID of the product.
- `product_name`: The name of the product.
- `permalink`: The permalink of the product.
- `product_permalink`: The full URL of the product.
- `email`: The customer's email.
- `price`: The price in cents.
- `gumroad_fee`: The fee in cents.
- `currency`: The currency (e.g., "usd").
- `quantity`: The quantity purchased.
- `order_number`: The order number.
- `sale_id`: The ID for the sale.
- `sale_timestamp`: ISO 8601 timestamp.
- `purchaser_id`: The customer's ID.
- `subscription_id`: The ID for the subscription (if applicable).
- `variants`: Variant names/values.
- `license_key`: License key (if applicable).
- `ip_country`: The customer's country.
- `recurrence`: "monthly", "yearly", etc.
- `refunded`: Boolean.
- `disputed`: Boolean.
- `chargebacked`: Boolean.
- `subscription_ended_at`: ISO 8601 timestamp.
- `subscription_cancelled_at`: ISO 8601 timestamp.
- `subscription_failed_at`: ISO 8601 timestamp.
