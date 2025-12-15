# Get a transaction to update payment method - Paddle Developer

**Source:** https://developer.paddle.com/api-reference/subscriptions/update-payment-method

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

## Get a transaction to update payment method

[Get a transaction to update payment method](/api-reference/subscriptions/update-payment-method#get-a-transaction-to-update-payment-method)

Returns a transaction that you can pass to a checkout to let customers update their payment details. Only for subscriptions wherecollection_modeisautomatic.


The transaction returned depends on the status of the related subscription:

- Where a subscription ispast_due, it returns the most recentpast_duetransaction.
- Where a subscription isactive, it creates a new zero amount transaction for the items on a subscription.

You can use the returnedcheckout.url, or pass the returned transaction ID to Paddle.js to open a checkout to present customers with a way of updating their payment details.


Thecustomer,address,business,discount,adjustmentsandadjustments_totalsproperties are only returned in the response if the API key has read permissions for those related entities.

[Read more](/build/subscriptions/update-payment-details)
[Read more](/build/transactions/pass-transaction-checkout)
[Read more](/concepts/payment-methods/overview)

### Path Parameters

[Path Parameters](/api-reference/subscriptions/update-payment-method#path-parameters)

Paddle ID of the subscription entity to work with.


### Response

[Response](/api-reference/subscriptions/update-payment-method#response)

Represents a transaction entity.


Unique Paddle ID for this transaction entity, prefixed withtxn_.


Status of this transaction. You may set a transaction tobilledorcanceled, other statuses are set automatically by Paddle. Automatically-collected transactions may returncompletedif payment is captured successfully, orpast_dueif payment failed.


Paddle ID of the customer that this transaction is for, prefixed withctm_.


Paddle ID of the address that this transaction is for, prefixed withadd_.


Paddle ID of the business that this transaction is for, prefixed withbiz_.


Your own structured key-value data.


Supported three-letter ISO 4217 currency code. Must beUSD,EUR, orGBPifcollection_modeismanual.


Describes how this transaction was created.


Paddle ID of the subscription that this transaction is for, prefixed withsub_.


Paddle ID of the invoice that this transaction is related to, prefixed withinv_. Used for compatibility with the Paddle Invoice API, which is now deprecated. This field is scheduled to be removed in the next version of the Paddle API.


Invoice number for this transaction. Automatically generated by Paddle when you mark a transaction asbilledwherecollection_modeismanual.


How payment is collected for this transaction.automaticfor checkout,manualfor invoices.


Paddle ID of the discount applied to this transaction, prefixed withdsc_.


Details for invoicing. Required ifcollection_modeismanual.


Time period that this transaction is for. Set automatically by Paddle for subscription renewals to describe the period that charges are for.


List of items on this transaction. For calculated totals, usedetails.line_items.


Calculated totals for a transaction, including proration, discounts, tax, and currency conversion. Considered the source of truth for totals on a transaction.


List of payment attempts for this transaction, including successful payments. Sorted bycreated_atin descending order, so most recent attempts are returned first.


Paddle Checkout details for this transaction. Returned for automatically-collected transactions and wherebilling_details.enable_checkoutistruefor manually-collected transactions;nullotherwise.


RFC 3339 datetime string of when this entity was created. Set automatically by Paddle.


RFC 3339 datetime string of when this entity was updated. Set automatically by Paddle.


RFC 3339 datetime string of when this transaction was marked asbilled.nullfor transactions that aren'tbilledorcompleted. Set automatically by Paddle.


RFC 3339 datetime string of when a transaction was revised. Revisions describe an update to customer information for a billed or completed transaction.nullif not revised. Set automatically by Paddle.


Related customer for this transaction. Only returned if the API key has a Customers (Read) permission.


Related address for this transaction. Only returned if the API key has an Addresses (Read) permission.


Related business for this transaction. Only returned if a business exists for this transaction and the API key has a Businesses (Read) permission.


Related discount for this transaction. Only returned if a discount exists for this transaction and the API key has a Discounts (Read) permission.


Related adjustments for this transaction. Only returned if adjustments exist for this transaction and the API key has an Adjustments (Read) permission.


Object containing totals for all adjustments on this transaction. Only returned if the API key has an Adjustments (Read) permission.


List of payment methods available for this transaction.


Information about this response.


Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.


```json

```


---

*Last scraped: 2025-12-15 20:25:31*
