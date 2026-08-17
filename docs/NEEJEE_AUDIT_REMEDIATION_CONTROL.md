# NEEJEE Audit + Remediation Control

Status: active implementation on `agent/customer-experience-hardening`

Production baseline: `5dd2f19c2cb7107bb75e237b9651afec4d6822e5`

Operating rule: protect production `main`; audit and remediate in controlled tranches; do not redesign working subsystems without evidence; reconcile customer-facing implementation to the approved NEEJEE brand/frontend mocks while preserving current commerce capabilities.

## 1. Combined scope

The program combines the original deep technical audit with the customer-experience and AI-commerce reconciliation scope.

### Architecture and engineering
- system discovery and architecture map
- full first-party source manifest and line-by-line audit coverage
- API/server code and commerce integrity
- authentication, authorization and session flows
- GitHub engineering, CI/CD and deployment discipline
- Vercel project/deployment/environment parity
- reliability, observability, failure handling and regression testing
- dependency/supply-chain, cost and scalability review
- architecture rationalisation: retain, simplify, replace or defer only with evidence

### Supabase and data
- exposed-schema/RLS/policy/grant matrix
- functions, triggers, views and SECURITY DEFINER review
- schema/data-model integrity
- migration drift and reproducibility
- indexes/query performance
- Storage access and lifecycle
- backup/temporary production artefacts
- private/server-only data separation

### Customer-facing product experience
- homepage, navigation and search
- PLP/category discovery, filters and merchandising
- PDP editorial/brand fidelity, trust, stock, variants, wishlist and conversion
- cart / “Your Trunk”
- guest and signed-in checkout
- payment and order confirmation
- mobile/tablet/desktop responsive behaviour
- WCAG 2.2 AA accessibility
- Core Web Vitals and frontend performance
- technical SEO, structured data, content/discoverability
- analytics/funnel instrumentation

### NEEJEE AI commerce
- NEEJEE Mirror: product -> private preview -> style the look -> add selected edit to trunk
- NEEJEE Space: product -> room preview -> complete the setting -> add selected room to trunk
- Gift Concierge
- AI eligibility, privacy, consent, retention and deletion
- AI-provider request security
- prompt/output safety and failure states
- save/share/look/room persistence where appropriate

### Recommendation and merchandising intelligence
- catalogue-backed pairing rules
- basket-aware recommendations
- stock/variant safety
- fashion styling slots: jewellery, accessories, footwear, fragrance and related pieces
- home composition slots: lighting, rugs, tables, artefacts, mirrors, frames, soft furnishings
- human curator override must outrank AI ranking
- future ranking signals: colour/material/craft/region/occasion/room type/style/price/margin/behaviour

### Marketplace/admin/operations
- admin/CMS configurability
- catalogue/taxonomy/variants/inventory/media
- seller/vendor flows
- marketplace readiness
- payments/webhooks/shipping/notifications
- DPDP/privacy operational readiness

## 2. Severity model

- **P0 Critical** — credential exposure, auth bypass, payment integrity, destructive data path, privilege escalation.
- **P1 High** — revenue/launch blocker, inventory/order integrity, major UX failure, recurring deployment failure, severe security weakness.
- **P2 Medium** — material UX, performance, SEO, architecture, maintainability or privacy weakness.
- **P3 Low** — minor polish/refactor.
- **Enhancement** — net-new capability or optimisation.

Every material finding should ultimately carry evidence, affected file/route/system, reproduction, impact, root cause, proposed remediation, regression risk and verification criteria.

## 3. Implemented in this branch

### Security and privacy
- hardened AI Mirror provider URL handling; client-supplied provider URLs cannot receive FAL credentials unless they pass approved HTTPS host validation
- removed provider debug payload leakage to customers
- AI preview deletion endpoint is ownership-bound
- Mirror and Space expose customer-controlled delete actions
- scheduled AI preview retention cleanup deletes eligible NEEJEE-hosted Storage objects before deleting expired records
- Supabase `rls_auto_enable()` direct web-role execution revoked while preserving the event trigger
- `update_customer_updated_at()` search path pinned and unnecessary web-role execution revoked
- payment snapshot endpoint no longer returns customer PII
- cart recovery/opt-out references converted to HMAC-signed bearer links across email/SMS/WhatsApp

