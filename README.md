# NEEJEE Platform · Premium Indian Craft Commerce

> **Found. Personal.** — A full-stack Next.js platform for ecommerce + marketplace + AI commerce.
> Powered by Next.js 14 · TypeScript · Tailwind · Prisma · PostgreSQL · Razorpay · Shiprocket.

---

## ✦ What's inside

This is a **production-grade codebase** covering the storefront, admin/CMS, marketplace, and AI surfaces for NEEJEE.

### Frontend (Storefront)
- Homepage with editorial hero, founder message, category grid, founder's edit, AI intro
- PLP (`/categories/[slug]`) — filters, sort, grid
- PDP (`/products/[slug]`) — gallery, craft story, artisan profile, add to cart, AI Mirror link
- Cart, Checkout, Order Confirmation
- AI Mirror (try-on), AI Space (room preview), AI Gift Concierge
- Account dashboard (orders, wishlist, addresses, AI previews, profile)
- Journal (craft stories), About, Sellers application, Help (FAQ, shipping, returns, contact)
- Auth (Sign in / Sign up) — JWT-based with OTP-ready scaffold
- Newsletter, search, announcement bar
- SEO (sitemap, robots, OG tags), responsive, accessibility baseline

### Admin (CMS)
- Dashboard (KPIs, revenue chart, top sellers, low stock, recent orders)
- Products (list, add, edit) · Orders (list, detail, status updates)
- Customers · Sellers/Artisans · CMS pages & banners
- AI Manager (Mirror/Space/Gift Concierge controls, consent audit log)
- Settings (Razorpay, Shiprocket, Klaviyo, WATI integrations)
- Role-based access (SUPER_ADMIN, ADMIN, CONTENT_EDITOR, QC_TEAM, SELLER)

### Backend (APIs)
- `/api/products`, `/api/search`, `/api/cart`, `/api/checkout`
- `/api/auth/{login,signup,logout}`, `/api/me`
- `/api/ai/mirror` (Replicate stub), `/api/newsletter`
- `/api/razorpay/verify` (signature verification webhook)
- `/api/admin/{products,orders}` (RBAC-protected via middleware)

### Database (Prisma + PostgreSQL)
- 16 models: User, Address, Category, Product, Variant, Seller, Cart, CartItem, Order, OrderItem, Wishlist, Review, AiPreview, CmsPage, Banner, Coupon
- Pricing stored in **paise** (₹1 = 100 paise) — avoids float errors
- Full enums (Role, KycStatus, ProductStatus, OrderStatus, PaymentStatus, AiType, PageStatus, ReviewStatus)

---

## ⚡ Quick start (local dev)

```bash
# 1. Install
cd neejee-platform
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — DATABASE_URL is required for Prisma.
# For instant testing, set AUTH_SECRET to any random string and skip DB —
# the app uses in-memory mock data when DB is not connected.

# 3. (Optional) Set up the database
npm run db:push      # Push schema to Postgres
npm run seed         # Seed with sample data + demo users

# 4. Run
npm run dev
# → open http://localhost:3000
```

### Demo accounts (after seeding)
- **Customer**: `demo@neejee.com` / `neejee123`
- **Admin**: `admin@neejee.com` / `admin123` → `/admin`

---

## 📦 Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, RSC) |
| Language | TypeScript |
| Styling | Tailwind CSS (NEEJEE brand tokens) |
| State | Zustand (cart, persisted to localStorage) |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (jose) + bcryptjs · NextAuth-ready |
| Payments | Razorpay (UPI/Card/NB/COD) |
| Shipping | Shiprocket API (stub provided) |
| Media | Cloudinary (or S3) |
| Search | In-memory (swap for Algolia/Typesense) |
| AI | Replicate (Mirror/Space) + OpenAI (Concierge) |
| Email | Klaviyo |
| WhatsApp | WATI |
| Validation | Zod |
| Icons | Lucide React |
| Deployment | Vercel (one-click) |

---

## 🚀 Deploy to production

### Step 1 — Create a Postgres database
- **Supabase** (free tier works) → copy connection string
- Or Neon, Railway, Render, AWS RDS

### Step 2 — Deploy to Vercel
```bash
vercel
```
or via GitHub: connect your repo, set env vars, deploy.

### Step 3 — Set env vars in Vercel
Required minimums:
- `DATABASE_URL` (Postgres)
- `AUTH_SECRET` (long random string)
- `NEXT_PUBLIC_BASE_URL` (your custom domain)

Optional but recommended:
- `RAZORPAY_*` (payments)
- `SHIPROCKET_*` (logistics)
- `CLOUDINARY_*` (image hosting)
- `KLAVIYO_API_KEY`, `WATI_API_TOKEN`, `REPLICATE_API_TOKEN`

### Step 4 — Run migrations on production
```bash
npx prisma db push
npm run seed
```

### Step 5 — Custom domain
Point `neejee.com` DNS to Vercel (A/CNAME records provided in Vercel dashboard).

---

## 🎨 Brand tokens (Tailwind config)

```
colors: {
  kohl:     '#1A1613',  // primary text
  ivory:    '#F4EFE6',  // background
  madder:   '#8B2E2A',  // accent (CTAs, bindi)
  mitti:    '#6B4423',  // secondary
  banarasi: '#A47E3B',  // gold
  ajrakh:   '#1F3A5F',  // deep indigo
  haldi:    '#D4A02A',  // warning/sale
  neem:     '#5A6F3F',  // success
  beige:    '#E8DFCF',  // surfaces
}
fonts: {
  display: 'Playfair Display' (h1-h4)
  body: 'Cormorant Garamond' (body)
  ui: 'Inter' (labels, buttons, navigation)
}
```

The **bindi** (Madder Red dot between the two E's) is the brand atom — implemented as `.bindi` CSS class.

---

## 🔐 Production hardening checklist

Before going live:
- [ ] Generate a strong `AUTH_SECRET` (`openssl rand -base64 32`)
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set up Razorpay live keys + webhook
- [ ] Configure Shiprocket pickup location
- [ ] Set up Cloudinary upload presets
- [ ] Enable rate limiting on `/api/auth/*` and `/api/checkout`
- [ ] Set up Sentry error tracking
- [ ] Configure GA4 + Meta Pixel
- [ ] Run Lighthouse — target LCP < 2.5s, CLS < 0.1
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Validate DPDP compliance — consent logs, deletion flow
- [ ] Set up daily DB backups
- [ ] Configure CDN cache headers (Vercel does this automatically)

---

## 📊 Realistic launch timeline

| Phase | Duration | What |
|---|---|---|
| **Setup** | 1-2 days | DB + domain + Razorpay test mode + Vercel |
| **Content** | 1-2 weeks | Upload real products (photos, copy, SKUs) |
| **Integration testing** | 1 week | Razorpay sandbox → live · Shiprocket pickup test |
| **Soft launch** | Day 30 | 50 beta customers, NPS feedback |
| **Marketing launch** | Day 45-60 | Instagram/PR/influencer activation |

---

## 🤝 Need help?

This codebase covers the foundation. To go fully live, the recommended next steps are:

1. **Hire a senior dev (or contractor team)** to plug in your real Razorpay/Shiprocket credentials, photograph and load your first 50 SKUs, and stress-test the AI flows.
2. **Generate real AI Mirror outputs** — replace the stub in `/api/ai/mirror` with a live Replicate model call (e.g., IDM-VTON or similar).
3. **Connect Klaviyo + WATI** for email and WhatsApp automation.

See `/admin/settings` for an in-app checklist of integrations.

---

**Built for NEEJEE by the team at Genspark.**
*Found. Personal. — Volume 01 · 2026*
