# Commerce Domain Specification
## نطاق المتجر الإلكتروني — AlharisTech Platform

**Domain ID:** `commerce`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 1
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Commerce domain is responsible for:
- Product catalog management (CRUD, search, filtering)
- Category hierarchy and navigation
- Shopping cart session management
- Checkout flow (address → shipping → payment → confirmation)
- Commerce order lifecycle (distinct from service orders in the Service domain)
- Inventory tracking and reservation
- Shipping and fulfillment tracking
- Coupons and discount management (Phase 2)

### What Commerce does NOT manage
- Payment processing (→ delegates to Billing domain via domain events)
- Invoice generation (→ delegates to Billing domain)
- Customer profiles (→ Customer domain; Commerce references customer_id)
- User authentication/authorization (→ Identity domain)
- Notification delivery (→ delegates to Notification domain)
- Service orders (→ Service domain — commerce orders are distinct)

### Relationships
```
Commerce ──► references ──► Customer (customer_id)
Commerce ──► references ──► Identity (user_id for admin operations)
Commerce ──► publishes OrderPlaced ──► Billing (invoice), Notification (order confirmation)
Commerce ──► publishes PaymentCompleted ──► Shipping, Notification
Commerce ──► publishes InventoryDepleted ──► Notification (admin alert)
Commerce ──► publishes ShipmentCreated ──► Notification (customer tracking)
```

---

## 2. Aggregates

### 2.1 Product Aggregate
**Root Entity:** Product

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name_ar | VARCHAR(255) | Required, 1-255 chars |
| name_en | VARCHAR(255) | Required, 1-255 chars |
| slug | VARCHAR(300) | Unique, auto-generated from name_en |
| description_ar | TEXT | Required |
| description_en | TEXT | Required |
| price | DECIMAL(12,2) | Required, >= 0 |
| compare_at_price | DECIMAL(12,2) | Nullable, > price if set |
| cost_price | DECIMAL(12,2) | Nullable, internal use |
| sku | VARCHAR(100) | Unique, required |
| barcode | VARCHAR(100) | Nullable, unique |
| images | JSONB | Array of {url, alt_ar, alt_en, sort_order} |
| thumbnail | VARCHAR(500) | Primary display image URL |
| category_id | UUID | FK → categories.id, nullable |
| tags | JSONB | Array of tag strings, default [] |
| attributes | JSONB | Arbitrary key-value pairs, default {} |
| is_active | BOOLEAN | Default: true |
| is_featured | BOOLEAN | Default: false |
| is_digital | BOOLEAN | Default: false |
| weight_kg | DECIMAL(8,3) | Nullable |
| dimensions_cm | JSONB | Nullable, {length, width, height} |
| seo_meta | JSONB | Nullable, {title_ar, title_en, description_ar, description_en} |
| deleted_at | TIMESTAMP | Nullable, soft delete |
| created_by | UUID | FK → users.id |
| updated_by | UUID | FK → users.id |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Child Entity: PriceHistory**

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| product_id | UUID | FK → products.id |
| old_price | DECIMAL(12,2) | Previous price |
| new_price | DECIMAL(12,2) | New price |
| changed_by | UUID | FK → users.id |
| reason | VARCHAR(500) | Optional |
| changed_at | TIMESTAMP | Auto |

**Child Entity: ProductReview**

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| product_id | UUID | FK → products.id |
| customer_id | UUID | FK → customers.id |
| rating | SMALLINT | 1-5 |
| title | VARCHAR(255) | Optional |
| body | TEXT | Optional |
| is_approved | BOOLEAN | Default: false (moderation) |
| is_verified_purchase | BOOLEAN | Default: false |
| created_at | TIMESTAMP | Auto |

### 2.2 Category Aggregate
**Root Entity:** Category

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name_ar | VARCHAR(200) | Required |
| name_en | VARCHAR(200) | Required |
| slug | VARCHAR(250) | Unique, auto-generated from name_en |
| description_ar | TEXT | Nullable |
| description_en | TEXT | Nullable |
| image | VARCHAR(500) | Nullable, category image URL |
| parent_id | UUID | FK → categories.id, nullable, self-referencing |
| sort_order | INTEGER | Default: 0 |
| is_active | BOOLEAN | Default: true |
| depth | INTEGER | Cached depth from root (0-based), computed |
| path | JSONB | Materialized path array of IDs, computed |
| deleted_at | TIMESTAMP | Nullable, soft delete |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Invariants:**
- A category cannot be its own parent (no cycles)
- Deleting a category with children → children must be reassigned or also soft-deleted
- Maximum nesting depth: 4 levels

