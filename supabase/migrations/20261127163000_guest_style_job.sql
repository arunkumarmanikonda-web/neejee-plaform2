create table if not exists private.guest_style_job (
  id uuid not null,
  owner_hash text not null,
  state text not null default 'pending' check (state in ('pending','queued','failed')),
  provider_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  primary key (owner_hash,id)
);
alter table private.guest_style_job enable row level security;
revoke all on private.guest_style_job from public, anon, authenticated;
create index if not exists guest_style_job_expiry on private.guest_style_job(expires_at);
