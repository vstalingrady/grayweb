# Get a subscription - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/subscriptions/get-subscription

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
- SubscriptionsSubscription objectList subscriptionsgetGet a subscriptiongetPreview an update to a subscriptionpatchUpdate a subscriptionpatchGet a transaction to update payment methodgetPreview a one-time charge for a subscriptionpostCreate a one-time charge for a subscriptionpostActivate a trialing subscriptionpostPause a subscriptionpostResume a paused subscriptionpostCancel a subscriptionpost
- Subscription object
[Subscription object](/api-reference/subscriptions/overview)
- List subscriptionsget
[List subscriptions](/api-reference/subscriptions/list-subscriptions)
- Get a subscriptionget
[Get a subscription](/api-reference/subscriptions/get-subscription)
- Preview an update to a subscriptionpatch
[Preview an update to a subscription](/api-reference/subscriptions/preview-subscription)
- Update a subscriptionpatch
[Update a subscription](/api-reference/subscriptions/update-subscription)
- Get a transaction to update payment methodget
[Get a transaction to update payment method](/api-reference/subscriptions/update-payment-method)
- Preview a one-time charge for a subscriptionpost
[Preview a one-time charge for a subscription](/api-reference/subscriptions/preview-subscription-charge)
- Create a one-time charge for a subscriptionpost
[Create a one-time charge for a subscription](/api-reference/subscriptions/create-one-time-charge)
- Activate a trialing subscriptionpost
[Activate a trialing subscription](/api-reference/subscriptions/activate-subscription)
- Pause a subscriptionpost
[Pause a subscription](/api-reference/subscriptions/pause-subscription)
- Resume a paused subscriptionpost
[Resume a paused subscription](/api-reference/subscriptions/resume-subscription)
- Cancel a subscriptionpost
[Cancel a subscription](/api-reference/subscriptions/cancel-subscription)
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

## Get a subscription

[Get a subscription](/api-reference/subscriptions/get-subscription#get-a-subscription)

Returns a subscription using its ID.


Use theincludeparameter to include transaction information in the response.


### Path Parameters

[Path Parameters](/api-reference/subscriptions/get-subscription#path-parameters)

Paddle ID of the subscription entity to work with.


### Query Parameters

[Query Parameters](/api-reference/subscriptions/get-subscription#query-parameters)

Include related entities in the response. Use a comma-separated list to specify multiple entities.


### Response

[Response](/api-reference/subscriptions/get-subscription#response)

Represents a subscription entity with included entities.


Unique Paddle ID for this subscription entity, prefixed withsub_.


Status of this subscription. Set automatically by Paddle. Use the pause subscription or cancel subscription operations to change.


Paddle ID of the customer that this subscription is for, prefixed withctm_.


Paddle ID of the address that this subscription is for, prefixed withadd_.


Paddle ID of the business that this subscription is for, prefixed withbiz_.


Supported three-letter ISO 4217 currency code. Transactions for this subscription are created in this currency. Must beUSD,EUR, orGBPifcollection_modeismanual.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


RFC 3339 datetime string of when this subscription started. This may be different fromfirst_billed_atif the subscription started in trial.


RFC 3339 datetime string of when this subscription was first billed. This may be different fromstarted_atif the subscription started in trial.


RFC 3339 datetime string of when this subscription is next scheduled to be billed.


RFC 3339 datetime string of when this subscription was paused. Set automatically by Paddle when the pause subscription operation is used.nullif not paused.


RFC 3339 datetime string of when this subscription was canceled. Set automatically by Paddle when the cancel subscription operation is used.nullif not canceled.


Details of the discount applied to this subscription.


How payment is collected for transactions created for this subscription.automaticfor checkout,manualfor invoices.


Details for invoicing. Required ifcollection_modeismanual.


Current billing period for this subscription. Set automatically by Paddle based on the billing cycle.nullforpausedandcanceledsubscriptions.


How often this subscription renews. Set automatically by Paddle based on the prices on this subscription.


Change that's scheduled to be applied to a subscription. Use the pause subscription, cancel subscription, and resume subscription operations to create scheduled changes.nullif no scheduled changes.


Customer portal deep links for this subscription.


Authenticated links are only returned when your API key has Customer portal session (Write) permission. For security, thetokenappended to authenticated links is temporary. You shouldn't store them.


List of items on this subscription. Only recurring items are returned.


Your own structured key-value data.


Import information for this entity.nullif this entity is not imported.


Preview of the next transaction for this subscription. May include prorated charges that aren't yet billed and one-time charges. Returned when theincludeparameter is used with thenext_transactionvalue.nullif the subscription is scheduled to cancel or pause.


Preview of the recurring transaction for this subscription. This is what the customer can expect to be billed when there are no prorated or one-time charges. Returned when theincludeparameter is used with therecurring_transaction_detailsvalue.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json

```


---

*Last scraped: 2025-12-15 20:25:38*