### 2.3 Cart Aggregate
**Root Entity:** Cart

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| customer_id | UUID | FK → customers.id, nullable (anonymous carts) |
| session_id | VARCHAR(100) | Required for anonymous, unique |
| status | ENUM(active, abandoned, converted) | Default: active |
| expires_at | TIMESTAMP | 7 days for anonymous, 30 days for customers |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Child Entity: CartItem**

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| cart_id | UUID | FK → carts.id, ON DELETE CASCADE |
| product_id | UUID | FK → products.id |
| quantity | INTEGER | Required, >= 1 |
| unit_price | DECIMAL(12,2) | Snapshot of product price at add time |
| added_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Invariants:**
- CartItem.product_id must reference an active (is_active=true, deleted_at IS NULL) product
- CartItem.quantity must not exceed available inventory (checked at addition time, advisory)
- A customer may have at most 1 active cart; anonymous carts identified by session_id
- Cart total = SUM(cart_items.quantity * cart_items.unit_price)

### 2.4 Order Aggregate
**Root Entity:** CommerceOrder

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| order_number | VARCHAR(20) | Unique, format: ORD-{YYYY}-{6-digit sequence} |
| customer_id | UUID | FK → customers.id |
| status | ENUM(pending, confirmed, processing, shipped, delivered, cancelled, refunded, partially_refunded) | Default: pending |
| sub_total | DECIMAL(12,2) | Sum of item totals before discounts |
| discount_amount | DECIMAL(12,2) | Default: 0 |
| shipping_amount | DECIMAL(12,2) | Default: 0 |
| tax_amount | DECIMAL(12,2) | Default: 0 |
| total | DECIMAL(12,2) | Computed: sub_total - discount + shipping + tax |
| currency | VARCHAR(3) | Default: SAR |
| items | JSONB | Snapshot array of {product_id, name_ar, name_en, sku, quantity, unit_price, total} |
| shipping_address | JSONB | Required at checkout: {full_name, phone, address_line1, address_line2, city, state, postal_code, country} |
| billing_address | JSONB | Nullable, same as shipping if not provided |
| payment_status | ENUM(pending, authorized, paid, failed, refunded, partially_refunded) | Default: pending |
| payment_method | VARCHAR(50) | e.g., "card", "bank_transfer", "cod" |
| payment_id | VARCHAR(255) | Nullable, external payment gateway reference |
| shipping_method | VARCHAR(50) | e.g., "standard", "express", "pickup" |
| tracking_number | VARCHAR(100) | Nullable |
| estimated_delivery | DATE | Nullable |
| notes | TEXT | Nullable, customer notes |
| internal_notes | TEXT | Nullable, staff-only notes |
| coupon_code | VARCHAR(50) | Nullable |
| placed_at | TIMESTAMP | When order transitions from pending → confirmed |
| shipped_at | TIMESTAMP | Nullable |
| delivered_at | TIMESTAMP | Nullable |
| cancelled_at | TIMESTAMP | Nullable |
| cancelled_reason | VARCHAR(500) | Required if status = cancelled |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Child Entity: OrderStatusHistory**

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| order_id | UUID | FK → commerce_orders.id |
| old_status | ENUM | Nullable (null for initial status) |
| new_status | ENUM | Required |
| changed_by | UUID | FK → users.id, nullable (system changes) |
| note | VARCHAR(500) | Optional |
| created_at | TIMESTAMP | Auto |

**Invariants:**
- An order cannot be cancelled once shipped (status >= shipped)
- Total must be > 0
- Status transitions follow a strict state machine (see Business Rules)
- Payment status must reach `paid` before order transitions to `processing`

### 2.5 Inventory Aggregate
**Root Entity:** Inventory

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| product_id | UUID | FK → products.id, unique (1:1) |
| quantity_available | INTEGER | Default: 0, >= 0 |
| quantity_reserved | INTEGER | Default: 0, >= 0 |
| quantity_sold | INTEGER | Default: 0, running counter |
| low_stock_threshold | INTEGER | Default: 5 |
| is_tracked | BOOLEAN | Default: true, false for digital/unlimited products |
| warehouse_location | VARCHAR(100) | Nullable |
| last_restock_date | TIMESTAMP | Nullable |
| last_restock_quantity | INTEGER | Nullable |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Computed values:**
- `sellable_quantity` = quantity_available - quantity_reserved
- `is_low_stock` = (quantity_available - quantity_reserved) <= low_stock_threshold

