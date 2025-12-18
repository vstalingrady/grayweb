# Paddle IDs

**Source:** https://developer.paddle.com/api-reference/about/paddle-ids

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

# Paddle IDs

[Paddle IDs](/api-reference/about/paddle-ids#paddle-ids)

Paddle IDs are unique identifiers for entities in Paddle. They easily identifiable by type and lexicographically sortable.


Every entity in Paddle has a unique identifier, called a Paddle ID. Paddle IDs are made up of a prefix for the kind of entity, followed by a unique string of 26 alphanumeric characters.


Prefixes are typically three characters, but may be longer. They're distinctive, so it's easy to tell what kind of entity you're working with when using a Paddle ID.


## Common examples

[Common examples](/api-reference/about/paddle-ids#common-examples)

For example, here are some common Paddle IDs:


| Entity | Prefix | Regex | Example |
| --- | --- | --- | --- |
| Address | add_ | ^add_[a-z\d]{26}$ | add_01gt202fr8131gahn63v9tczgm |
| Adjustment | adj_ | ^adj_[a-z\d]{26}$ | adj_01ghvjt9dbpnndeqjve8cktgqs |
| Business | biz_ | ^biz_[a-z\d]{26}$ | biz_01gsz92krfzy3hcx5h5rtgnfwz |
| Customer | ctm_ | ^ctm_[a-z\d]{26}$ | ctm_01gt202fpjt0e63p942gw4ybvh |
| Discount | dsc_ | ^dsc_[a-z\d]{26}$ | dsc_01gt218xfk7yztpvgmcazkes83 |
| Event | evt_ | ^evt_[a-z\d]{26}$ | evt_01gt261mpgnbg1f3875zx2dsrd |
| Notification | ntf_ | ^nft_[a-z\d]{26}$ | ntf_01gtyac3x932yhfppx6w9x4zsb |
| Notification destination | nftset_ | ^nftset_[a-z\d]{26}$ | ntfset_01gtyac3wjcdtjs8csc0219x1p |
| Product | pro_ | ^pro_[a-z\d]{26}$ | pro_01gsz4vmqbjk3x4vvtafffd540 |
| Price | pri_ | ^pri_[a-z\d]{26}$ | pri_01gsz91wy9k1yn7kx82aafwvea |
| Report | rep_ | ^rep_[a-z\d]{26}$ | rep_01hvgdpayq6kjzyk4hz5m02cpn |
| Subscription | sub_ | ^sub_[a-z\d]{26}$ | sub_01gvne45dvdhg5gdxrz6hh511r |
| Transaction | txn_ | ^txn_[a-z\d]{26}$ | txn_01gt261m3y0bngp73j1j8c6dge |

[Address](/api-reference/addresses/overview)
[Adjustment](/api-reference/adjustments/overview)
[Business](/api-reference/businesses/overview)
`biz_`
`^biz_[a-z\d]{26}$`
`biz_01gsz92krfzy3hcx5h5rtgnfwz`
[Customer](/api-reference/customers/overview)
`ctm_`
`^ctm_[a-z\d]{26}$`
`ctm_01gt202fpjt0e63p942gw4ybvh`
[Discount](/api-reference/discounts/overview)
`dsc_`
`^dsc_[a-z\d]{26}$`
`dsc_01gt218xfk7yztpvgmcazkes83`
[Event](/api-reference/events/overview)
`evt_`
`^evt_[a-z\d]{26}$`
`evt_01gt261mpgnbg1f3875zx2dsrd`
[Notification](/api-reference/notifications/overview)
`ntf_`
`^nft_[a-z\d]{26}$`
`ntf_01gtyac3x932yhfppx6w9x4zsb`
[Notification destination](/api-reference/notification-settings/overview)
`nftset_`
`^nftset_[a-z\d]{26}$`
`ntfset_01gtyac3wjcdtjs8csc0219x1p`
[Product](/api-reference/products/overview)
`pro_`
`^pro_[a-z\d]{26}$`
`pro_01gsz4vmqbjk3x4vvtafffd540`
[Price](/api-reference/prices/overview)
`pri_`
`^pri_[a-z\d]{26}$`
`pri_01gsz91wy9k1yn7kx82aafwvea`
[Report](/api-reference/reports/overview)
`rep_`
`^rep_[a-z\d]{26}$`
`rep_01hvgdpayq6kjzyk4hz5m02cpn`
[Subscription](/api-reference/subscriptions/overview)
`sub_`
`^sub_[a-z\d]{26}$`
`sub_01gvne45dvdhg5gdxrz6hh511r`
[Transaction](/api-reference/transactions/overview)
`txn_`
`^txn_[a-z\d]{26}$`
`txn_01gt261m3y0bngp73j1j8c6dge`

## Work with IDs

[Work with IDs](/api-reference/about/paddle-ids#work-with-ids)

Paddle automatically generates IDs for you when you create entities using the API or dashboard. Use Paddle IDs to refer to entities throughout the Paddle platform.


### Create entities

[Create entities](/api-reference/about/paddle-ids#create-entities)

When creating entities using the API, Paddle returns the new Paddle ID for the entity in the response.


### Get entities

[Get entities](/api-reference/about/paddle-ids#get-entities)

When reading, updating, or deleting entities, use the ID to refer to the correct entity. For example:


Paddle ID of the product to get.


### List entities

[List entities](/api-reference/about/paddle-ids#list-entities)

When working with list endpoints, Paddle uses the Paddle ID of the entity you're working with as the cursor forpagination.

[pagination](/api-reference/about/pagination)

Return entities after the specified cursor.


Paddle ID of the product to use as the cursor.


### Relate entities

[Relate entities](/api-reference/about/paddle-ids#relate-entities)

Where entities are related, use Paddle IDs to link them. For example:

- Whencreating a price, pass aproduct_idto set the product that a price relates to.
[creating a price](/api-reference/prices/create-price)
- Whencreating a transaction, pass acustomer_idandaddress_idto set who to bill.
[creating a transaction](/api-reference/transactions/create-transaction)
- When thesubscription.createdevent occurs, it includes thetransaction_idof the transaction that resulted in this subscription being created.
[subscription.created](/webhooks/subscriptions/subscription-created)

## Sort by ID

[Sort by ID](/api-reference/about/paddle-ids#sort-by-id)

Paddle IDs are lexicographically sortable.Sortingby Paddle ID results in the same order as sorting by the creation date of an entity.

[Sorting](/api-reference/about/filter-search-sort)

## Related pages

[Related pages](/api-reference/about/paddle-ids#related-pages)
[Read more](/api-reference/about/include-entities)
[Read more](/api-reference/about/data-types)
- Paddle IDs
[Paddle IDs](#paddle-ids)
- Common examples
[Common examples](#common-examples)
- Work with IDs
[Work with IDs](#work-with-ids)
- Create entities
[Create entities](#create-entities)
- Get entities
[Get entities](#get-entities)
- List entities
[List entities](#list-entities)
- Relate entities
[Relate entities](#relate-entities)
- Sort by ID
[Sort by ID](#sort-by-id)
- Related pages
[Related pages](#related-pages)

---

*Last scraped: 2025-12-15 20:24:32*
