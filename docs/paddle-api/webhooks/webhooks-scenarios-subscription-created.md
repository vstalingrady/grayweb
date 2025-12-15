# Subscription created scenario

**Source:** https://developer.paddle.com/webhooks/scenarios/subscription-created

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

# Subscription created scenario

[Subscription created scenario](/webhooks/scenarios/subscription-created#subscription-created-scenario)

Simulates all events that occur when a subscription is created from a checkout.

1. Customer opens checkouttransaction.createdPaddle creates a transaction for the items on the checkout. Its status is initiallydraft. Its origin isweb.

#### Customer opens checkout

[Customer opens checkout](/webhooks/scenarios/subscription-created#events-checkout-open)

| transaction.created | Paddle creates a transaction for the items on the checkout. Its status is initiallydraft. Its origin isweb. |


transaction.created

[transaction.created](/webhooks/transactions/transaction-created)

Paddle creates a transaction for the items on the checkout. Its status is initiallydraft. Its origin isweb.

1. Customer adds their details and addresscustomer.createdPaddle creates a new customer with the information provided by the customer. The customer's status isactive.address.createdWhen a customer enters their country and ZIP/postal code, Paddle always creates a new address related to this customer.transaction.updatedPaddle updates the transaction with the customer and address. The transaction status isreadybecause the transaction has customer and address information.transaction.readyOccurs because the transaction status changes toready.

#### Customer adds their details and address

[Customer adds their details and address](/webhooks/scenarios/subscription-created#events-adds-customer-details)

| customer.created | Paddle creates a new customer with the information provided by the customer. The customer's status isactive. |
| address.created | When a customer enters their country and ZIP/postal code, Paddle always creates a new address related to this customer. |
| transaction.updated | Paddle updates the transaction with the customer and address. The transaction status isreadybecause the transaction has customer and address information. |
| transaction.ready | Occurs because the transaction status changes toready. |


customer.created

[customer.created](/webhooks/customers/customer-created)

Paddle creates a new customer with the information provided by the customer. The customer's status isactive.


address.created

[address.created](/webhooks/addresses/address-created)

When a customer enters their country and ZIP/postal code, Paddle always creates a new address related to this customer.


transaction.updated

[transaction.updated](/webhooks/transactions/transaction-updated)

Paddle updates the transaction with the customer and address. The transaction status isreadybecause the transaction has customer and address information.


transaction.ready

[transaction.ready](/webhooks/transactions/transaction-ready)

Occurs because the transaction status changes toready.

1. Customer completes checkout successfullytransaction.updatedThe transaction status changes topaidnow that the customer has paid successfully. The transaction is updated with information about the successful payment.transaction.paidOccurs because the transaction status changes topaid.subscription.createdPaddle creates a subscription for the customer, address, and business against the transaction. Its status isactiveas the prices in the transaction items have notrial_period. Includes atransaction_idfield so you can match with the completed transaction.subscription.activatedOccurs because the subscription has no trial period and is now active.transaction.updatedThe transaction is updated with the ID of the new subscription, the billing period, and information about fees, payouts, and earnings.transaction.updatedAn invoice number is assigned to the transaction. Its status changes tocompletedas Paddle has finished processing it.transaction.completedOccurs because the transaction status changes tocompleted.

#### Customer completes checkout successfully

[Customer completes checkout successfully](/webhooks/scenarios/subscription-created#events-checkout-completed)

| transaction.updated | The transaction status changes topaidnow that the customer has paid successfully. The transaction is updated with information about the successful payment. |
| transaction.paid | Occurs because the transaction status changes topaid. |
| subscription.created | Paddle creates a subscription for the customer, address, and business against the transaction. Its status isactiveas the prices in the transaction items have notrial_period. Includes atransaction_idfield so you can match with the completed transaction. |
| subscription.activated | Occurs because the subscription has no trial period and is now active. |
| transaction.updated | The transaction is updated with the ID of the new subscription, the billing period, and information about fees, payouts, and earnings. |
| transaction.updated | An invoice number is assigned to the transaction. Its status changes tocompletedas Paddle has finished processing it. |
| transaction.completed | Occurs because the transaction status changes tocompleted. |


transaction.updated

[transaction.updated](/webhooks/transactions/transaction-updated)

The transaction status changes topaidnow that the customer has paid successfully. The transaction is updated with information about the successful payment.


transaction.paid

[transaction.paid](/webhooks/transactions/transaction-paid)

Occurs because the transaction status changes topaid.


subscription.created

[subscription.created](/webhooks/subscriptions/subscription-created)

Paddle creates a subscription for the customer, address, and business against the transaction. Its status isactiveas the prices in the transaction items have notrial_period. Includes atransaction_idfield so you can match with the completed transaction.


subscription.activated

[subscription.activated](/webhooks/subscriptions/subscription-activated)

Occurs because the subscription has no trial period and is now active.


transaction.updated

[transaction.updated](/webhooks/transactions/transaction-updated)

The transaction is updated with the ID of the new subscription, the billing period, and information about fees, payouts, and earnings.


transaction.updated

[transaction.updated](/webhooks/transactions/transaction-updated)

An invoice number is assigned to the transaction. Its status changes tocompletedas Paddle has finished processing it.


transaction.completed

[transaction.completed](/webhooks/transactions/transaction-completed)

Occurs because the transaction status changes tocompleted.

1. Payment method is savedpayment_method.savedOccurs if the customer opted to save their payment method at checkout.

#### Payment method is saved

[Payment method is saved](/webhooks/scenarios/subscription-created#events-payment-method-saved)

| payment_method.saved | Occurs if the customer opted to save their payment method at checkout. |


payment_method.saved

[payment_method.saved](/webhooks/payment-methods/payment-method-saved)

Occurs if the customer opted to save their payment method at checkout.


## Related pages

[Related pages](/webhooks/scenarios/subscription-created#related-pages)
[Read more](/build/lifecycle/subscription-creation)
[Read more](/webhooks/test-webhooks)
- Subscription created scenario
[Subscription created scenario](#subscription-created-scenario)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:13:28*