**Invariants:**
- quantity_reserved cannot exceed quantity_available
- reservation is released if order is cancelled before shipment
- Decrementing quantity_available automatically increments quantity_sold

**RBAC Matrix for Commerce:**

| Resource | Admin | Manager | Employee | Customer | Partner |
|:---|:---|:---|:---|:---|:---|
| products (read) | Read | Read | Read | Read | Read |
| products (write) | CRUD | CRUD | — | — | — |
| categories (read) | Read | Read | Read | Read | Read |
| categories (write) | CRUD | CRUD | — | — | — |
| cart | CRUD (any) | CRUD (any) | CRUD (any) | CRUD (own) | CRUD (own) |
| commerce_orders (read) | Read all | Read all | Read all | Read (own) | Read (assigned) |
| commerce_orders (write) | PATCH status | PATCH status | — | Create | — |
| inventory (read) | Read all | Read all | Read all | — | — |
| inventory (write) | PATCH quantity | PATCH quantity | — | — | — |
| coupons (read) | Read all | Read all | Read all | Apply (own) | — |
| coupons (write) | CRUD | CRUD | — | — | — |
| reviews (read) | Read all | Read all | Read all | Read all | — |
| reviews (write) | CRUD | Moderate | — | Create (own) | — |
| price_history | Read all | Read all | — | — | — |

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `ProductCreated` | New product added to catalog | `{ productId, sku, name_en, categoryId, createdBy, timestamp }` | Search indexing, Notification (if featured) |
| `ProductUpdated` | Product details modified | `{ productId, changedFields[], updatedBy, timestamp }` | Search indexing |
| `ProductPriceChanged` | Product price is modified | `{ productId, sku, oldPrice, newPrice, changedBy, reason, timestamp }` | PriceHistory (record), Notification (wishlist customers) |
| `ProductDeleted` | Product soft-deleted | `{ productId, sku, deletedBy, timestamp }` | Search indexing (remove), Cart (alert), Inventory (release) |
| `ProductActivated` | Product activated/deactivated | `{ productId, isActive, changedBy, timestamp }` | Search indexing |
| `ItemAddedToCart` | Customer adds item to cart | `{ cartId, customerId, productId, quantity, unitPrice, timestamp }` | — |
| `ItemRemovedFromCart` | Customer removes item from cart | `{ cartId, customerId, productId, timestamp }` | — |
| `CartAbandoned` | Cart expires without conversion | `{ cartId, customerId, items[], cartTotal, timestamp }` | Analytics, Marketing (Phase 2) |
| `OrderPlaced` | Customer completes checkout | `{ orderId, orderNumber, customerId, items[], total, currency, shippingAddress, paymentMethod, timestamp }` | Billing (create invoice), Notification (order confirmation), Inventory (reserve), Cart (convert to order) |
| `OrderStatusChanged` | Order status transitions | `{ orderId, orderNumber, oldStatus, newStatus, changedBy, note, timestamp }` | Notification (status update), Shipping (if shipped) |
| `PaymentCompleted` | Payment successfully processed | `{ orderId, orderNumber, amount, currency, paymentMethod, paymentId, timestamp }` | CommerceOrder (update payment_status), Notification (payment receipt) |
| `PaymentFailed` | Payment attempt failed | `{ orderId, orderNumber, reason, timestamp }` | Notification (payment failure alert) |
| `InventoryReserved` | Inventory reserved on order placed | `{ inventoryId, productId, sku, quantityReserved, remainingAvailable, timestamp }` | Notification (if low stock reached) |
| `InventoryReleased` | Reservation released (cancellation) | `{ inventoryId, productId, sku, quantityReleased, timestamp }` | — |
| `InventoryDepleted` | Available quantity reaches 0 | `{ inventoryId, productId, sku, timestamp }` | Notification (admin alert, reorder), Product (auto-deactivate) |
| `InventoryLowStock` | Available <= threshold | `{ inventoryId, productId, sku, availableQuantity, threshold, timestamp }` | Notification (admin restock reminder) |
| `ShipmentCreated` | Order shipped with tracking | `{ orderId, orderNumber, trackingNumber, carrier, estimatedDelivery, items[], shippingAddress, timestamp }` | Notification (shipping confirmation to customer), CommerceOrder (update tracking) |
| `ShipmentDelivered` | Tracking confirms delivery | `{ orderId, orderNumber, deliveredAt, timestamp }` | Notification (delivery confirmation), CommerceOrder (auto-transition to delivered) |
| `OrderRefunded` | Order refund processed | `{ orderId, orderNumber, refundAmount, reason, refundedBy, timestamp }` | Billing (refund invoice), Notification (refund confirmation), Inventory (release) |
| `ReviewSubmitted` | Customer submits product review | `{ reviewId, productId, customerId, rating, timestamp }` | Notification (review moderation alert) |

