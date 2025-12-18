# Port your subscription data from Paddle Classic to Paddle Billing

**Source:** https://developer.paddle.com/migrate/paddle-classic/port-subscriptions

---

- Overview
[Overview](/migrate/overview)
- Learn
- What is Paddle Billing?
[What is Paddle Billing?](/migrate/paddle-classic/overview)
- Why migrate?
[Why migrate?](/migrate/paddle-classic/pathways)
- Full feature comparison
[Full feature comparison](/migrate/paddle-classic/features)
- Plan
- Plan your migration
[Plan your migration](/migrate/paddle-classic/plan)
- Workflow mapping
[Workflow mapping](/migrate/paddle-classic/workflows)
- Technical data mapping
[Technical data mapping](/migrate/paddle-classic/concepts)
- Migrate
- Reintegration checklist
[Reintegration checklist](/migrate/paddle-classic/checklist)
- Port your subscriptions
[Port your subscriptions](/migrate/paddle-classic/port-subscriptions)

Early access


# Port your subscription data from Paddle Classic to Paddle Billing

[Port your subscription data from Paddle Classic to Paddle Billing](/migrate/paddle-classic/port-subscriptions#port-your-subscription-data-from-paddle-classic-to-paddle-billing)

Map your product catalog and migrate your subscription data from Classic to Billing using screens in the dashboard. Available when you've built an integration with Paddle Billing.


After you've built an integration with Paddle Billing, use the dashboard to port subscription data from Paddle Classic to Paddle Billing. You can update records in your database, then turn off your Paddle Classic integration.


This guide walks through how to use the migration screens, and how to handle migrated data.

> Access to migrations in the dashboard is limited to users who are part of our early access program. If you're interested in joining the program, read the testing overview guide and join the waitlist. We'll reach out when space is available if you meet the program requirements.View early access overview and join


Access to migrations in the dashboard is limited to users who are part of our early access program. If you're interested in joining the program, read the testing overview guide and join the waitlist. We'll reach out when space is available if you meet the program requirements.

[View early access overview and join](/changelog/2025/classic-to-billing-migrations)

## How it works

[How it works](/migrate/paddle-classic/port-subscriptions#background)

You can use screens in the Paddle dashboard to migrate data from Paddle Billing to Paddle Classic. It's a multistep process, with a final chance to review everything at the end.


You can run as many migrations as you want, choosing how many subscriptions you want to migrate each time.


### Product catalog mapping

[Product catalog mapping](/migrate/paddle-classic/port-subscriptions#mapping-process)

In the first step of migration, you canmap plansin Paddle Classic withproductsin Paddle Billing.

[map plans](/migrate/paddle-classic/port-subscriptions#map-products-and-prices)
[products](/api-reference/products/overview)

You can map the same product to multiple plans. For example, you might have separate plans in Paddle Classic for monthly and annual pricing, which you could map to the same product in Paddle Billing.


For each plan that you map to a product, Paddle createsa new pricefor that product. You can review these onstep two of the migration screen.

[a new price](/api-reference/prices/overview)
[step two of the migration screen](/migrate/paddle-classic/port-subscriptions#map-products-and-prices)

Price overrides in Paddle Classic and Paddle Billing can't be mapped one-to-one. If you have currency override prices in Paddle Classic, Paddle creates a new price in Paddle Billing for each override price.


By default, the new override prices are created asnon-catalog prices. This means they're considered specific to the subscriptions that they're used on, and not presented in the dashboard or returned by the API by default.

[non-catalog prices](/build/transactions/bill-create-custom-items-prices-products)

### Subscription selection

[Subscription selection](/migrate/paddle-classic/port-subscriptions#mapping-process)

After you've mapped products and prices, you can choose whichsubscriptionsyou want to migrate.

[subscriptions](/api-reference/subscriptions/overview)

We recommend choosing a small number of subscriptions for your first migration, so you can familiarize yourself with the process and check that your new Paddle Billing integration flows work correctly.


You can run as many migrations as you want, so you can go plan-by-plan, migrate a number at a time, or migrate all.


You can only migrate active subscriptions. Where subscriptions are past due, wait for dunning to complete then follow-up with another migration when subscriptions are active.


### During migration

[During migration](/migrate/paddle-classic/port-subscriptions#process-background)

During a migration, Paddle creates new records in Paddle Billing and cancels the subscription in Paddle Classic. This is how the process works:

1. Prices importedNew prices are created in Paddle Billing for any mapped products.

Prices imported


New prices are created in Paddle Billing for any mapped products.

1. Customer data importedAcustomerand anaddressentity are created in Paddle Billing for each subscription. Where an existing customer exists, Paddle creates a new address for that customer instead.

Customer data imported


Acustomerand anaddressentity are created in Paddle Billing for each subscription. Where an existing customer exists, Paddle creates a new address for that customer instead.

[customer](/api-reference/customers/overview)
[address](/api-reference/addresses/overview)
1. Business data imported— optionalIf a customer has a tax or VAT number, abusinessentity is created for the customer in Paddle Billing.

Business data imported— optional


If a customer has a tax or VAT number, abusinessentity is created for the customer in Paddle Billing.

[business](/api-reference/businesses/overview)
1. Subscriptions importedAsubscriptionentity is created in Paddle Billing for each subscription. It's linked to the customer, address, and business created earlier, and the products and prices mapped initially.

Subscriptions imported


Asubscriptionentity is created in Paddle Billing for each subscription. It's linked to the customer, address, and business created earlier, and the products and prices mapped initially.

[subscription](/api-reference/subscriptions/overview)
1. Subscription canceled in Paddle ClassicThe subscription is canceled silently in Paddle Classic, with no disruption to the customer. If there's a problem importing a subscription to Paddle Billing, it's not canceled in Paddle Classic.

Subscription canceled in Paddle Classic


The subscription is canceled silently in Paddle Classic, with no disruption to the customer. If there's a problem importing a subscription to Paddle Billing, it's not canceled in Paddle Classic.


### Post-migration

[Post-migration](/migrate/paddle-classic/port-subscriptions#post-migration-background)

You can track the status of a migration in the dashboard. Paddle emails you when a migration is completed.


As part of the migration process, you need to create or update records in your database for the subscriptions you ported over. You can either:

- Use webhooks— recommendedListen forcustomer.imported,subscription.imported, andother imported webhooks, then create records in your database.

Use webhooks— recommended


Listen forcustomer.imported,subscription.imported, andother imported webhooks, then create records in your database.

[customer.imported](/webhooks/customers/customer-imported)
[subscription.imported](/webhooks/subscriptions/subscription-imported)
[other imported webhooks](/migrate/paddle-classic/port-subscriptions#related-notifications)
- Create a database migration scriptExport a list of migrated subscriptions from the dashboard, then use this to write a script to create records in your database.

Create a database migration script


Export a list of migrated subscriptions from the dashboard, then use this to write a script to create records in your database.

> As part of migration,importedevents occur in place ofcreatedevents. For example,customer.importedoccurs in place ofsubscription.created.


As part of migration,importedevents occur in place ofcreatedevents. For example,customer.importedoccurs in place ofsubscription.created.

[customer.imported](/webhooks/subscriptions/subscription-imported)

In most cases, we recommend using webhooks because they contain all the information you need. You might like to create a database migration script if you're importing a large number of subscriptions that might overwhelm your webhook endpoint.


If you're using a migration script, you may need to make additional calls to the Paddle API to fetch the data you need.


## Before you begin

[Before you begin](/migrate/paddle-classic/port-subscriptions#prerequisites)

### Build an integration with Paddle Billing

[Build an integration with Paddle Billing](/migrate/paddle-classic/port-subscriptions#build-integration-prerequisites)

Paddle Billing is built onan entirely new API, withnew webhooks,Paddle.js library, andSDKs.

[an entirely new API](/api-reference/overview)
[new webhooks](/webhooks/overview)
[Paddle.js library](/paddlejs/overview)
[SDKs](/resources/overview)

Before you can port your subscriptions from Paddle Classic to Paddle Billing, you'll need to build an integration with Paddle Billing so that you're ready to run subscriptions through Paddle Billing rather than Paddle Classic.


To learn more, seeReintegration checklist

[Reintegration checklist](/migrate/paddle-classic/checklist)

### Complete a transaction

[Complete a transaction](/migrate/paddle-classic/port-subscriptions#go-live-prerequisites)

You'll need to have at least one completed transaction on Paddle Billing to show that your integration is ready.


Make sure you've had one new customer signup through your Paddle Billing integration, or launch a checkout and take a payment through it yourself to verify that your Paddle Billing integration works correctly.


### Subscribe to imported eventsRecommended

[Subscribe to imported eventsRecommended](/migrate/paddle-classic/port-subscriptions#create-webhook-endpoint-prerequisites)

We recommend usingwebhookstohandle fulfillment and provisioningfor subscription lifecycle events. Build awebhook handler functionandset up a notification destinationin Paddle.

[webhooks](/webhooks/overview)
[handle fulfillment and provisioning](/build/subscriptions/provision-access-webhooks)
[webhook handler function](/webhooks/respond-to-webhooks)
[set up a notification destination](/webhooks/notification-destinations)

If you're using webhooks to handle your post-migration workflow, subscribe tocustomer.importedandsubscription.importedevents.

[customer.imported](/webhooks/customers/customer-imported)
[subscription.imported](/webhooks/subscriptions/subscription-imported)

To learn more, seeCreate or update notification destinationsandHandle webhook delivery

[Create or update notification destinations](/webhooks/notification-destinations)
[Handle webhook delivery](/webhooks/respond-to-webhooks)
> You can usewebhook simulatorto check that your webhook endpoint and fulfillment workflows are working correctly.


You can usewebhook simulatorto check that your webhook endpoint and fulfillment workflows are working correctly.

[webhook simulator](/webhooks/test-webhooks)

## Prepare your database

[Prepare your database](/migrate/paddle-classic/port-subscriptions#pre-migration-database)

Create or update records in your database for new subscriptions in Paddle Billing.


To avoid data contamination, we recommend creating new tables in your database for subscription data rather than enriching existing records.


Customers can have more than one subscription in Paddle Billing, so we recommend creating a table for customer data and a separate table for subscription data, then relating them using the customer ID.


As part of the migration,customer.importedoccurs in Paddle Billing. You should store:

[customer.imported](/webhooks/customers/customer-imported)

| Description | Field name | Reason to store |
| --- | --- | --- |
| Customer ID | customer.id | Used to identify a customer and relate to record in the subscription table. |
| Email address | customer.email | Used to identify a customer. |
| Classic reference | customer.import_meta.external_id | Used to match this subscription to a Paddle Classic user record. |


As part of the migration,subscription.importedoccurs in Paddle Billing. You should store:

[subscription.imported](/webhooks/subscriptions/subscription-imported)

| Description | Field name | Reason to store |
| --- | --- | --- |
| Customer ID | subscription.customer_id | Used to relate this record with a record in the customer table. |
| Subscription ID | subscription.id | Used to identify this subscription and work with this subscription using the API. |
| Subscription status | subscription.status | Used to limit or stop access when paused or canceled, or determine if a subscription is past due or trialing. |
| Subscription items | subscription.items[].price.id,subscription.items[].quantity | Used to change items on a subscription as part of an upgrade or downgrade workflow. |
| Subscription products | subscription.items[].price.product_id | Used to determine which features in your app a customer should have access to. |
| Collection mode | subscription.collection_mode | Used to determine whether a subscription bills automatically or whether Paddle sends an invoice for charges that customers must pay manually. |
| Scheduled change | subscription.scheduled_change | Used to determine whether a subscription is scheduled to pause or cancel. You can't change items on a subscription when there's a pending scheduled change. |
| Classic reference | subscription.import_meta.external_id | Used to match this subscription to a Paddle Classic subscription record. |


## Migrate subscription data

[Migrate subscription data](/migrate/paddle-classic/port-subscriptions#port-data)

### Get started

[Get started](/migrate/paddle-classic/port-subscriptions#get-started)
1. Choose thePaddle Billingoption in the toggle in the nav bar.

Choose thePaddle Billingoption in the toggle in the nav bar.

1. Go toPaddle > Migrate.

Go toPaddle > Migrate.

1. ClickGet started.

ClickGet started.

> You'll need to have at least one completed transaction to be able to start a migration.


You'll need to have at least one completed transaction to be able to start a migration.


### Map products and prices

[Map products and prices](/migrate/paddle-classic/port-subscriptions#map-products-and-prices)
1. Use the drop-down to map plans in Classic to products in Billing. Paddle creates a new price for each plan against the product you select here.

Use the drop-down to map plans in Classic to products in Billing. Paddle creates a new price for each plan against the product you select here.

1. ClickContinue, then review prices.

ClickContinue, then review prices.

1. ClickPrice detailsnext to any price to update the name or description of a price. You can change other details later.

ClickPrice detailsnext to any price to update the name or description of a price. You can change other details later.

1. ClickContinue.

ClickContinue.


### Select subscriptions

[Select subscriptions](/migrate/paddle-classic/port-subscriptions#select-subscriptions)
1. Use the checkboxes to select subscriptions that you want to migrate. You can search, sort, and filter using the options at the top.

Use the checkboxes to select subscriptions that you want to migrate. You can search, sort, and filter using the options at the top.

1. ClickContinue.

ClickContinue.

> We recommend selecting a small number of subscriptions for your first migration, so you can check your new integration works.


We recommend selecting a small number of subscriptions for your first migration, so you can check your new integration works.


### Review and start

[Review and start](/migrate/paddle-classic/port-subscriptions#review-and-start)
1. Review the products and subscriptions you're migrating, then clickStart migration.

Review the products and subscriptions you're migrating, then clickStart migration.

1. Complete the final check by clickingStart migration.

Complete the final check by clickingStart migration.


## Handle migrated subscriptions

[Handle migrated subscriptions](/migrate/paddle-classic/port-subscriptions#post-migration)

### Webhooks

[Webhooks](/migrate/paddle-classic/port-subscriptions#webhooks-post-migration)

If you built a post-migration workflow usingcustomer.importedandsubscription.importedevents, you should check that:

[customer.imported](/webhooks/customers/customer-imported)
[subscription.imported](/webhooks/subscriptions/subscription-imported)
- You received webhooks for imported events. Paddle automatically queues events that failed for retry, using an exponential backoff schedule. You can view logs in the Paddle dashboard orusing the API.
[using the API](/api-reference/notification-logs/list-notification-logs)
- You processed webhooks successfully, and records are created in your database. You can export a list of subscriptions fromPaddle > Migrateand check against your records.
- You're running subscriptions in Paddle Billing through your Paddle Billing integration.

When all your subscriptions are ported to Paddle Billing, you can safely remove your Paddle Classic integration.


### Migration script

[Migration script](/migrate/paddle-classic/port-subscriptions#manual-post-migration)

If you're using a database migration script to create and update records in your database, you should:

1. TogglePaddle Billingin the nav bar, then export a list of subscriptions fromPaddle > Migrate.

TogglePaddle Billingin the nav bar, then export a list of subscriptions fromPaddle > Migrate.

1. Write a database migration script to create or update records in your database.

Write a database migration script to create or update records in your database.

1. Check that you're running subscriptions in Paddle Billing through your Paddle Billing integration.

Check that you're running subscriptions in Paddle Billing through your Paddle Billing integration.


When all your subscriptions are ported to Paddle Billing, you can safely remove your Paddle Classic integration.


## Events

[Events](/migrate/paddle-classic/port-subscriptions#related-notifications)

| price.imported | Occurs during a migration when a price is created for a Paddle Classic plan. |
| customer.imported | Occurs during a migration when a customer is created for a subscription. |
| address.imported | Occurs during a migration when an address is created for a customer against a subscription. |
| business.imported | Occurs during a migration when a business is created for a customer against a subscription. |
| discount.imported | Occurs during a migration when a price is created for a Paddle Classic coupon. |
| subscription.imported | Occurs during a migration when a subscription is ported from Paddle Classic to Paddle Billing. |

[price.imported](/webhooks/prices/price-imported)
[customer.imported](/webhooks/customers/customer-imported)
[address.imported](/webhooks/addresses/address-imported)
[business.imported](/webhooks/businesses/business-imported)
[discount.imported](/webhooks/discounts/discount-imported)
[subscription.imported](/webhooks/subscriptions/subscription-imported)

## Related pages

[Related pages](/migrate/paddle-classic/port-subscriptions#related-pages)
[Read more](/migrate/overview)
[Read more](/resources/overview)
- Port your subscription data from Paddle Classic to Paddle Billing
[Port your subscription data from Paddle Classic to Paddle Billing](#port-your-subscription-data-from-paddle-classic-to-paddle-billing)
- How it works
[How it works](#background)
- Product catalog mapping
[Product catalog mapping](#mapping-process)
- Subscription selection
[Subscription selection](#mapping-process)
- During migration
[During migration](#process-background)
- Post-migration
[Post-migration](#post-migration-background)
- Before you begin
[Before you begin](#prerequisites)
- Build an integration with Paddle Billing
[Build an integration with Paddle Billing](#build-integration-prerequisites)
- Complete a transaction
[Complete a transaction](#go-live-prerequisites)
- Subscribe to imported events
[Subscribe to imported events](#create-webhook-endpoint-prerequisites)
- Prepare your database
[Prepare your database](#pre-migration-database)
- Migrate subscription data
[Migrate subscription data](#port-data)
- Get started
[Get started](#get-started)
- Map products and prices
[Map products and prices](#map-products-and-prices)
- Select subscriptions
[Select subscriptions](#select-subscriptions)
- Review and start
[Review and start](#review-and-start)
- Handle migrated subscriptions
[Handle migrated subscriptions](#post-migration)
- Webhooks
[Webhooks](#webhooks-post-migration)
- Migration script
[Migration script](#manual-post-migration)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:24:08*
