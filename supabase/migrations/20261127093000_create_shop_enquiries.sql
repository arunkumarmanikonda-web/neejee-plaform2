create table public."ShopEnquiry" (
  id uuid primary key,
  "pieceId" text not null,
  email text not null,
  message text not null,
  "createdAt" timestamptz(3) not null default now(),
  "handledAt" timestamptz(3),
  constraint shop_enquiry_length check (length(email) between 3 and 254 and length(message) <= 600 and length("pieceId") between 1 and 80)
);
create index "ShopEnquiry_createdAt_idx" on public."ShopEnquiry" ("createdAt");
alter table public."ShopEnquiry" enable row level security;
revoke all privileges on public."ShopEnquiry" from public, anon, authenticated;