---

## 4. Use Cases

### UC-COM-01: Browse Product Catalog
**Actor:** Visitor / Customer
**Preconditions:** None
**Flow:**
1. Actor requests product listing
2. System accepts optional filters: category_id, search (name_ar, name_en, description_ar, description_en), min_price, max_price, is_active, is_featured, tags[]
3. System accepts pagination: page (default 1), limit (default 20, max 100)
4. System accepts sort: price_asc, price_desc, name_asc, name_desc, newest, oldest
5. System queries products where deleted_at IS NULL AND is_active = true
6. System applies category filter (including children if requested)
7. System applies full-text search across name_ar, name_en, description_ar, description_en
8. System joins inventory for stock availability display
9. Response: 200 { data: Product[], meta: { total, page, limit, totalPages } }

**Exceptions:**
- Invalid filter values → 422
- Category not found → 404

### UC-COM-02: View Product Detail
**Actor:** Visitor / Customer
**Preconditions:** Product exists, not soft-deleted
**Flow:**
1. Actor requests product by ID or slug
2. System finds product where deleted_at IS NULL
3. System includes related: category, inventory (available quantity), active_reviews (avg rating, count), price_history (last 30 days)
4. Response: 200 { data: ProductDetail }

**Exceptions:**
- Product not found → 404
- Product deleted → 404

### UC-COM-03: Add Item to Cart
**Actor:** Customer (authenticated) or Visitor (anonymous)
**Preconditions:** Product exists, is_active, and has available inventory (> 0)
**Flow:**
1. Actor submits product_id and quantity (>= 1)
2. System validates product is active and not deleted
3. System checks inventory: requested quantity <= quantity_available - quantity_reserved
4. System finds or creates cart (by customer_id for authenticated, by session_id for anonymous)
5. If cart exists, check if product already in cart → increment quantity (capped at available)
6. If product not in cart → create CartItem with unit_price snapshot of current product.price
7. System sets cart.updated_at = now
8. System publishes `ItemAddedToCart` event
9. Response: 201 { data: Cart }

**Exceptions:**
- Product not found/inactive → 404
- Quantity exceeds available → 422 { error: INSUFFICIENT_STOCK, available: N }
- Cart limit exceeded (max 50 unique items) → 422

### UC-COM-04: Update Cart Item Quantity
**Actor:** Customer / Visitor
**Preconditions:** Cart exists, item exists in cart
**Flow:**
1. Actor submits cart_item_id and new quantity
2. System validates cart_item belongs to actor's cart
3. If quantity == 0 → remove item (same as UC-COM-05)
4. If quantity > 0 → validate against current inventory
5. System updates CartItem.quantity and CartItem.updated_at
6. System touches cart.updated_at
7. Response: 200 { data: Cart }

**Exceptions:**
- Cart not found → 404
- CartItem not found → 404
- Quantity exceeds available → 422

### UC-COM-05: Remove Item from Cart
**Actor:** Customer / Visitor
**Preconditions:** Cart exists, item exists in cart
**Flow:**
1. Actor submits cart_item_id
2. System validates cart_item belongs to actor's cart
3. System deletes CartItem
4. System publishes `ItemRemovedFromCart` event
5. Response: 200 { data: Cart }

### UC-COM-06: Checkout — Create Order
**Actor:** Customer (must be authenticated)
**Preconditions:** Cart exists, cart has items, customer profile has required fields
**Flow:**
1. Customer initiates checkout
2. System returns cart summary with items, sub_total, available coupons (Phase 2)
3. Customer submits shipping_address (full_name, phone, address_line1, address_line2, city, state, postal_code, country)
4. System validates shipping address completeness
5. System calculates shipping options and cost based on items weight + destination
6. Customer selects shipping_method
7. Customer selects payment_method
8. System creates CommerceOrder:
   - status: pending
   - items: snapshot of cart items (product_id, name_ar, name_en, sku, quantity, unit_price, total)
   - sub_total, shipping_amount, tax_amount, discount_amount, total
   - shipping_address, payment_method
   - currency: SAR
