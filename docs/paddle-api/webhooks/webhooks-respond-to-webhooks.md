# Handle webhook delivery

**Source:** https://developer.paddle.com/webhooks/respond-to-webhooks

---

- Overview
[Overview](/webhooks/overview)
- How-to
- Create a notification destination
[Create a notification destination](/webhooks/notification-destinations)
- Handle webhook delivery
[Handle webhook delivery](/webhooks/respond-to-webhooks)
- Verify signatures
[Verify signatures](/webhooks/signature-verification)
- Simulate webhooks
[Simulate webhooks](/webhooks/test-webhooks)
- Scenarios
- Subscription created
[Subscription created](/webhooks/scenarios/subscription-created)
- Subscription renewed
[Subscription renewed](/webhooks/scenarios/subscription-renewed)
- Subscription paused
[Subscription paused](/webhooks/scenarios/subscription-paused)
- Subscription resumed
[Subscription resumed](/webhooks/scenarios/subscription-resumed)
- Subscription canceled
[Subscription canceled](/webhooks/scenarios/subscription-canceled)
- Notifications
- Addresses
- Adjustments
- API keys
- API key exposures
- Businesses
- Client-side tokens
- Customers
- Discounts
- Discount groups
- Payment methods
- Payouts
- Prices
- Products
- Reports
- Subscriptions
- Transactions

# Handle webhook delivery

