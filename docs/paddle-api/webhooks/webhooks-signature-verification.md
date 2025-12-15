# Verify webhook signatures

**Source:** https://developer.paddle.com/webhooks/signature-verification

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

# Verify webhook signatures

[Verify webhook signatures](/webhooks/signature-verification#verify-webhook-signatures)

Check that received events are genuinely sent from Paddle by verifying webhook signatures.


For security, verify webhook signatures to make sure received webhooks are genuinely sent from Paddle. This helps you be sure they haven't been tampered with in-transit.


## How it works

[How it works](/webhooks/signature-verification#background)

Webhookslet you subscribe to events in Paddle. When a subscribed event occurs, Paddle sends a notification toa webhook endpoint that you specify.

[Webhooks](/webhooks/overview)
[a webhook endpoint that you specify](/webhooks/notification-destinations)

All webhooks sent by Paddle include aPaddle-Signatureheader. Paddle generates this header using a secret key that only you and Paddle know.


To verify, you can use the secret key to generate your own signature for each webhook. Since only you and Paddle know the secret key, if both signatures match then you can be sure that a received event came from Paddle.


## Before you begin

[Before you begin](/webhooks/signature-verification#prerequisites)

### Create a notification destination

[Create a notification destination](/webhooks/signature-verification#prerequisites-create-notification-setting)

Create a notification destinationwhere the type isurl(webhook), if you haven't already.

[Create a notification destination](/webhooks/notification-destinations)

### Get your secret key

[Get your secret key](/webhooks/signature-verification#prerequisites-secret-key)

To verify webhooks, you'll need to get the secret key for your notification destination.


Paddle generates a secret key for each notification destination that you create. If you've created more than one notification destination, get keys for each notification destination that you want to verify signatures for.

> Treat your endpoint secret key like a password. Keep it safe and never share it with apps or people you don't trust.


Treat your endpoint secret key like a password. Keep it safe and never share it with apps or people you don't trust.


Send a GET request to the/notification-settings/{notification_setting_id}endpoint.


Paddle ID of the notification entity to work with.


#### Response

[Response](/webhooks/signature-verification#response-get-secret-key)

If successful, Paddle returns the notification destination settings, including theendpoint_secret_key. For example:


```json
12131415161718192021222324252612      {
13        "name": "subscription.past_due",
14        "description": "Occurs when a subscription is past due.",
15        "group": "Subscription",
16        "available_versions": [
17          1
18        ]
19      }
20    ],
21    "endpoint_secret_key": "pdl_ntfset_01gkpjp8bkm3tm53kdgkx6sms7_a7e4a56cf7c1cd80cb1c735c72bab2aa75d06fe08b8c50a18cf6afbcfe834122"
22  },
23  "meta": {
24    "request_id": "968bf13b-ca51-4a9c-934a-1760b298620d"
25  }
26}
```


## Overview

[Overview](/webhooks/signature-verification#get-started)

Verify webhook signatures in one of two ways:

- Verify using Paddle SDKs (recommended)Use helper functions or classes in our official SDKs to verify webhook signatures.

Verify using Paddle SDKs (recommended)

[Verify using Paddle SDKs (recommended)](/webhooks/signature-verification#verify-sdks)

Use helper functions or classes in our official SDKs to verify webhook signatures.

- Verify manuallyBuild your own logic to verify webhook signatures.

Verify manually

[Verify manually](/webhooks/signature-verification#verify-manually)

Build your own logic to verify webhook signatures.


## Verify using Paddle SDKs

[Verify using Paddle SDKs](/webhooks/signature-verification#verify-sdks)

Use our official SDKs to verify webhook signatures. You'll need to provide the event payload,Paddle-Signatureheader, and the endpoint secret key.

> Don't transform or process the raw body of the request, including adding whitespace or applying other formatting. This results in a different signed payload, meaning signatures won't match when you compare.


Don't transform or process the raw body of the request, including adding whitespace or applying other formatting. This results in a different signed payload, meaning signatures won't match when you compare.


You can use a middleware to verify the signature of an incoming request before processing it.


```go
123456789101112131verifier := paddle.NewWebhookVerifier(os.Getenv("WEBHOOK_SECRET_KEY"))
2// Wrap your handler with the verifier.Middleware method
3handler := verifier.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
4    // The request making it this far means the webhook was verified
5    // Best practice here is to check if you have processed this webhook already using the event id
6    // At this point you should store for async processing
7    // For example a local queue or db entry
8
9    // Respond as soon as possible with a 200 OK
10    w.Header().Set("Content-Type", "application/json")
11    w.WriteHeader(http.StatusOK)
12    w.Write([]byte(`{"success": true}`))
13}))
```


You can also verify the signature of an incoming request manually.


```go
1231webhookVerifier := paddle.NewWebhookVerifier(os.Getenv("WEBHOOK_SECRET_KEY"))
2// Note: the request (req *http.Request) should be pass exactly as it comes without altering it.
3ok, err := webhookVerifier.Verify(req)
```

[@PaddleHQ/paddle-go-sdkLearn more and clone the Paddle Go SDK on GitHub.](https://github.com/PaddleHQ/paddle-go-sdk/)

@PaddleHQ/paddle-go-sdkLearn more and clone the Paddle Go SDK on GitHub.

> To prevent replay attacks, our SDK helper methods check the timestamp (ts) against the current time and reject events that are too old. The default tolerance between the timestamp and the current time is five seconds.


To prevent replay attacks, our SDK helper methods check the timestamp (ts) against the current time and reject events that are too old. The default tolerance between the timestamp and the current time is five seconds.


## Verify manually

[Verify manually](/webhooks/signature-verification#verify-manually)

Build your own logic to verify webhook signatures from Paddle in five steps:

1. Get Paddle-Signature headerGet thePaddle-Signatureheader from an incoming webhook sent by Paddle.

Get Paddle-Signature header

[Get Paddle-Signature header](/webhooks/signature-verification#get-header)

Get thePaddle-Signatureheader from an incoming webhook sent by Paddle.

1. Extract timestamp and signature from the headerParse the header to extract its timestamp and signature values.

Extract timestamp and signature from the header

[Extract timestamp and signature from the header](/webhooks/signature-verification#extract-ts-h1)

Parse the header to extract its timestamp and signature values.

1. Build the signed payloadConcatenate the extracted timestamp with the raw body of the request to build a signed payload.

Build the signed payload

[Build the signed payload](/webhooks/signature-verification#build-signed-payload)

Concatenate the extracted timestamp with the raw body of the request to build a signed payload.

1. Hash the signed payloadHash the signed payload you built to generate a signature that you can use for comparison.

Hash the signed payload

[Hash the signed payload](/webhooks/signature-verification#hash-signed-payload)

Hash the signed payload you built to generate a signature that you can use for comparison.

1. Compare your signaturesCompare thePaddle-Signatureheader to the signature you just computed.

Compare your signatures

[Compare your signatures](/webhooks/signature-verification#compare-signatures)

Compare thePaddle-Signatureheader to the signature you just computed.


### Examples

[Examples](/webhooks/signature-verification#examples-verify-manually)

These code snippets demonstrate how to verify webhooks manually.


```typescript
12345678910111213141516171819201import express, { Request, Response } from "express";
2import { createHmac, timingSafeEqual } from "crypto";
3import dotenv from "dotenv";
4
5dotenv.config();
6const app = express();
7
8// Create a `POST` endpoint to accept webhooks sent by Paddle.
9// We need `raw` request body to validate the integrity. Use express raw middleware to ensure express doesn't convert the request body to JSON.
10app.post("/webhooks", express.raw({ type: 'application/json' }), async (req: Request, res: Response): Promise<any> => {
11  try {
12    // (Optional) Check if the request body is a buffer
13    // This is to ensure that the request body is not converted to JSON by any middleware
14    if (!Buffer.isBuffer(req.body)) {
15      console.error("Request body is not a buffer");
16      return res.status(500).json({ error: "Server misconfigured" });
17    }
18
19    // 1. Get Paddle-Signature header
20    const paddleSignature = req.headers["paddle-signature"] as string;

```


### 1Get Paddle-Signature header

[1Get Paddle-Signature header](/webhooks/signature-verification#get-header)

First, get thePaddle-Signatureheader from an incoming webhook sent by Paddle.


All webhook events sent by Paddle include aPaddle-Signatureheader. For example:


```undefined
11ts=1671552777;h1=eb4d0dc8853be92b7f063b9f3ba5233eb920a09459b6e6b2c26705b4364db151
```


Signatures include two parts, separated by a semicolon:


Timestamp as a Unix timestamp.


Webhook event signature. Signatures contain at least oneh1. We may add support for secret rotation in the future. During secret rotation, more than oneh1is returned while secrets are rotated out.


### 2Extract timestamp and signature from header

[2Extract timestamp and signature from header](/webhooks/signature-verification#extract-ts-h1)

Now you have thePaddle-Signatureheader, parse it to extract the timestamp (ts) and signature values (h1).


You can do this by splitting using a semicolon character (;) to get elements, then splitting again using an equals sign character (=) to get key-value pairs.

> To prevent replay attacks, you may like to check the timestamp (ts) against the current time and reject events that are too old. Our SDKs have a default tolerance of five seconds between the timestamp and the current time.


To prevent replay attacks, you may like to check the timestamp (ts) against the current time and reject events that are too old. Our SDKs have a default tolerance of five seconds between the timestamp and the current time.


### 3Build signed payload

[3Build signed payload](/webhooks/signature-verification#build-signed-payload)

Paddle creates a signature by first concatenating the timestamp (ts) with the body of the request, joined with a colon (:).


Build your own signed payload by concatenating:

- The extracted timestamp (ts) +
- A colon (:) +
- The raw body of the request
> Don't transform or process the raw body of the request, including adding whitespace or applying other formatting. This results in a different signed payload, meaning signatures won't match when you compare.


Don't transform or process the raw body of the request, including adding whitespace or applying other formatting. This results in a different signed payload, meaning signatures won't match when you compare.


### 4Hash signed payload

[4Hash signed payload](/webhooks/signature-verification#hash-signed-payload)

Next, hash your signed payload to generate a signature.


Paddle generates signatures using a keyed-hash message authentication code (HMAC) with SHA256 and a secret key.


Compute the HMAC of your signed payload using the SHA256 algorithm, using the secret key for this notification destination as the key.


This should give you the expected signature of the webhook event.


### 5Compare signatures

[5Compare signatures](/webhooks/signature-verification#compare-signatures)

Finally, compare the signature within thePaddle-Signatureheader (the value ofh1) to the signature you just computed in the previous step.


If they don't match, you should reject the webhook event. Someone may be sending malicious requests to your webhook endpoint.


## Test signature verification

[Test signature verification](/webhooks/signature-verification#test-signature-verification)

You cansend a simulated webhookto test that your webhook signature verification is working.

[send a simulated webhook](/webhooks/test-webhooks)

Webhook simulator sends an exact replica of a webhook request, including thePaddle-Signatureheader, to the URL you provide.


## Related pages

[Related pages](/webhooks/signature-verification#related-pages)
[Read more](/webhooks/notification-destinations)
[Read more](/api-reference/notification-settings/overview)
- Verify webhook signatures
[Verify webhook signatures](#verify-webhook-signatures)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Create a notification destination
[Create a notification destination](#prerequisites-create-notification-setting)
- Get your secret key
[Get your secret key](#prerequisites-secret-key)
- Overview
[Overview](#get-started)
- Verify using Paddle SDKs
[Verify using Paddle SDKs](#verify-sdks)
- Verify manually
[Verify manually](#verify-manually)
- Examples
[Examples](#examples-verify-manually)
- Get Paddle-Signature header
[Get Paddle-Signature header](#get-header)
- Extract timestamp and signature from header
[Extract timestamp and signature from header](#extract-ts-h1)
- Build signed payload
[Build signed payload](#build-signed-payload)
- Hash signed payload
[Hash signed payload](#hash-signed-payload)
- Compare signatures
[Compare signatures](#compare-signatures)
- Test signature verification
[Test signature verification](#test-signature-verification)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:13:45*