9. System collects inventory reservation for each item
10. System publishes `OrderPlaced` event
11. System deletes cart (or sets status = converted)
12. Response: 201 { data: CommerceOrder }

**Exceptions:**
- Cart empty → 422
- Shipping address incomplete → 422
- Product became unavailable during checkout → 422 with details of unavailable items
- Customer not authenticated → 401
- Price changed since cart creation → 422 { error: PRICE_CHANGED, updatedItems: [...] }

### UC-COM-07: Track Order
**Actor:** Customer (own orders) / Employee (assigned orders) / Admin (all orders)
**Preconditions:** Order exists
**Flow:**
1. Actor requests order by ID or order_number
2. System enforces RBAC: Customer sees own orders only
3. System returns order with status history, items, shipping info, tracking
4. Response: 200 { data: OrderDetail }

### UC-COM-08: Manage Products (Admin CRUD)
**Actor:** Admin, Manager
**Preconditions:** Authenticated with write permission on products
**Flow (Create):**
1. Admin submits product data (name_ar, name_en, description_ar, description_en, price, sku, category_id, images, etc.)
2. System validates inputs (Zod schema)
3. System checks SKU uniqueness
4. System generates slug from name_en
5. System creates Product with created_by = current user
6. System creates Inventory record (quantity_available = 0 for physical products)
7. System publishes `ProductCreated` event
8. Response: 201 { data: Product }

**Flow (Update):**
1. Admin submits partial update for product
2. System validates product exists and not deleted
3. If price changed → create PriceHistory record, publish `ProductPriceChanged`
4. System updates product, sets updated_by
5. System publishes `ProductUpdated` event
6. Response: 200 { data: Product }

**Flow (Delete):**
1. Admin requests soft-delete of product
2. System checks no active orders reference this product
3. System sets deleted_at = now
4. System releases all reserved inventory for this product
5. System publishes `ProductDeleted` event
6. Response: 200

**Exceptions:**
- SKU already exists → 409
- Product has active orders → 422 { error: PRODUCT_HAS_ACTIVE_ORDERS }
- Validation failure → 422

### UC-COM-09: Manage Inventory (Admin)
**Actor:** Admin, Manager
**Preconditions:** Authenticated with write permission on inventory
**Flow:**
1. Admin views inventory list (filterable by low stock, out of stock, product search)
2. Admin updates quantity_available for a product (e.g., restock)
3. System validates new quantity >= quantity_reserved
4. System updates quantity_available, last_restock_date, last_restock_quantity
5. If new quantity <= low_stock_threshold → publish `InventoryLowStock`
6. If new quantity == 0 → publish `InventoryDepleted`
7. Response: 200 { data: Inventory }

**Exceptions:**
- Product not found → 404
- product_id not in inventory → create inventory record

### UC-COM-10: Manage Category Tree (Admin)
**Actor:** Admin, Manager
**Preconditions:** Authenticated with write permission on categories
**Flow (Create):**
1. Admin submits category data with optional parent_id
2. System validates: if parent_id set → parent exists, depth < 4, no cycle
3. System computes depth = parent.depth + 1, path = [...parent.path, parent.id]
4. System generates slug
5. System creates Category
6. Response: 201

**Flow (Update/Move):**
1. Admin changes parent_id of a category
2. System validates no cycles and max depth constraint
3. System updates depth and path for the category and ALL descendants recursively
4. Response: 200

**Flow (Delete):**
1. Admin requests soft-delete
2. System checks for children: if children exist → must reassign or cascade delete
3. System sets deleted_at
4. Response: 200

### UC-COM-11: Apply Coupon (Phase 2)
**Actor:** Customer
**Preconditions:** Coupon exists, valid, and applicable
**Flow:**
1. Customer enters coupon code during checkout
2. System finds coupon by code
3. System validates: not expired, usage limit not reached, min_order_amount met, applicable to cart items
4. System calculates discount (percentage or fixed amount)
5. System updates cart/order discount_amount
6. Response: 200 { discount_amount, coupon_code }

