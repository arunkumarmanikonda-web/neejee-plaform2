-- Applied to production Supabase as add_newsletter_consent_and_review_integrity.
-- Persists first-party newsletter consent and prevents duplicate active reviews.

create table if not exists public."NewsletterSubscriber" (
  id text primary key default (gen_random_uuid())::text,
  email text not null unique,
  source text,
  status text not null default 'SUBSCRIBED' check (status in ('SUBSCRIBED','UNSUBSCRIBED')),
  "consentAt" timestamp(3) without time zone not null default current_timestamp,
  "unsubscribedAt" timestamp(3) without time zone,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  "updatedAt" timestamp(3) without time zone not null default current_timestamp
);

alter table public."NewsletterSubscriber" enable row level security;
revoke all on table public."NewsletterSubscriber" from anon, authenticated;

create index if not exists "NewsletterSubscriber_status_idx"
  on public."NewsletterSubscriber" (status);

create unique index if not exists "Review_user_product_active_unique_idx"
  on public."Review" ("userId", "productId")
  where status <> 'REJECTED'::public."ReviewStatus";
