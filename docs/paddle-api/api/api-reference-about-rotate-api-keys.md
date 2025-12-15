# Rotate API keys

**Source:** https://developer.paddle.com/api-reference/about/rotate-api-keys

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
- Subscriptions
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

# Rotate API keys

[Rotate API keys](/api-reference/about/rotate-api-keys#rotate-api-keys)

Keep your app secure by regularly rotating API keys when they expire or are exposed.


Regularly rotating API keys is a security best practice that helps protect accounts from unauthorized access. By setting expiry dates and creating new keys before old ones expire, you can minimize the risk of API keys being compromised without disrupting your app.


You may also need to rotate keys immediately due to security incidents, like a key beingexposed.

[exposed](/api-reference/about/api-keys#secret-scanning)

## How it works

[How it works](/api-reference/about/rotate-api-keys#background)

API key rotation is the process of replacing existing API keys with new ones.


API keys can be created with anexpiry date. Once an API key expires, it can no longer be used to authenticate requests to the Paddle API. This encourages you to change your keys at a regular interval.

[expiry date](/api-reference/about/api-keys#expiration)

Paddle also automatically scans to find keys that have been exposed in public and private repositories through a process calledsecret scanning. If a key is exposed, it may berevokedautomatically, or you may be notified to rotate it.

[secret scanning](/api-reference/about/api-keys#secret-scanning)
[revoked](/api-reference/about/api-keys#revoke-api-key)

## Before you begin

[Before you begin](/api-reference/about/rotate-api-keys#prerequisites)

Create an API keywith an expiry date. If an API key has no expiry date, you can still rotate keys but you aren't notified when the key is about to expire.

[Create an API key](/api-reference/about/api-keys#create-api-key)
> We strongly recommend setting an expiry date for your API keys. API keys can be used to access sensitive data and should be rotated regularly.


We strongly recommend setting an expiry date for your API keys. API keys can be used to access sensitive data and should be rotated regularly.


It's good practice to regularlycheck your API keysinPaddle > Developer tools > Authenticationand ensure none are approaching their expiry date without a replacement being prepared, or none have had exposures that require immediate action.

[check your API keys](/api-reference/about/api-keys#check-api-keys)

## Overview

[Overview](/api-reference/about/rotate-api-keys#overview)

Rotating your API keys follows this workflow:

1. Set up notificationsGet notified when a key is about to expire, has expired, or is exposed.

Set up notifications

[Set up notifications](/api-reference/about/rotate-api-keys#set-up-notifications)

Get notified when a key is about to expire, has expired, or is exposed.

1. Create a new API keyGrab a new key immediately or before the current one expires.

Create a new API key

[Create a new API key](/api-reference/about/rotate-api-keys#create-new-key)

Grab a new key immediately or before the current one expires.

1. Store and use the new keyTransition to using the new key in your app.

Store and use the new key

[Store and use the new key](/api-reference/about/rotate-api-keys#store-use-key)

Transition to using the new key in your app.

1. Check API key activityVerify the new key works and the old key is no longer used.

Check API key activity

[Check API key activity](/api-reference/about/rotate-api-keys#check-api-key-activity)

Verify the new key works and the old key is no longer used.

1. Revoke the old keyStop the old key from working and remove it.

Revoke the old key

[Revoke the old key](/api-reference/about/rotate-api-keys#revoke-old-key)

Stop the old key from working and remove it.


## 1Set up notifications

[1Set up notifications](/api-reference/about/rotate-api-keys#set-up-notifications)

Paddle can notify you when a key is about to expire, has expired, or is exposed to make the rotation process easier and more secure.


You can get notified when a key is about to expire or has expired by subscribing to webhook or email notifications. An API key must have an expiry date set to receive notifications.


Subscribe to theapi_key.expiringnotification, and optionally to theapi_key.expiredas a safety net.

[api_key.expiring](/webhooks/api-keys/api-key-expiring)
[api_key.expired](/webhooks/api-keys/api-key-expired)
> Theapi_key.expiringnotification is always sent seven days before the API key expires.


Theapi_key.expiringnotification is always sent seven days before the API key expires.

1. Go toPaddle > Developer tools > Notifications.

Go toPaddle > Developer tools > Notifications.

1. ClickNew destination

ClickNew destination

1. SelectEmailas the notification type and enter your email address underEmail.

SelectEmailas the notification type and enter your email address underEmail.

1. Selectapi_key.expiringandapi_key.expiredas the events to be notified for.

Selectapi_key.expiringandapi_key.expiredas the events to be notified for.

1. ClickSave destinationwhen you're done.

ClickSave destinationwhen you're done.


Paddle automatically sends an email notification to the owner of your Paddle account when a key is exposed, no matter the severity of the exposure.


Details in the email and on theAPI key exposure dashboard pageshould help you determine if the exposure is a risk to your account.

[API key exposure dashboard page](/api-reference/about/api-keys#check-api-keys-view-exposures)
> Paddle recommends you rotate the key no matter the perceived risk. If you're unsure, always revoke to prevent any damage from unauthorized access.


Paddle recommends you rotate the key no matter the perceived risk. If you're unsure, always revoke to prevent any damage from unauthorized access.


If you want to be notified by webhook when a key is exposed, subscribe to theapi_key_exposure.creatednotification. If the exposure resulted in the key being revoked, you'll also receive anapi_key.revokednotification. Use this as a safety net to take immediate action and mitigate disruption to your app.

[api_key_exposure.created](/webhooks/api-key-exposures/api-key-exposure-created)
[api_key.revoked](/webhooks/api-keys/api-key-revoked)
1. Go toPaddle > Developer tools > Notifications.

Go toPaddle > Developer tools > Notifications.

1. ClickNew destination

ClickNew destination

1. SelectWebhookas the notification type and enter the URL you want to be notified at underURL.

SelectWebhookas the notification type and enter the URL you want to be notified at underURL.

1. Selectapi_key_exposure.createdandapi_key.revokedas the events to be notified for.

Selectapi_key_exposure.createdandapi_key.revokedas the events to be notified for.

1. ClickSave destinationwhen you're done.

ClickSave destinationwhen you're done.


You should now be sent the notifications to the URL you provided when creating the notification destination.Handle those webhook events in your codeto take internal actions, or process them to send requests to a third-party such as Slack.

[Handle those webhook events in your code](/webhooks/respond-to-webhooks)

## 2Create a new API key

[2Create a new API key](/api-reference/about/rotate-api-keys#create-new-key)

Create a new API keyas soon as possible. Plan for an overlap period between old and new keys to allow for a smooth transition without disruption to your app.

[Create a new API key](/api-reference/about/api-keys#create-api-key)
> If you're rotating due to an exposure, prioritize security over convenience and considerrevoking the exposed keyfirst.


If you're rotating due to an exposure, prioritize security over convenience and considerrevoking the exposed keyfirst.

[revoking the exposed key](/api-reference/about/api-keys#revoke-api-key)

When creating a new API key:

- Assign the samepermissionsas the current key.
[permissions](/api-reference/about/permissions)
- Set an appropriate expiry date.
- Add a descriptive name that includes its purpose, team if applicable, and expiry date for easier management.
> API keys can't be created and rotated programmatically. New keys must be manually created in the dashboard and updated in your app.


API keys can't be created and rotated programmatically. New keys must be manually created in the dashboard and updated in your app.


## 3Store and use the new API key

[3Store and use the new API key](/api-reference/about/rotate-api-keys#store-use-key)

API keys are only visible once upon creation.


Store the key safely and replace the old key in all places where your app uses it.

> We recommend using a key management system with version control to track changes to your API keys. This makes it easier to manage key rotation and revert changes if needed.


We recommend using a key management system with version control to track changes to your API keys. This makes it easier to manage key rotation and revert changes if needed.


Follow these optional steps to minimize the risk when transitioning to the new API key.


Manually test API requests with the new API key, either in a controlled environment or by making a testGETrequest to the/eventsor/productsendpoint.


```bash
121curl -X GET https://api.paddle.com/events \
2  -H "Authorization: Bearer pdl_live_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO"
```

> This step isn't necessary if the old key has already beenrevoked, like for an exposure. Replace the old key with the new key immediately.


This step isn't necessary if the old key has already beenrevoked, like for an exposure. Replace the old key with the new key immediately.

[revoked](/api-reference/about/api-keys#revoke-api-key)

Store both your new and old API keys so they're available at the same time. Set up your code to try the new key first, but use the old key as a backup if anything goes wrong.

1. Create a newACTIVE_PADDLE_KEYandOLD_PADDLE_KEYenvironment variable or key in your key management system.

Create a newACTIVE_PADDLE_KEYandOLD_PADDLE_KEYenvironment variable or key in your key management system.

1. Set the new key asACTIVE_PADDLE_KEY.

Set the new key asACTIVE_PADDLE_KEY.

1. Move the old key toOLD_PADDLE_KEYtemporarily.

Move the old key toOLD_PADDLE_KEYtemporarily.

1. Update your code to use eitherACTIVE_PADDLE_KEYorOLD_PADDLE_KEYas the Paddle API key.

Update your code to use eitherACTIVE_PADDLE_KEYorOLD_PADDLE_KEYas the Paddle API key.


This means your app keeps working during the switch, allows testing the new key in real conditions, and provides a fallback if the new key causes problems.


```javascript
11const ACTIVE_PADDLE_KEY = process.env.ACTIVE_PADDLE_KEY || process.env.OLD_PADDLE_KEY;
```


## 4Check API key activity

[4Check API key activity](/api-reference/about/rotate-api-keys#check-api-key-activity)

After updating your app to use the new key, check that:

- The new key is working properlyTest the integration to verify that requests using the new API key are successful. Look at logs, errors, latency, and other metrics to ensure the new key is working properly.

The new key is working properly


Test the integration to verify that requests using the new API key are successful. Look at logs, errors, latency, and other metrics to ensure the new key is working properly.

- The old key is no longer being usedCheck the last used dateof the old API key inPaddle > Developer Tools > Authentication. If the date hasn't changed since the update, it indicates that the old key is no longer being used anywhere in your app.

The old key is no longer being used


Check the last used dateof the old API key inPaddle > Developer Tools > Authentication. If the date hasn't changed since the update, it indicates that the old key is no longer being used anywhere in your app.

[Check the last used date](/api-reference/about/api-keys#check-api-keys)

## 5Revoke the old key

[5Revoke the old key](/api-reference/about/rotate-api-keys#revoke-old-key)

Once you've verified that your app is successfully using the new key and the old key is no longer in use, you can safelyrevoke the old API keyinstead of waiting for it to expire.

[revoke the old API key](/api-reference/about/api-keys#revoke-api-key)

Keep checking your logs to ensure there are no errors upon revoking the old key.

> If a key is accidentally revoked while still in use or errors appear in logs, there is a 60-minute grace period toreactivate the API key. Reactivation isn't possible if the key was revoked due to an exposure.


If a key is accidentally revoked while still in use or errors appear in logs, there is a 60-minute grace period toreactivate the API key. Reactivation isn't possible if the key was revoked due to an exposure.

[reactivate the API key](/api-reference/about/api-keys#reactivate-api-key)

If everything is working as expected, you can safely remove the old key from your key management system, environment variables, or any other places where it's stored. This includes the value of theOLD_PADDLE_KEYif you opted to use two keys simultaneously when switching.


## Related pages

[Related pages](/api-reference/about/rotate-api-keys#related-pages)
[Read more](/api-reference/about/api-keys)
[Read more](/api-reference/about/permissions)
[Read more](/api-reference/about/authentication)
- Rotate API keys
[Rotate API keys](#rotate-api-keys)
- How it works
[How it works](#background)
- Before you begin
[Before you begin](#prerequisites)
- Overview
[Overview](#overview)
- Set up notifications
[Set up notifications](#set-up-notifications)
- Create a new API key
[Create a new API key](#create-new-key)
- Store and use the new API key
[Store and use the new API key](#store-use-key)
- Check API key activity
[Check API key activity](#check-api-key-activity)
- Revoke the old key
[Revoke the old key](#revoke-old-key)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:24:18*