**Exceptions:**
- Coupon not found → 404
- Coupon expired → 422 { error: COUPON_EXPIRED }
- Min order not met → 422 { error: MIN_ORDER_NOT_MET, required: N }
- Usage limit reached → 422 { error: COUPON_EXHAUSTED }

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| GET | /api/v1/products | Public | — | List products (search, filter, paginate, sort) |
| GET | /api/v1/products/{id} | Public | — | Get product by ID |
| GET | /api/v1/products/slug/{slug} | Public | — | Get product by slug |
| POST | /api/v1/products | Required | Admin, Manager | Create product |
| PATCH | /api/v1/products/{id} | Required | Admin, Manager | Update product |
| DELETE | /api/v1/products/{id} | Required | Admin | Soft-delete product |
| GET | /api/v1/categories | Public | — | List categories (tree or flat) |
| GET | /api/v1/categories/{id} | Public | — | Get category by ID |
| POST | /api/v1/categories | Required | Admin, Manager | Create category |
| PATCH | /api/v1/categories/{id} | Required | Admin, Manager | Update category |
| DELETE | /api/v1/categories/{id} | Required | Admin | Soft-delete category |
| GET | /api/v1/cart | Optional | — | Get current cart (by customer_id or session_id) |
| POST | /api/v1/cart/items | Optional | — | Add item to cart |
| PATCH | /api/v1/cart/items/{cartItemId} | Optional | — | Update cart item quantity |
| DELETE | /api/v1/cart/items/{cartItemId} | Optional | — | Remove item from cart |
| POST | /api/v1/commerce/orders | Required | Customer | Create order (checkout) |
| GET | /api/v1/commerce/orders | Required | Customer, Employee, Admin | List orders (own for customer, all for admin) |
| GET | /api/v1/commerce/orders/{id} | Required | Customer, Employee, Admin | Get order by ID |
| PATCH | /api/v1/commerce/orders/{id}/status | Required | Admin, Manager | Update order status |
| POST | /api/v1/commerce/orders/{id}/cancel | Required | Customer, Admin | Cancel order (customer: before shipped; admin: any time) |
| GET | /api/v1/commerce/orders/{id}/status-history | Required | Customer, Employee, Admin | Get order status history |
| GET | /api/v1/inventory | Required | Admin, Manager, Employee | List inventory (filterable) |
| GET | /api/v1/inventory/{productId} | Required | Admin, Manager, Employee | Get inventory by product |
| PATCH | /api/v1/inventory/{productId} | Required | Admin, Manager | Update inventory quantity |
| GET | /api/v1/products/{id}/reviews | Public | — | List product reviews |
| POST | /api/v1/products/{id}/reviews | Required | Customer | Submit product review |
| PATCH | /api/v1/products/{id}/reviews/{reviewId} | Required | Admin, Manager | Moderate review |
| GET | /api/v1/coupons | Required | Admin, Manager | List coupons |
| POST | /api/v1/coupons | Required | Admin, Manager | Create coupon |
| PATCH | /api/v1/coupons/{id} | Required | Admin, Manager | Update coupon |
| DELETE | /api/v1/coupons/{id} | Required | Admin | Delete coupon |
| POST | /api/v1/coupons/validate | Optional | — | Validate coupon code (during checkout) |

### Request/Response Schemas

**GET /api/v1/products — Query Parameters:**
```
?search=string (full-text across name_ar, name_en, description)
&category_id=uuid (exact match or include children with include_children=true)
&min_price=decimal
&max_price=decimal
&is_active=boolean
&is_featured=boolean
&tags[]=string
&sort=price_asc|price_desc|name_asc|name_desc|newest|oldest
&page=1
&limit=20
&locale=ar|en
```

**GET /api/v1/products — Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name_ar": "string",
      "name_en": "string",
      "slug": "string",
      "price": "decimal",
      "compare_at_price": "decimal | null",
      "sku": "string",
      "thumbnail": "string",
      "images": [{"url": "string", "alt_ar": "string", "alt_en": "string"}],
      "category": {"id": "uuid", "name_ar": "string", "name_en": "string"},
      "inventory": {"quantity_available": "number", "is_low_stock": "boolean"},
      "reviews_avg": "number",
      "reviews_count": "number",
      "is_featured": "boolean",
      "created_at": "ISO8601"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**POST /api/v1/commerce/orders — Request:**
