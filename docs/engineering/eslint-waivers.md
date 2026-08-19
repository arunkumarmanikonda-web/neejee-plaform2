# ESLint waivers

Last reviewed: 2026-08-19

NEEJEE keeps the default `next/core-web-vitals` lint rules enabled project-wide. The exceptions in `.eslintrc.json` are intentionally narrow and file-scoped.

## Dynamic image previews

`@next/next/no-img-element` is disabled only on admin, seller/vendor and agreement surfaces that render dynamic signed, blob or provider-hosted preview URLs. These sources are not suitable for a fixed Next Image allow-list and are not customer-facing catalogue imagery.

## Legacy hook dependency exceptions

`react-hooks/exhaustive-deps` remains enabled globally. A limited set of mature back-office editors and integration screens is exempt because their effects intentionally perform one-time or filter-triggered bootstrap work through locally declared loader functions. Refactoring those large workflow screens only to satisfy dependency inference can change effect cadence and trigger duplicate reads or writes.

Before adding any new file to this exception list:

1. Prefer `useCallback` plus complete dependencies when the loader is a pure read.
2. Fix stale-state or stale-range behavior when it is deterministic. Several finance, compliance, dispute, inventory and payroll screens were corrected this way during the 2026-08-19 hardening pass.
3. Do not waive customer-facing storefront, catalogue, cart, checkout or new feature code.
4. Do not disable the rule globally.
5. Remove a file from the waiver list when that screen is materially refactored.

These are reviewed compatibility exceptions, not permission to ignore React effect semantics.
