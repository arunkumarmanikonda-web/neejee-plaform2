# NEEJEE v11 — Sprint 2: Customer-Facing Rebuild

## What's in this release

### Customer-facing pages (all rebuilt, DB-backed)
- 🏠 **Homepage** (`/`) — Hero · Trust strip · Founder's Edit (from DB) · Founder note quote · 4 Craft regions · New Arrivals (from DB) · AI tile · Journal · Newsletter
- 🛍️ **PLP** (`/categories/[slug]`) — Editorial header · Left rail filters (Craft / Region / Material / Occasion / Price) · Mobile filter drawer · Sort (Newest / Price asc/desc / A-Z) · 3-col grid · Empty state · Loading skeletons
- 📄 **PDP** (`/products/[slug]`) — Breadcrumb · Gallery with 5 thumbs · Sale-aware pricing · Color/Size variant selectors · Quantity stepper · Add to Cart + Buy Now · Wishlist · Trust trio · Mirror entry · 4 accordion tabs (Craft Story / Artisan / Care / Delivery)
- 🛒 **Cart** (`/cart`) — "Your Trunk" with Sandook coding · Free shipping meter with progress bar · Line items with variant labels · Gift wrap toggle (₹150) + personal note · Coupon code field · Order summary · Continue shopping link
- 💳 **Checkout** (`/checkout`) — 3-step indicator (Address / Shipping / Payment) · GST invoice option · Razorpay or COD · Authenticity badge · Sticky order summary
- ✅ **Order confirmation** — pulls `?order=` param, displays order number

### Sale window support throughout
Every price display now respects `salePrice`, `saleStartsAt`, `saleEndsAt`. Cards and PDP show:
- Strikethrough original price
- "ON SALE -XX%" badge
- Discount percentage off MRP
- Window enforcement (price reverts if outside window)

### New public APIs
- `GET /api/products` — supports `category`, `craft`, `region`, `material`, `occasion`, `minPrice`, `maxPrice`, `sort`, `featured`, `q`, `limit`
- `GET /api/products/[slug]` — full product detail with variants, story, SEO
- `GET /api/facets?category=X` — filter counts for PLP left rail
- `POST /api/coupons/validate` — validates coupon against cart subtotal, returns discount paise
- `POST /api/checkout` — creates real Order in DB, decrements variant inventory, increments coupon usage

---

## Setup before deploy

**None required.** No new env vars, no migrations. The existing Supabase DB and storage from v10 cover everything.

---

## Smoke Test Sequence

### Homepage (`/`)
- [ ] Hero loads with image and CTAs
- [ ] Trust strip with 4 icons (Authenticity / Free Shipping / Returns / Fair to Makers)
- [ ] Founder's Edit shows real products from DB (4 cards)
- [ ] Founder note quote section
- [ ] Craft regions (Banarasi / Chanderi / Phulkari / Kalamkari) clickable
- [ ] New Arrivals section shows real products
- [ ] AI tile clickable
- [ ] Journal section (3 cards)
- [ ] Newsletter form
- [ ] Footer

### PLP (`/categories/sarees`)
- [ ] Page title is category name
- [ ] Product count shown
- [ ] **Left rail filters** show Craft / Region / Material / Occasion + price range
- [ ] Clicking a craft filter narrows results, URL updates
- [ ] Clear All button resets
- [ ] Sort dropdown changes order
- [ ] Mobile: Filter button opens drawer
- [ ] Empty state shows "Nothing matches yet"

### PDP (click any product)
- [ ] Breadcrumb (HOME · CATEGORY · PRODUCT)
- [ ] Gallery with 5 thumbnails
- [ ] Sale price + strikethrough + discount % visible if on sale
- [ ] Color swatches if multiple variants by color
- [ ] Size pills if multiple variants by size
- [ ] Out-of-stock variants are disabled
- [ ] Quantity stepper limits to stock
- [ ] Add to Cart confirmation
- [ ] 4 accordion tabs (Craft / Artisan / Care / Delivery)

### Cart
- [ ] Empty state
- [ ] Items show with image + name + variant label + price + qty controls
- [ ] Free shipping meter shows remaining amount
- [ ] Gift wrap toggle adds ₹150
- [ ] Personal note textarea appears when gift wrap on
- [ ] Apply coupon — try `WELCOME10` (if you created it in v10)
- [ ] Order summary updates live

### Checkout
- [ ] Step 1: Address form with email/phone/all address fields
- [ ] GST invoice option appears + GSTIN field if checked
- [ ] Step 2: Shipping (Standard free above ₹2,500, Express ₹250)
- [ ] Step 3: Payment (Razorpay or COD)
- [ ] Authenticity badge shown
- [ ] Place Order creates order in DB, redirects to confirmation
- [ ] Order confirmation shows order number
- [ ] Cart cleared after order

### Admin (verify orders flow through)
- [ ] New order appears in `/admin/orders`
- [ ] Click into order shows real items, address, customer
- [ ] Variant inventory decremented in `/admin/inventory`
- [ ] Coupon used count incremented in `/admin/coupons`