```json
{
  "shipping_address": {
    "full_name": "string",
    "phone": "string (E.164)",
    "address_line1": "string",
    "address_line2": "string | null",
    "city": "string",
    "state": "string",
    "postal_code": "string",
    "country": "SA"
  },
  "billing_address": {
    "full_name": "string",
    "phone": "string",
    "address_line1": "string",
    "city": "string",
    "country": "SA"
  },
  "shipping_method": "standard | express | pickup",
  "payment_method": "card | bank_transfer | cod",
  "coupon_code": "string | null",
  "notes": "string | null"
}
```

**POST /api/v1/commerce/orders — Response:**
```json
{
  "data": {
    "id": "uuid",
    "order_number": "ORD-2026-000042",
    "status": "pending",
    "items": [
      {
        "product_id": "uuid",
        "name_ar": "string",
        "name_en": "string",
        "sku": "string",
        "quantity": 2,
        "unit_price": "99.00",
        "total": "198.00"
      }
    ],
    "sub_total": "198.00",
    "discount_amount": "0.00",
    "shipping_amount": "25.00",
    "tax_amount": "30.00",
    "total": "253.00",
    "currency": "SAR",
    "shipping_address": {},
    "payment_status": "pending",
    "payment_method": "card",
    "shipping_method": "standard",
    "placed_at": "ISO8601",
    "estimated_delivery": "YYYY-MM-DD",
    "created_at": "ISO8601"
  },
  "meta": {
    "timestamp": "ISO8601"
  }
}
```

**Error Response Envelope:**
```json
{
  "error": {
    "code": "COMMERCE_INSUFFICIENT_STOCK",
    "message": "المخزون غير كافٍ للمنتج المطلوب",
    "message_en": "Insufficient stock for requested product",
    "statusCode": 422,
    "details": {
      "product_id": "uuid",
      "product_name": "string",
      "requested": 5,
      "available": 3
    }
  },
  "meta": {
    "timestamp": "ISO8601",
    "requestId": "uuid"
  }
}
```

---

## 6. Business Rules

### Product Rules
1. **RB-COM-001:** SKU must be unique across all products (including soft-deleted)
2. **RB-COM-002:** Product cannot be hard-deleted if referenced by any order; use soft delete (deleted_at)
3. **RB-COM-003:** Every price change creates a PriceHistory record with old_price, new_price, changed_by
4. **RB-COM-004:** compare_at_price, if set, must be greater than price
5. **RB-COM-005:** Product slug is auto-generated from name_en and must be unique
6. **RB-COM-006:** Digital products (is_digital=true) skip inventory tracking and shipping

### Cart Rules
7. **RB-COM-007:** Anonymous carts expire after 7 days of inactivity; customer carts after 30 days
8. **RB-COM-008:** Cart item unit_price is a snapshot of product.price at the time of addition — it does not auto-update with price changes
9. **RB-COM-009:** Maximum 50 unique items per cart
10. **RB-COM-010:** A customer may have at most 1 active cart at any time

### Order Rules
11. **RB-COM-011:** Order number format: ORD-{YYYY}-{6-digit zero-padded sequence}, resetting annually
12. **RB-COM-012:** Order status state machine:
    ```
    pending → confirmed (on successful payment authorization)
    confirmed → processing (order fulfillment begins)
    processing → shipped (tracking number assigned)
    shipped → delivered (tracking confirms delivery)
    pending → cancelled (payment failure or customer/agent cancellation)
    confirmed → cancelled (only by admin, with reason)
    shipped → delivered (auto on tracking confirmation)
    cancelled ↛ any other status (terminal)
    delivered → refunded (customer return/refund request)
    ```
13. **RB-COM-013:** Order items are a JSONB snapshot — they do NOT reference live product prices after placement
14. **RB-COM-014:** An order cannot be cancelled once status reaches `shipped` (must use refund process instead)
15. **RB-COM-015:** Customer may cancel only if status is `pending`; Admin may cancel at any status with reason
16. **RB-COM-016:** Cancelled/rejected orders auto-release reserved inventory

### Inventory Rules
17. **RB-COM-017:** Inventory is reserved when order transitions to `confirmed`; reservation is advisory during `pending`
18. **RB-COM-018:** Reserved inventory is released on order cancellation
19. **RB-COM-019:** When quantity_available reaches 0 → publish `InventoryDepleted`, optionally auto-deactivate product
20. **RB-COM-020:** When available quantity (available - reserved) <= low_stock_threshold → publish `InventoryLowStock`
21. **RB-COM-021:** Stock adjustments (restock, manual correction) must be audited with changed_by and reason