### PDP and brand reconciliation
- restored the proven NEEJEE-branded functional PDP baseline instead of keeping the generic stone/SaaS-style regression
- Add to Trunk / Buy Now restored
- wishlist restored
- NEEJEE Mirror and NEEJEE Space entry points restored
- badge adapter supports current canonical badge objects and legacy keys
- trust/return copy follows SKU data rather than universal promises

### AI commerce loop
- Mirror preview now continues into catalogue-backed completion recommendations
- Space preview now continues into room-completion recommendations
- safe quick-add only when exactly one in-stock variant exists
- products requiring colour/size choice are never silently selected
- selected edit/room uses the existing cart, not a parallel checkout system

### Recommendations/cart
- recommendation API supports one seed product or full basket
- excludes already-selected products
- filters for stocked variants
- adds fashion and home pairing families
- cart Complete-the-Look uses full basket context rather than only first item
- raw internal recommendation errors no longer surface to customers

### Guest checkout
- cart offers Continue as Guest and optional sign-in
- checkout no longer forces authentication
- signed-in customers retain loyalty/account benefits
- guest OTP verifies phone ownership without creating an account
- OTP is requested progressively only when server policy requires it

### Payment/inventory integrity
- Razorpay signature verification fails closed if secret is unavailable
- timing-safe signature comparison
- valid signature is bound to the exact stored Razorpay order before order confirmation
- invalid signatures do not mutate payment/order state
- private-schema inventory reservation ledger created
- prepaid checkout reserves basket stock atomically for a bounded hold window
- Razorpay order creation revalidates/refreshes the hold before money is requested
- paid-order creation and reservation consumption occur in one database transaction
- COD validates payment/quantity/eligibility server-side and atomically consumes only unreserved stock
- payment UI prevents a second PAY NOW after gateway success and retries only order finalisation
- late paid payment with unavailable inventory triggers idempotent full-refund workflow; unresolved refund/finalisation exceptions are escalated without asking the customer to pay again

### Migration discipline
- production Supabase hardening/inventory migrations mirrored under `supabase/migrations/`

## 4. Current verification state

- branch changes compile through Next.js build into page-data collection on Vercel
- interactive branch preview is currently blocked by preview-environment `AUTH_SECRET` being missing/short; application security validation is intentionally not weakened
- production `main` remains unchanged
- database hardening/private reservation migrations are already applied and verified on Supabase

## 5. Active / next audit-remediation queue

1. resolve Vercel preview environment parity so full browser regression can run
2. full route/UI reconciliation against approved Phase 1/2 mocks: homepage, header/mega-menu, PLP, PDP, cart, checkout, Mirror, Space, mobile
3. canonical breadcrumb/category adoption everywhere; remove remaining legacy category assumptions
4. checkout recovery regression with signed links across configured provider templates
5. coupon concurrency / max-use / per-user integrity
6. loyalty redemption concurrency and post-payment failure handling
7. release/expiry housekeeping for inventory reservations
8. Supabase RLS-no-policy classification by intended access path; do not add permissive policies blindly
9. Supabase missing-FK-index remediation based on real query/access patterns
10. Storage bucket policy and public/private media classification
11. CSP/security headers and third-party resource review
12. Core Web Vitals/caching/image/font optimisation
13. WCAG 2.2 AA pass
14. technical SEO/schema/meta/canonical/OG review
15. analytics funnel events from discovery -> AI -> add-to-trunk -> checkout -> payment
16. admin/seller/media/inventory regression
17. failure/resilience tests for payment, inventory, AI provider, notification and shipping failures
18. full first-party source audit manifest completion
19. controlled preview regression, draft PR, production-release checklist and post-release verification

## 6. Release gate

No merge to production until:
- branch build is green in a correctly configured preview environment
- customer journeys are tested across desktop/mobile
- no unresolved P0 findings
- P1 findings are fixed or explicitly release-blocked
- Supabase migration history is reproducible
- checkout/payment/inventory regression passes
- Mirror/Space privacy and commerce flows pass
- rollback point remains documented
