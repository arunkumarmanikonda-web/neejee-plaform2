# NEEJEE v10 — Sprint 1: Admin Foundations

This release adds:
- ✅ Image uploads (Supabase Storage) with drag-drop, multi-image, reorder
- ✅ Prices in rupees in UI (₹), paise in DB
- ✅ Sale window — sale price + start/end dates with live status
- ✅ Variants editor with inventory per variant
- ✅ Coupons admin (PERCENT / FLAT / FREE_SHIPPING) with validity dates and usage limits
- ✅ Inventory dashboard with low/out filters
- ✅ Team & Roles management (5 roles: Super Admin / Admin / Content Editor / QC / Seller)
- ✅ My Profile page (rename "Nidhi Chauhan" → "Admin")
- ✅ SEO fields per product
- ✅ Story / Craft / Care tabs in product editor

---

## ⚙ Setup Required Before First Use

### 1. Run the DB migration

Open Supabase Dashboard → SQL Editor → New Query → paste and run:

```sql
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleStartsAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleEndsAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Product_saleEndsAt_idx" ON "Product" ("saleEndsAt");
```

### 2. Set up Supabase Storage

a) In Supabase Dashboard → Storage → **New bucket**
   - Name: `neejee-media`
   - **Public bucket: ON**
   - Click Create

b) In Supabase Dashboard → Settings → API → copy the **service_role key**

c) Add to Vercel → Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xjqehwvxscoktfecbwse.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (the service_role key from step b)
   - `SUPABASE_STORAGE_BUCKET` = `neejee-media`

   Mark each as Production + Preview. Save.

### 3. Deploy

```cmd
cd C:\Users\arunk\OneDrive\Desktop\neejee-v6
vercel --prod
```

### 4. Rename "Nidhi Chauhan" admin

After deploy, sign in as admin and go to `/admin/profile`. Change Display Name to `Admin` (or whatever you prefer). Save. Sign out and back in to refresh the session.

---

## 🆕 New Pages

| URL | What |
|---|---|
| `/admin/coupons` | Coupon CRUD with create modal |
| `/admin/inventory` | Variant-level stock view + filters |
| `/admin/team` | Add/remove team members with roles |
| `/admin/profile` | Your own profile + password |
| `/admin/products/[id]` | Product editor with 6 tabs (Basic, Images, Pricing, Inventory, Story, SEO) |

## 🆕 New APIs

| Endpoint | Method |
|---|---|
| `/api/admin/upload` | POST multipart — images to Supabase Storage |
| `/api/admin/coupons` | GET, POST |
| `/api/admin/coupons/[id]` | PATCH, DELETE |
| `/api/admin/inventory` | GET (with `?filter=low|out`) |
| `/api/admin/team` | GET, POST |
| `/api/admin/team/[id]` | PATCH, DELETE |
| `/api/admin/profile` | PATCH (self-update) |
| `/api/admin/products/[id]/variants` | POST |
| `/api/admin/products/[id]/variants/[vid]` | PATCH, DELETE |

---

## What's Next (Sprint 2 — Customer-Facing)
- Homepage rebuild with 22 sections per Phase 2 spec
- PLP with proper filters (Craft / Region / Material / Color / Price / Occasion)
- PDP rebuild — editorial gallery, craft story, complete-the-look
- Cart "Trunk" with Sandook coding, free shipping meter, gift wrap
- 3-step checkout with GST option
- Mobile responsive across all pages