### Category Rules
22. **RB-COM-022:** Maximum category nesting depth: 4 levels (root=0, child=1, grandchild=2, great-grandchild=3)
23. **RB-COM-023:** A category cannot be moved under itself or any of its descendants (cycle prevention)
24. **RB-COM-024:** Deleting a category with children requires explicit reassignment or cascade flag

### Coupon/Discount Rules (Phase 2)
25. **RB-COM-025:** Coupon applicability: can be restricted by category, product, minimum order amount, or customer group
26. **RB-COM-026:** Coupon usage limits: global max uses and per-customer max uses
27. **RB-COM-027:** Only one coupon code per order

---

## 7. Security

### Access Control
- All write endpoints require JWT authentication with appropriate role
- Customer-scoped queries (cart, orders) are filtered by customer_id extracted from JWT
- Admin and Manager roles bypass ownership filtering for read operations
- Employee role can view orders but cannot modify

### Input Validation
- All inputs validated via Zod schemas before reaching service layer
- price, compare_at_price, cost_price sanitized to 2 decimal places
- SKU format validated: alphanumeric + hyphens, 4-50 chars
- Slug validated: lowercase alphanumeric + hyphens, 1-300 chars
- Images validated: URL format, max 10 images per product, max 5MB each (via S3 presigned URL)
- Quantity values: positive integers, max 9999 per item

### Rate Limiting
- Product listing: 60 requests/minute (public)
- Cart operations: 30 requests/minute per session/customer
- Order creation: 10 requests/minute per customer
- Admin product CRUD: 120 requests/minute

### Data Protection
- cost_price field only visible to Admin and Manager roles
- internal_notes on orders only visible to Admin, Manager, Employee
- customer PII in shipping_address encrypted at rest (pgcrypto or application-level)
- Deleted products retain data in database; tombstone records prevent FK violation

### Order Integrity
- Order total is computed server-side, never accepted from client
- Price validation at checkout: if any cart item price differs from current product.price by > 5%, alert customer
- Inventory double-booking prevented via database row-level lock (SELECT ... FOR UPDATE) during reservation

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. Visitor browses products with category filter → paginated results with stock info
2. Visitor views product detail → full product data with reviews and related products
3. Customer adds product to cart → cart created, item added with price snapshot
4. Customer completes checkout → order created, inventory reserved, cart converted
5. Admin creates product with images → product and inventory record created, search indexed
6. Admin updates product price → PriceHistory recorded, event published
7. Order status progresses through state machine → status history recorded, notifications sent
8. Shipment tracking number added → customer receives tracking notification

**Edge Cases:**
9. Anonymous cart merged with customer cart after login → items consolidated, duplicates summed
10. Product price changes while in cart → cart shows snapshot price, checkout warns if > 5% difference
11. Last item in stock added to cart → concurrent second request sees 0 available → 422
12. Order with multiple items, one goes out of stock during checkout → order rejected with details
13. Category moved to new parent → all descendants' depth and path recalculated
14. Product with active orders soft-deleted → product hidden from catalog, existing orders still display product name
15. Inventory restock triggers exit from low_stock state → no duplicate notifications

**Error Cases:**
16. Add to cart with quantity > available → 422 with available count
17. Checkout with empty cart → 422
18. Create product with duplicate SKU → 409
19. Update inventory to negative → 422
20. Customer cancels order already shipped → 422 (must use refund)
21. Delete category with children without cascade flag → 422
22. Apply expired coupon → 422 with EXPIRED code
23. Unauthenticated user creates order → 401
24. Customer accesses another customer's order → 403 (or 404 for security)

**Security Cases:**
25. Customer modifies order total in request → server ignores and recalculates
26. Customer attempts to add deleted product to cart → 404
27. Employee attempts to create/modify product → 403
28. SQL injection in search/filter parameters → sanitized by Drizzle ORM parameterized queries
29. Price manipulation: client sends negative price in PATCH → 422 validation error
30. Mass assignment: client sends is_featured=true as Customer → field filtered by role-based DTO
31. Inventory race condition: 2 simultaneous orders for last item → one succeeds, one gets 422 via DB row lock
32. Session hijacking: cart accessed with different session_id → 403
