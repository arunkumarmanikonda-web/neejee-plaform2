# NEEJEE — Quick Start (5 Minutes to Local)

## What you'll have running:
- The full neejee.com storefront on `http://localhost:3000`
- Admin panel on `http://localhost:3000/admin`
- 12 sample products, 6 artisans, 3 craft stories
- Working cart, checkout (sandbox), AI surfaces

## Step 1 — Install Node 18+

```bash
node -v   # Should be 18.17.0 or higher
```
If not, install via [nvm](https://github.com/nvm-sh/nvm).

## Step 2 — Install dependencies

```bash
cd neejee-platform
npm install
```
(Takes 1-2 minutes.)

## Step 3 — Create local env

```bash
cp .env.example .env.local
```
For instant testing, the only line you need to set is:
```
AUTH_SECRET="any-random-string-here-at-least-32-chars-please"
```
**The app runs without a database** — it falls back to in-memory mock data.

## Step 4 — Run

```bash
npm run dev
```
Open http://localhost:3000

## Step 5 — Login as admin

Visit http://localhost:3000/login

In dev mode, these are pre-wired:
- **Admin**: `admin@neejee.com` / `admin123` → access `/admin`
- **Customer**: `demo@neejee.com` / `neejee123` → access `/account`

## What works out of the box (no setup):

✅ Browse all 12 products with images
✅ Product details with craft stories
✅ Add to cart, full checkout flow (mock payment)
✅ Order confirmation
✅ AI Mirror UI flow (returns product photo as stub)
✅ AI Gift Concierge wizard
✅ Account dashboard
✅ Admin: dashboard, products, orders, customers, sellers, CMS, AI, settings
✅ Newsletter signup, search, journal
✅ Mobile-responsive

## What needs your credentials to fully work:

🔑 **Razorpay** → real payments (currently mock)
🔑 **Shiprocket** → real shipping pickup
🔑 **Cloudinary** → upload your own product photos
🔑 **Postgres** → persist orders & users across restarts
🔑 **Replicate** → real AI Mirror generation
🔑 **Klaviyo + WATI** → real email + WhatsApp automation

All of these are documented in `.env.example` with direct links to sign-up pages.

## Deploy to Vercel (when you're ready)

```bash
npm i -g vercel
vercel
```
Then point your `neejee.com` DNS to Vercel — done.

---

**Questions?** Read the full `README.md` for architecture, brand tokens, and production hardening.
