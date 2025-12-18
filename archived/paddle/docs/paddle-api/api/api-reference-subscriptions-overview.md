# Subscriptions

**Source:** https://developer.paddle.com/api-reference/subscriptions/overview

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

# Subscriptions

[Subscriptions](/api-reference/subscriptions/overview#subscriptions)

Subscription entities describe a recurring billing relationship with a customer. They're closely related to transactions.


Subscriptions let customers pay for products on a recurring schedule. They hold information about what Paddle should charge a customer for and how often.


Subscription entities hold information like:

- Who the customer is.
- Which prices a customer has subscribed to.
- How often a subscription renews.
- Details about trial periods.
- Any upcoming scheduled changes.

Subscriptions work withproducts,prices, anddiscountsto say what a customer has subscribed to, andcustomers,addresses, andbusinessesto say who the customer is.

[products](/api-reference/products/overview)
[prices](/api-reference/prices/overview)
[discounts](/api-reference/discounts/overview)
[customers](/api-reference/customers/overview)
[addresses](/api-reference/addresses/overview)
[businesses](/api-reference/businesses/overview)

### Create a subscription

[Create a subscription](/api-reference/subscriptions/overview#create-a-subscription)

You can't create a subscription directly.


Paddle automatically creates subscriptions for you when customers pay for recurring items usingthe checkout, or when youcreate and issue an invoiceusing a manually-collected transaction.

[the checkout](/concepts/sell/self-serve-checkout)
[create and issue an invoice](/build/invoices/create-issue-invoices)

### Delete a subscription

[Delete a subscription](/api-reference/subscriptions/overview#delete-a-subscription)

Subscriptions describe an ongoing financial relationship with a customer, so they can't be deleted. Use thecancel a subscription operationto cancel a subscription.

[cancel a subscription operation](/api-reference/subscriptions/cancel-subscription)

### Transactions

[Transactions](/api-reference/subscriptions/overview#transactions)

Billing for subscriptions is powered bytransactions. When a subscription bills, Paddle creates a related transaction to calculate totals and collect for payment.

[transactions](/api-reference/transactions/overview)

You can get a preview of the next transaction when getting a subscriptionusing theincludeparameter.

[using theincludeparameter](/api-reference/about/include-entities)

### Scheduled changes

[Scheduled changes](/api-reference/subscriptions/overview#scheduled-changes)

A scheduled change is a change that's going to happen automatically when the subscription next bills.


Paddle creates a scheduled change automatically when youcancel, pause, orupdate an itemon a subscription and returns them in thescheduled_changeobject.

[cancel](/build/subscriptions/cancel-subscriptions)
[update an item](/build/subscriptions/replace-products-prices-upgrade-downgrade)

### Proration

[Proration](/api-reference/subscriptions/overview#proration)

Prorationis how Paddle calculates what a customer should be billed for, based on changes made in the current billing cycle.

[Proration](/concepts/subscriptions/proration)

When updating subscription items, you must include theproration_billing_modefield to tell Paddle how to handle proration for the items you're adding or removing.


### Customer portal URLs

[Customer portal URLs](/api-reference/subscriptions/overview#customer-portal-urls)

Subscriptions return authenticated links to thecustomer portalin themanagement_urlsobject. You can use these links to redirect customers to the portal to manage their subscriptions.

[customer portal](/concepts/customer-portal)

Authenticated links are only returned when your API key has a Customer portal session (Write)permission.

[permission](/api-reference/about/permissions)
> Thetokenappended to authenticated links is the token for thecustomer portal session. It is temporary and shouldn't be cached or stored.


Thetokenappended to authenticated links is the token for thecustomer portal session. It is temporary and shouldn't be cached or stored.

[customer portal session](/api-reference/customer-portals/overview)
[Read more](/build/subscriptions/add-remove-products-prices-addons)
[Read more](/build/subscriptions/replace-products-prices-upgrade-downgrade)
[Read more](/concepts/subscriptions/proration)

### Attributes

[Attributes](/api-reference/subscriptions/overview#attributes)

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


RFC 3339 datetime string of when this discount no longer applies. Where a discount hasmaximum_recurring_intervals, this is the date of the last billing period where this discount applies.nullwhere a discount recurs forever.


Unique Paddle ID for this discount, prefixed withdsc_.


RFC 3339 datetime string of when this discount was first applied.nullfor canceled subscriptions where a discount was redeemed but never applied to a transaction.


How payment is collected for transactions created for this subscription.automaticfor checkout,manualfor invoices.


Details for invoicing. Required ifcollection_modeismanual.


How long a customer has to pay this invoice once issued.


Unit of time.


Amount of time.


Whether the related transaction may be paid using Paddle Checkout. If omitted when creating a transaction, defaults tofalse.


Customer purchase order number. Appears on invoice documents.


Notes or other information to include on this invoice. Appears on invoice documents.


Current billing period for this subscription. Set automatically by Paddle based on the billing cycle.nullforpausedandcanceledsubscriptions.


RFC 3339 datetime string of when this period ends.


RFC 3339 datetime string of when this period starts.


How often this subscription renews. Set automatically by Paddle based on the prices on this subscription.


Unit of time.


Amount of time.


Change that's scheduled to be applied to a subscription. Use the pause subscription, cancel subscription, and resume subscription operations to create scheduled changes.nullif no scheduled changes.


Kind of change that's scheduled to be applied to this subscription.


RFC 3339 datetime string of when this scheduled change takes effect.


RFC 3339 datetime string of when a paused subscription should resume. Only used forpausescheduled changes.


Customer portal deep links for this subscription.


Authenticated links are only returned when your API key has Customer portal session (Write) permission. For security, thetokenappended to authenticated links is temporary. You shouldn't store them.


Link to the page for this subscription in the customer portal with the payment method update form pre-opened. Use as part of workflows to let customers update their payment details.nullfor manually-collected subscriptions.


Link to the page for this subscription in the customer portal with the subscription cancellation form pre-opened. Use as part of cancel subscription workflows.


List of items on this subscription. Only recurring items are returned.


Status of this subscription item. Set automatically by Paddle.


Quantity of this item on the subscription.


Whether this is a recurring item.falseif one-time.


RFC 3339 datetime string of when this item was added to this subscription.


RFC 3339 datetime string of when this item was last updated on this subscription.


RFC 3339 datetime string of when this item was last billed.


RFC 3339 datetime string of when this item is next scheduled to be billed.


Trial dates for this item.


Related price entity for this item. This reflects the price entity at the time it was added to the subscription.


Related product entity for this item. This reflects the product entity at the time it was added to the subscription.


Your own structured key-value data.


Import information for this entity.nullif this entity is not imported.


Name of the platform or provider where this entity was imported from.


Reference or identifier for this entity from the provider where it was imported from.


---

*Last scraped: 2025-12-15 20:24:34*
