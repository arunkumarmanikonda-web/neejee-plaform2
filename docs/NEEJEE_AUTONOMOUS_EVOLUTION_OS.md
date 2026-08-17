# NEEJEE Autonomous Evolution OS

## Purpose

NEEJEE should continuously discover opportunities to improve ecommerce performance, search visibility, product data quality, customer experience, accessibility, security, operations and conversion while preserving the integrity of a mature commerce platform.

The governing principle is **autonomous discovery, supervised release**.

The platform may research, diagnose, prioritise, draft and test improvements without waiting for a human prompt. Production-changing actions remain controlled by policy, evidence, Preview validation, Super Admin approval and a retrievable rollback point.

Permanent brand line: **FOUND. PERSONAL.**

## Safety model

### Risk A
Reversible content, SEO metadata, merchandising and editorial improvements.

Examples: title/description refinements, internal-link improvements, structured-content drafts, collection merchandising proposals.

### Risk B
UX, analytics, caching, automation and integration behaviour.

Examples: query caching, funnel instrumentation, accessibility interactions, non-financial workflow automation.

### Risk C
Authentication, payments, inventory, privacy/security, database schema, infrastructure and core platform logic.

Risk C changes must never be silently self-deployed.

## Release lifecycle

1. **Observe**: collect non-sensitive operational health, catalogue coverage and release telemetry.
2. **Research**: use current primary-source guidance and current market/platform practices.
3. **Propose**: create a deduplicated proposal containing evidence, rationale, exact scope, risk class, tests, KPI guardrails and rollback.
4. **Review**: surface the proposal in `/admin/releases`. Only SUPER_ADMIN may approve/reject or request rollback.
5. **Build candidate**: an approved proposal may enter the controlled executor. Code/core changes should be materialised as a versioned branch/PR and Preview deployment rather than modifying production directly.
6. **Validate**: compile/type checks, route/API regression, security/performance checks and proposal-specific tests.
7. **Release approval**: production-facing core/code candidates require an explicit release decision after Preview evidence is attached.
8. **Apply**: promote the exact validated version.
9. **Observe**: compare primary KPI and guardrails after release.
10. **Rollback**: revert to the recorded Git/Vercel/data rollback point when a hard guardrail is breached or Super Admin requests rollback.

## Non-negotiable controls

- `approval_required = true`
- `code_auto_apply = false`
- `core_auto_apply = false`
- Secrets never enter AI prompts.
- Customer PII, payment credentials, database credentials and private media never enter research prompts.
- No autonomous real-money ad spend.
- No autonomous payment, refund or payout actions.
- No mass AI content publishing without quality review and clear user value.
- No blind dependency or framework major upgrades.
- No destructive production load testing.
- Every proposal and review action is audit logged.
- Every code release is retrievable through Git history and the corresponding deployment.

## Research priorities

The autonomous researcher should prefer current primary sources for claims and implementation guidance, including:

- Google Search Central and Merchant Center for ecommerce crawlability, Product/Offer structured data, Merchant listings, sitemaps and search guidance.
- web.dev and browser/platform documentation for Core Web Vitals, accessibility and web performance.
- OWASP/CISA and provider documentation for application security.
- Next.js/Vercel documentation for framework/runtime/caching/deployment behaviour.
- OpenAI official documentation for AI platform capabilities.
- Razorpay, shipping, messaging and other provider documentation for integration behaviour.
- Applicable Indian statutory/regulatory primary sources where legal/compliance behaviour is proposed.

## Proposal quality contract

Every proposal must contain:

- title and business domain
- risk class A/B/C
- concise summary
- evidence with source URLs
- NEEJEE-specific rationale
- proposed scope and implementation intent
- pre-release and post-release tests
- primary KPI
- guardrail metrics
- rollback trigger and rollback action

Generic advice is not a release proposal.

## Initial cadence

The deep best-practice research job runs twice weekly. Dedupe prevents the same proposal from repeatedly filling the queue. Cadence may be increased only after observing proposal quality, API cost and review load.

## Brand protection

The only approved brand identity is the current owner-approved NEEJEE arch/lowercase mark, revision `2026-08-17-arch-lowercase`, accompanied by **FOUND. PERSONAL.** when a full brand signature is appropriate.

Legacy uppercase/red-dot Phase 01 artwork is not an approved source for new production assets and must not be used as a replacement for the current mark.
