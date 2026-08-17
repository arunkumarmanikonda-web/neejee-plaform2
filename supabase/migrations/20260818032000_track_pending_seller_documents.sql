create table if not exists private.seller_pending_document (
  id uuid primary key default gen_random_uuid(),
  applicant_hash text not null,
  storage_key text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists seller_pending_document_expiry_idx
  on private.seller_pending_document (expires_at)
  where consumed_at is null;

create index if not exists seller_pending_document_applicant_idx
  on private.seller_pending_document (applicant_hash, created_at desc);

revoke all on private.seller_pending_document from public, anon, authenticated;
