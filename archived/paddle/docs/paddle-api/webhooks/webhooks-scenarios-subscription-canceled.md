# Subscription canceled scenario

**Source:** https://developer.paddle.com/webhooks/scenarios/subscription-canceled

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

# Subscription canceled scenario

[Subscription canceled scenario](/webhooks/scenarios/subscription-canceled#subscription-canceled-scenario)

Simulates all events that occur when a subscription is canceled by a customer.

1. Subscription cancelssubscription.updatedPaddle updates billing dates for the subscription and any items. Its status changes tocanceled.subscription.canceledOccurs because the subscription status changes tocanceled.

#### Subscription cancels

[Subscription cancels](/webhooks/scenarios/subscription-canceled#events-cancel-subscription)

| subscription.updated | Paddle updates billing dates for the subscription and any items. Its status changes tocanceled. |
| subscription.canceled | Occurs because the subscription status changes tocanceled. |


subscription.updated

[subscription.updated](/webhooks/subscriptions/subscription-updated)

Paddle updates billing dates for the subscription and any items. Its status changes tocanceled.


subscription.canceled

[subscription.canceled](/webhooks/subscriptions/subscription-canceled)

Occurs because the subscription status changes tocanceled.


## Related pages

[Related pages](/webhooks/scenarios/subscription-canceled#related-pages)
[Read more](/build/lifecycle/subscription-cancellation)
[Read more](/webhooks/test-webhooks)
- Subscription canceled scenario
[Subscription canceled scenario](#subscription-canceled-scenario)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:13:52*
