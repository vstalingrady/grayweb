# Manage API keys

**Source:** https://developer.paddle.com/api-reference/about/api-keys

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

# Manage API keys

[Manage API keys](/api-reference/about/api-keys#manage-api-keys)

Create, update, and revoke API keys used to authenticate server-side requests to the Paddle API.


API keys are secure credentials that authenticate your requests to the Paddle API. They give you programmatic access to create transactions, manage subscriptions, and work with other entities in your Paddle account.

- They're intended only for server-side use.
- They have full access to your data, limited only by thepermissionsassigned to the API key.
[permissions](/api-reference/about/permissions)
- They must be kept secure and secret.

By integrating with the Paddle API using API keys, you can handle provisioning, build more granular custom payment flows, and automate tasks.

> Looking to integrate Paddle in your frontend? UsePaddle.jswithclient-side tokensinstead.


Looking to integrate Paddle in your frontend? UsePaddle.jswithclient-side tokensinstead.

[Paddle.js](/paddlejs/include-paddlejs)
[client-side tokens](/paddlejs/client-side-tokens)

## How it works

[How it works](/api-reference/about/api-keys#background)

When you make requests to the Paddle API, include your API key in theAuthorizationheader to authenticate your request. Paddle uses your API key to identify your account and verify that you have permission to perform the requested action.


```bash
121curl -X GET "https://api.paddle.com/transactions" \
2-H "Authorization: Bearer pdl_sdbx_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO"
```


You're in control over the security and use of your API keys, with key features including:


### Use separate API keys for testing


Useseparate API keys for sandbox and live environmentsto safely test without affecting production data.

[separate API keys for sandbox and live environments](/api-reference/about/api-keys#sandbox-vs-live-keys)

### Check the format of your API keys


Each key follows astandardized formatto make it easier to identify and avoid issues when making requests.

[standardized format](/api-reference/about/api-keys#format)

### Limit access using permissions


Assignpermissionsto your API keys to control what actions they can perform.

[permissions](/api-reference/about/api-keys#permissions)

### Expire and rotate your API keys


Limit the lifetimeof your API keys androtate them regularlyto reduce the risk of exposure.

[Limit the lifetime](/api-reference/about/api-keys#expiration)
[rotate them regularly](/api-reference/about/rotate-api-keys)

### Automatic secret scanning


Paddle automaticallydetects exposed API keysin code repositories and takes the required action to keep your account safe.

[detects exposed API keys](/api-reference/about/api-keys#secret-scanning)

### Store and use API keys securely


Followbest practicesand treat your API keys as sensitive security credentials.

[best practices](/api-reference/about/api-keys#best-practices)

### Sandbox vs live

[Sandbox vs live](/api-reference/about/api-keys#sandbox-vs-live-keys)

Paddle has separate sandbox and live environments, each with their own set of API keys. This separation helps you safely test your integrations, avoids impacting real customer data, and reduces the risk of exposing your API keys.


#### Sandbox API keys

[Sandbox API keys](/api-reference/about/api-keys#sandbox-api-keys)
- Use these keys as you build and test your integration.

Use these keys as you build and test your integration.

- They only work in the sandbox environment where no real money is involved.

They only work in the sandbox environment where no real money is involved.

- Sandbox API keys created after May 6, 2025 containsdbx_.

Sandbox API keys created after May 6, 2025 containsdbx_.

- Create a sandbox API key in thesandbox dashboard.

Create a sandbox API key in thesandbox dashboard.

[sandbox dashboard](https://sandbox-vendors.paddle.com/authentication-v2)

#### Live API keys

[Live API keys](/api-reference/about/api-keys#live-api-keys)
- Use these keys only when you're ready to process real transactions in your production app.

Use these keys only when you're ready to process real transactions in your production app.

- They only work in the live environment where real money is involved.

They only work in the live environment where real money is involved.

- Live API keys created after May 6, 2025 containlive_.

Live API keys created after May 6, 2025 containlive_.

- Create a live API key in thelive dashboard.

Create a live API key in thelive dashboard.

[live dashboard](https://vendors.paddle.com/authentication-v2)

### Format

[Format](/api-reference/about/api-keys#format)
> All API keys created after May 6, 2025 follow the standard format. You can identify these keys by the prefixpdl_. Keys created before this date follow the legacy format.


All API keys created after May 6, 2025 follow the standard format. You can identify these keys by the prefixpdl_. Keys created before this date follow the legacy format.


API keys always follow a specific format.

- Always start withpdl_to identify them as Paddle API keys.
- Contain eitherlive_orsdbx_after the prefix to identify theenvironmentthey're used for.
[environment](/api-reference/about/api-keys#sandbox-vs-live-keys)
- Haveapikey_after the environment to identify them as API keys instead ofclient-side tokens.
[client-side tokens](/paddlejs/client-side-tokens)
- Have five underscores (_) within the key.
- Are 69 characters in length.

```bash
121pdl_live_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO
2pdl_sdbx_apikey_01gtgztp8f4kek3yd4g1wrksa3_q6TGTJyvoIz7LDtXT65bX7_AQO
```


```bash
11^pdl_(live|sdbx)_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}
```

> API keys are case-sensitive.


API keys are case-sensitive.


### Permissions

[Permissions](/api-reference/about/api-keys#permissions)

When youcreate an API key, you must select whichpermissionsto assign to it. You can select multiple permissions for a single key.

[create an API key](/api-reference/about/api-keys#create-api-key)
[permissions](/api-reference/about/permissions)

You can have multiple API keys with different permissions. This lets you control which app or integration has access to which parts of your Paddle account.


To change the permissions assigned to an API key,edit the API key.

[edit the API key](/api-reference/about/api-keys#edit-api-key)
> Requests made with API keys that don't have the required permissions return aforbiddenerror (403).


Requests made with API keys that don't have the required permissions return aforbiddenerror (403).

[forbidden](/errors/shared/forbidden)

### Expiration

[Expiration](/api-reference/about/api-keys#expiration)

API keys can have an expiry date. This is the date when the API key is no longer valid. Expiry dates are useful to limit the lifetime of a key and reduce the risk of exposure.


You can set the expiry date when youcreate the API key. The default expiry date is 90 days from the date of creation and can't be more than one year from the date of creation.

[create the API key](/api-reference/about/api-keys#create-api-key)
> We strongly recommend setting an expiry date for your API keys. API keys can be used to access sensitive data and should be rotated regularly.


We strongly recommend setting an expiry date for your API keys. API keys can be used to access sensitive data and should be rotated regularly.


You can subscribe to receive an email or a webhook when API keys are expiring and when they have expired:


| api_key.expiring | Occurs when an API key expires in seven days. |
| api_key.expired | Occurs when an API key has expired. |

[api_key.expiring](/webhooks/api-keys/api-key-expiring)
[api_key.expired](/webhooks/api-keys/api-key-expired)

When you get a notification,rotate your API keysbefore they expire.

[rotate your API keys](/api-reference/about/rotate-api-keys)

Once a key has expired, it's no longer valid and can't be revalidated.Create a new API keyto rotate.

[Create a new API key](/api-reference/about/api-keys#create-api-key)
> You can't update the expiry date of an existing API key. If you need to change the expiry date, you mustcreate a new API keyandrevoke the old one.


You can't update the expiry date of an existing API key. If you need to change the expiry date, you mustcreate a new API keyandrevoke the old one.

[create a new API key](/api-reference/about/api-keys#create-api-key)
[revoke the old one](/api-reference/about/api-keys#revoke-api-key)

### Secret scanning

[Secret scanning](/api-reference/about/api-keys#secret-scanning)

Paddle automatically monitors public repositories on GitHub to detect when your API keys are accidentally exposed. This helps protect your account from unauthorized access and potential security breaches.


When an API key is detected in a repository, Paddle assesses the risk level and takes appropriate action.


| Risk level | Meaning | API key status |
| --- | --- | --- |
| High | Exposed publicly, like in a public GitHub repository. | Automatically revoked to protect your account. |
| Low | Already expired or revoked. | Already inactive. |


The recommended follow-up actions you should take depend on the risk level:

- Replace the keyCreate a new API keyin the dashboard and update all applications or services that use the revoked key.

Replace the key


Create a new API keyin the dashboard and update all applications or services that use the revoked key.

[Create a new API key](/api-reference/about/api-keys#create-api-key)
- Investigate the exposureReview the source of the leak to understand how it happened and prevent future exposures.

Investigate the exposure


Review the source of the leak to understand how it happened and prevent future exposures.

- Audit for malicious activityReview your logs for any unauthorized calls made by this key before its revocation.

Audit for malicious activity


Review your logs for any unauthorized calls made by this key before its revocation.


As this is purely informational, there is no current risk to your account. We recommend auditing your security practices and investigating how this inactive key was exposed to prevent it from happening again.


When an exposure is detected, you'll receive an immediate notification through email. These are sent automatically to the owner of your Paddle account.


You can optionallysubscribe to webhook notificationsfor API key exposure events.

[subscribe to webhook notifications](/webhooks/notification-destinations)

| Webhook | Description |
| --- | --- |
| api_key_exposure.created | Occurs when an exposure is detected. |
| api_key.revoked | Occurs when a key is automatically revoked. |

[api_key_exposure.created](/webhooks/api-key-exposures/api-key-exposure-created)
[api_key.revoked](/webhooks/api-keys/api-key-revoked)

All exposures are tracked andvisible in the dashboardfor transparency and security auditing.

[visible in the dashboard](/api-reference/about/api-keys#check-api-keys-view-exposures)

### Best practices

[Best practices](/api-reference/about/api-keys#best-practices)

Your API key is a sensitive security credential. It gives you access to your Paddle account and can be used to make changes to your account. If bad actors gain access to your API key, it can harm your business.

> Treat your API key like a password. Keep it safe and never share it with apps or people you don't trust.


Treat your API key like a password. Keep it safe and never share it with apps or people you don't trust.


For this reason, API keys can only ever be viewed once and must immediately be stored securely after creation. If you lose your API key, you mustrevoke itandcreate a new one.

[revoke it](/api-reference/about/api-keys#revoke-api-key)
[create a new one](/api-reference/about/api-keys#create-api-key)

You and your team are responsible for storing your API keys safely. Follow these best practices to help protect your API keys:


#### Always

[Always](/api-reference/about/api-keys#always)
- Set an expiry date for your API keys.

Set an expiry date for your API keys.

- Rotate your API keys regularly.

Rotate your API keys regularly.

- Use environment variables or credential management systems to store your API key.

Use environment variables or credential management systems to store your API key.


#### Never

[Never](/api-reference/about/api-keys#never)
- Share your API key in emails or chat.

Share your API key in emails or chat.

- Hardcode your API key in your code.

Hardcode your API key in your code.

- Include API keys in client-side code.

Include API keys in client-side code.

- Store your API key in a public or accessible location.

Store your API key in a public or accessible location.


## Create an API key

[Create an API key](/api-reference/about/api-keys#create-api-key)

### Create in the dashboard

[Create in the dashboard](/api-reference/about/api-keys#create-in-the-dashboard)
1. Go toPaddle > Developer Tools > Authentication.

Go toPaddle > Developer Tools > Authentication.

1. Click theAPI keystab.

Click theAPI keystab.

1. ClickNew API key

ClickNew API key


### Add preliminary details

[Add preliminary details](/api-reference/about/api-keys#add-preliminary-details)
1. Enter a nameThis should be a human-readable name that you can use to uniquely identify this key.

Enter a name


This should be a human-readable name that you can use to uniquely identify this key.

1. Add a descriptionThis should be a human-readable description of the API key that has details about what the API key is used for and where.

Add a description


This should be a human-readable description of the API key that has details about what the API key is used for and where.


### Set an expiry date

[Set an expiry date](/api-reference/about/api-keys#set-an-expiry-date)
1. Click theExpires onfield.

Click theExpires onfield.

1. Choose a date in the future. The default is 90 days from the date of creation if untouched.

Choose a date in the future. The default is 90 days from the date of creation if untouched.


### Set permissions

[Set permissions](/api-reference/about/api-keys#set-permissions)
1. Review thepermissions reference guideto understand the permissions you need to assign to the API key.

Review thepermissions reference guideto understand the permissions you need to assign to the API key.

[permissions reference guide](/api-reference/about/permissions)
1. Select only the permissions needed. SelectAllif your key needs either read or write access to all entities.

Select only the permissions needed. SelectAllif your key needs either read or write access to all entities.


### Save the API key

[Save the API key](/api-reference/about/api-keys#save-the-api-key)
1. ClickSavewhen you're done.

ClickSavewhen you're done.

1. The API key is created and displayed on the page. It's only visible once.Store it securely.

The API key is created and displayed on the page. It's only visible once.Store it securely.

[Store it securely](/api-reference/about/api-keys#best-practices)
> You're ready to use the API key toauthenticate requeststo the Paddle API.


You're ready to use the API key toauthenticate requeststo the Paddle API.

[authenticate requests](/api-reference/about/authentication)

## Edit an API key

[Edit an API key](/api-reference/about/api-keys#edit-api-key)

You can edit the name, description, andpermissionsassigned to an API key. You can't update:

[permissions](/api-reference/about/permissions)
- Expiry datesYou mustcreate a new API keywith the desired expiry date andrevoke the old one.

Expiry dates


You mustcreate a new API keywith the desired expiry date andrevoke the old one.

[create a new API key](/api-reference/about/api-keys#create-api-key)
[revoke the old one](/api-reference/about/api-keys#revoke-api-key)
- Expired keysOnce keys have expired, they're no longer valid and can't be revalidated.Create a new API keyand rotate the old key.

Expired keys


Once keys have expired, they're no longer valid and can't be revalidated.Create a new API keyand rotate the old key.

[Create a new API key](/api-reference/about/api-keys#create-api-key)
1. Go toPaddle > Developer Tools > Authentication.

Go toPaddle > Developer Tools > Authentication.

1. Click theAPI keystab.

Click theAPI keystab.

1. Click theoverflow buttonbutton next to the API key you want to edit, then chooseEdit

Click theoverflow buttonbutton next to the API key you want to edit, then chooseEdit

1. Enter a new name and description for the API key.

Enter a new name and description for the API key.

1. Select and clear the permissions you want to assign and unassign from the API key.

Select and clear the permissions you want to assign and unassign from the API key.

1. ClickSavewhen you're done.

ClickSavewhen you're done.


## Revoke an API key

[Revoke an API key](/api-reference/about/api-keys#revoke-api-key)

You can revoke an API key at any time. You might do this when a key isexpiring. We recommendrotating keysat regular intervals for your security.

[expiring](/api-reference/about/api-keys#expiration)
[rotating keys](/api-reference/about/rotate-api-keys)
> Revoked API keys have a 60-minute grace period during which you canreactivate the key. After this time, the key is permanently revoked. You mustcreate a new API key.


Revoked API keys have a 60-minute grace period during which you canreactivate the key. After this time, the key is permanently revoked. You mustcreate a new API key.

[reactivate the key](/api-reference/about/api-keys#reactivate-api-key)
[create a new API key](/api-reference/about/api-keys#create-api-key)
1. Go toPaddle > Developer Tools > Authentication.

Go toPaddle > Developer Tools > Authentication.

1. Click theAPI keystab.

Click theAPI keystab.

1. Click theoverflow buttonbutton next to the API key you want to revoke, then chooseRevoke

Click theoverflow buttonbutton next to the API key you want to revoke, then chooseRevoke

1. Confirm you want to revoke the API key by filling in the confirmation box, then clickingRevoke

Confirm you want to revoke the API key by filling in the confirmation box, then clickingRevoke


## Reactivate an API key

[Reactivate an API key](/api-reference/about/api-keys#reactivate-api-key)

API keys have a 60-minute grace period to be reactivated after they're revoked. They can only be reactivated if they were revoked by a user and not by Paddle.


You can't reactivate an API key after this grace period has expired. You mustcreate a new API key.

[create a new API key](/api-reference/about/api-keys#create-api-key)
> Legacy keys created before May 6, 2025 and API keys that were automatically revoked by Paddle, like those that hadhigh risk exposures, can't be reactivated.Create a new standard format API keyinstead.


Legacy keys created before May 6, 2025 and API keys that were automatically revoked by Paddle, like those that hadhigh risk exposures, can't be reactivated.Create a new standard format API keyinstead.

[high risk exposures](/api-reference/about/api-keys#check-api-keys-view-exposures)
[Create a new standard format API key](/api-reference/about/api-keys#create-api-key)
1. Go toPaddle > Developer Tools > Authentication.

Go toPaddle > Developer Tools > Authentication.

1. Click theAPI keystab.

Click theAPI keystab.

1. Click theoverflow buttonbutton next to the API key you want to reactivate, then chooseReactivate

Click theoverflow buttonbutton next to the API key you want to reactivate, then chooseReactivate

1. ClickReactivate

ClickReactivate


## Check API keys

[Check API keys](/api-reference/about/api-keys#check-api-keys)

Regularly check your API keys to monitor their lifecycle and security. This helps you identify which keys are active, expiring soon, or expired, as well as detect unexpected usage that could indicate potential security risks.


### View API keys

[View API keys](/api-reference/about/api-keys#check-api-keys-view)
1. Go toPaddle > Developer Tools > Authentication.

Go toPaddle > Developer Tools > Authentication.

1. Click theAPI keystab.

Click theAPI keystab.


### Review the status

[Review the status](/api-reference/about/api-keys#check-api-keys-review-status)

Identify the status of API keys to determine what actions, if any, you should take.

- ActiveThe key is valid and can be used toauthenticate requests. Audit where and when it's used.

Active


The key is valid and can be used toauthenticate requests. Audit where and when it's used.

[authenticate requests](/api-reference/about/authentication)
- Expiring soonThe key is approaching its expiry date. Plan torotate itbefore it expires.

Expiring soon


The key is approaching its expiry date. Plan torotate itbefore it expires.

[rotate it](/api-reference/about/rotate-api-keys)
- ExpiredThe key has expired past itsexpiry date. Replace it with anew keyif you haven't already.

Expired


The key has expired past itsexpiry date. Replace it with anew keyif you haven't already.

[expiry date](/api-reference/about/api-keys#expiration)
[new key](/api-reference/about/api-keys#create-api-key)

### Check the last used date

[Check the last used date](/api-reference/about/api-keys#check-api-keys-last-used)

For all keys that are active, check theLast usedcolumn to see when each key was last used. Look for:

- Unexpected usage that could indicate a compromised key.

Unexpected usage that could indicate a compromised key.

- Inactive keys that may be candidates for rotation or removal.

Inactive keys that may be candidates for rotation or removal.

- Keys that were rotated recently to confirm they're no longer used.

Keys that were rotated recently to confirm they're no longer used.


If any of the above apply,rotateorrevokethe keys.

[rotate](/api-reference/about/rotate-api-keys)
[revoke](/api-reference/about/api-keys#revoke-api-key)

### View API key exposures

[View API key exposures](/api-reference/about/api-keys#check-api-keys-view-exposures)

View details about any API key exposures that have been detected by Paddle's secret scanning system.

1. Go toPaddle>Developer Tools>Authentication.

Go toPaddle>Developer Tools>Authentication.

1. Click theAPI keystab.

Click theAPI keystab.

1. Click theoverflow buttonbutton next to any API key, then chooseView exposures.

Click theoverflow buttonbutton next to any API key, then chooseView exposures.


### Review exposure details

[Review exposure details](/api-reference/about/api-keys#check-api-keys-review-exposure-details)

For each exposure, you can see:


| Risk level | High or Low based on theexposure circumstances. |
| Detection date | When the exposure was discovered. |
| Source | Where this exposure occurred. |
| Reference | Where the key was exactly found as exposed. |
| Action taken | Whether the key was automatically revoked. |

[exposure circumstances](/api-reference/about/api-keys#secret-scanning)

Use this information to:

- Understand how the exposure occurred.

Understand how the exposure occurred.

- Audit for any unauthorized usage and determine if you need torotatethe key.

Audit for any unauthorized usage and determine if you need torotatethe key.

[rotate](/api-reference/about/rotate-api-keys)
- Improve your security practices to prevent future exposures.

Improve your security practices to prevent future exposures.


## Common errors

[Common errors](/api-reference/about/api-keys#common-errors)

| invalid_token | The API key you're trying to access isn't correct. Check that you have provided thecorrect API key, that it's in thecorrect environment, and that it hasn't beenrevoked. |
| forbidden | The API key you're trying to use doesn't have the required permissions to perform the requested action. Check that the API key has the necessarypermissions. |

[invalid_token](/errors/shared/invalid_token)
[correct API key](/api-reference/about/api-keys#format)
[correct environment](/api-reference/about/api-keys#sandbox-vs-live-keys)
[revoked](/api-reference/about/api-keys#revoke-api-key)
[forbidden](/errors/shared/forbidden)
[permissions](/api-reference/about/api-keys#permissions)

## Events

[Events](/api-reference/about/api-keys#related-notifications)

| api_key.created | Occurs when an API key is created. |
| api_key.updated | Occurs when an API key is updated. |
| api_key.expiring | Occurs when an API key expires in seven days. |
| api_key.expired | Occurs when an API key has expired. |
| api_key.revoked | Occurs when an API key is revoked. |
| api_key_exposure.created | Occurs when an API key has been detected as exposed. |

[api_key.created](/webhooks/api-keys/api-key-created)
[api_key.updated](/webhooks/api-keys/api-key-updated)
[api_key.expiring](/webhooks/api-keys/api-key-expiring)
[api_key.expired](/webhooks/api-keys/api-key-expired)
[api_key.revoked](/webhooks/api-keys/api-key-revoked)
[api_key_exposure.created](/webhooks/api-key-exposures/api-key-exposure-created)

## Related pages

[Related pages](/api-reference/about/api-keys#related-pages)
[Read more](/api-reference/about/authentication)
[Read more](/api-reference/about/permissions)
[Read more](/api-reference/about/rotate-api-keys)
- Manage API keys
[Manage API keys](#manage-api-keys)
- How it works
[How it works](#background)
- Sandbox vs live
[Sandbox vs live](#sandbox-vs-live-keys)
- Format
[Format](#format)
- Permissions
[Permissions](#permissions)
- Expiration
[Expiration](#expiration)
- Secret scanning
[Secret scanning](#secret-scanning)
- Best practices
[Best practices](#best-practices)
- Create an API key
[Create an API key](#create-api-key)
- Create in the dashboard
[Create in the dashboard](#create-in-the-dashboard)
- Add preliminary details
[Add preliminary details](#add-preliminary-details)
- Set an expiry date
[Set an expiry date](#set-an-expiry-date)
- Set permissions
[Set permissions](#set-permissions)
- Save the API key
[Save the API key](#save-the-api-key)
- Edit an API key
[Edit an API key](#edit-api-key)
- Revoke an API key
[Revoke an API key](#revoke-api-key)
- Reactivate an API key
[Reactivate an API key](#reactivate-api-key)
- Check API keys
[Check API keys](#check-api-keys)
- View API keys
[View API keys](#check-api-keys-view)
- Review the status
[Review the status](#check-api-keys-review-status)
- Check the last used date
[Check the last used date](#check-api-keys-last-used)
- View API key exposures
[View API key exposures](#check-api-keys-view-exposures)
- Review exposure details
[Review exposure details](#check-api-keys-review-exposure-details)
- Common errors
[Common errors](#common-errors)
- Events
[Events](#related-notifications)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:24:36*