[Handle webhook delivery](/webhooks/respond-to-webhooks#handle-webhook-delivery)

Properly handle notifications by making sure your webhook event server is configured correctly, and responding within five seconds.


Once you've created a notification destination, you should properly handle webhook delivery to make sure your integration performs well.


## How it works

[How it works](/webhooks/respond-to-webhooks#background)

Webhookslet you subscribe to events in Paddle. When a subscribed event occurs, Paddle sends a notification toa webhook endpoint that you specify.

[Webhooks](/webhooks/overview)
[a webhook endpoint that you specify](/webhooks/notification-destinations)

You can use notifications to keep your app in sync with Paddle, or to integrate with third-party systems. For example, when asubscription cancels, Paddle can send you asubscription.canceledwebhook. When you receive this webhook, you can provision your app to make sure the canceled customer can no longer access your app.

[subscription cancels](/build/subscriptions/cancel-subscriptions)
[subscription.canceled](/webhooks/subscriptions/subscription-canceled)

To make sure your app or integration performs well, you should properly handle webhook delivery by making sure your webhook server is configured correctly, responding to notifications promptly, and handling retries.


## Before you begin

[Before you begin](/webhooks/respond-to-webhooks#prerequisites)

### Create a notification destination

[Create a notification destination](/webhooks/respond-to-webhooks#prerequisites-create-notification-setting)

Create a notification destinationwhere the type isurl(webhook), if you haven't already.

[Create a notification destination](/webhooks/notification-destinations)

## Allow Paddle IP addresses

[Allow Paddle IP addresses](/webhooks/respond-to-webhooks#allow-paddle-ips)

You should make sure that webhooks originate from a Paddle webhook IP address. We recommend adding Paddle webhook IP addresses to your allowlist, and rejecting webhooks that come from other sources.


Allow different IP addresses forsandboxandliveaccounts:


#### Sandbox

[Sandbox](/webhooks/respond-to-webhooks#sandbox)

Yoursandbox accountis for evaluation and testing. All transactions are tests, meaning transactions are simulated and any money isn't real.

[sandbox account](/build/tools/sandbox)

```undefined
123456134.194.127.46
254.234.237.108
33.208.120.145
444.226.236.210
544.241.183.62
6100.20.172.113
```


#### Live

[Live](/webhooks/respond-to-webhooks#live)

Your live account is where customers can make purchases. Transactions are real, meaning payment methods are charged and you earn real money.


```undefined
123456134.232.58.13
234.195.105.136
334.237.3.244
435.155.119.135
552.11.166.252
634.212.5.7
```


If you're using a Web Application Firewall (WAF) to protect your web server from bot traffic, requests from Paddle may be blocked incorrectly. We recommend configuring your firewall to bypass bot checks on webhook endpoint paths. Additionally, use Paddle IP addresses and matchPaddleas the user agent string to further restrict your rule.


## Configure your webhook handler

[Configure your webhook handler](/webhooks/respond-to-webhooks#configure-webhook-handler)

To receive webhooks, make sure your webhook event server:

- Uses HTTPS
- Can acceptPOSTrequests with a JSON payload
- Returns200withinfive secondsof receiving a request

We recommend configuring your handler to process webhooks asynchronously by queueing received events and processing them in order. This helps prevent a large spike in webhooks from overwhelming your server.


## Respond to events

[Respond to events](/webhooks/respond-to-webhooks#respond-events)

The server that you set to receive events from Paddle should respond with an HTTP200status code within five seconds. This lets Paddle know that you successfully received the message.


You should respond before doing any internal processing. For example, if you use a webhook to update a record in a third-party system, respond with a200before running any logic to communicate with the third-party solution.


If you're running your webhook handler on Vercel Serverless Functions, AWS Lambda, Google Cloud Functions, or similar serverless platforms, consider pre-warming your function to prevent cold starts that might cause intermittent timeouts.


We can't guarantee the order of delivery for webhooks. They may be delivered in a different order to the order they're generated. Store and check theoccurred_atdate against a webhook before making changes.


## Handle retries

[Handle retries](/webhooks/respond-to-webhooks#handle-retries)

If your server sends another kind of status code or doesn't respond within five seconds, Paddle automatically retries using an exponential backoff schedule:

- For sandbox accounts, we retry 3 times within 15 minutes.
- For live accounts, we retry 60 times within 3 days. The first 20 attempts happen in the first hour, with 47 in the first day and 60 in total.

Usean exponential backoff calculatorto visualize retries from the date now. Use these values:

[an exponential backoff calculator](https://exponentialbackoffcalculator.com/)

| Interval (secs) | 60 |
| Max retries | 60 |
| Exponential | 1.1 |


You can check the status of a webhook and see delivery attempts using the Paddle dashboard, or by using thelist logs for a notification operationin the Paddle API.

[list logs for a notification operation](/api-reference/notification-logs/list-notification-logs)

When all attempts to deliver a webhook are exhausted, its status is set tofailed. You can attempt to redeliver a notification using thereplay a notification operationin the Paddle API.

[replay a notification operation](/api-reference/notifications/replay-notification)

## Verify webhook signatures

[Verify webhook signatures](/webhooks/respond-to-webhooks#verify-webhooks)

Use thePaddle-Signatureheader included with each webhook toverify that received eventsare genuinely sent by Paddle.

[verify that received events](/webhooks/signature-verification)

## Test your handler

[Test your handler](/webhooks/respond-to-webhooks#test-your-handler)

### Send simulated webhooks to your handler

[Send simulated webhooks to your handler](/webhooks/respond-to-webhooks#send-simulated-test-events)

Test your webhook handler by sending simulated events to your endpoint using thewebhook simulator. You can customize payloads, inspect event details, and replay simulations as part of your testing process.

[webhook simulator](/webhooks/test-webhooks)

### Forward events to a local endpoint

[Forward events to a local endpoint](/webhooks/respond-to-webhooks#local-testing-test-your-handler)

Notification destinations require public-facing URLs. If you're developing locally, you can expose your local development server to the internet using a service likeHookdeck CLI:

[Hookdeck CLI](https://hookdeck.com/docs/cli)
1. InstallHookdeck CLI.

InstallHookdeck CLI.

[Hookdeck CLI](https://hookdeck.com/docs/cli#installation)
1. Run your local server. Note the port your local server is running on.

Run your local server. Note the port your local server is running on.

1. Runhookdeck listen {PORT} paddle --path {WEBHOOK_ENDPOINT_PATH}, where{PORT}is the port where your local server is running and{WEBHOOK_ENDPOINT_PATH}is the path to your webhook handler. For example:11hookdeck listen3000paddle --path /api/webhook

Runhookdeck listen {PORT} paddle --path {WEBHOOK_ENDPOINT_PATH}, where{PORT}is the port where your local server is running and{WEBHOOK_ENDPOINT_PATH}is the path to your webhook handler. For example:


```bash
11hookdeck listen 3000 paddle --path /api/webhook
```

1. Use the unique URL generated by Hookdeck CLI as your webhook endpoint URL whencreating or updating a notification destination.

Use the unique URL generated by Hookdeck CLI as your webhook endpoint URL whencreating or updating a notification destination.

[creating or updating a notification destination](/webhooks/notification-destinations)
[Learn more about using the Hookdeck CLI to test and replay Paddle webhooks events on the Hookdeck docs.](https://hookdeck.com/webhooks/platforms/how-to-test-and-replay-paddle-webhooks-events-on-localhost-with-hookdeck)

Learn more about using the Hookdeck CLI to test and replay Paddle webhooks events on the Hookdeck docs.


## Related pages

[Related pages](/webhooks/respond-to-webhooks#related-pages)
[Read more](/webhooks/signature-verification)
[Read more](/webhooks/notification-destinations)
- Handle webhook delivery
[Handle webhook delivery](#handle-webhook-delivery)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Create a notification destination
[Create a notification destination](#prerequisites-create-notification-setting)
- Allow Paddle IP addresses
[Allow Paddle IP addresses](#allow-paddle-ips)
- Configure your webhook handler
[Configure your webhook handler](#configure-webhook-handler)
- Respond to events
[Respond to events](#respond-events)
- Handle retries
[Handle retries](#handle-retries)
- Verify webhook signatures
[Verify webhook signatures](#verify-webhooks)
- Test your handler
[Test your handler](#test-your-handler)
- Send simulated webhooks to your handler
[Send simulated webhooks to your handler](#send-simulated-test-events)
- Forward events to a local endpoint
[Forward events to a local endpoint](#local-testing-test-your-handler)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:13:32*
