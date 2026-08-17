create table if not exists private.autonomy_proposal (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  domain text not null,
  risk_class text not null check (risk_class in ('A','B','C')),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','APPROVED','REJECTED','APPLIED','FAILED','ROLLBACK_REQUESTED','ROLLED_BACK')),
  summary text not null,
  rationale text,
  evidence jsonb not null default '[]'::jsonb,
  proposed_change jsonb not null default '{}'::jsonb,
  test_plan jsonb not null default '[]'::jsonb,
  rollback_plan jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'autonomous',
  model text,
  proposal_hash text unique,
  created_by text,
  reviewed_by text,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  applied_at timestamptz,
  rolled_back_at timestamptz
);

create index if not exists autonomy_proposal_status_created_idx on private.autonomy_proposal(status, created_at desc);
create index if not exists autonomy_proposal_domain_created_idx on private.autonomy_proposal(domain, created_at desc);

create table if not exists private.autonomy_event (
  id bigserial primary key,
  proposal_id uuid references private.autonomy_proposal(id) on delete cascade,
  action text not null,
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists autonomy_event_proposal_created_idx on private.autonomy_event(proposal_id, created_at desc);

create table if not exists private.autonomy_policy (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  web_research_enabled boolean not null default true,
  max_proposals_per_run integer not null default 5 check (max_proposals_per_run between 1 and 20),
  code_auto_apply boolean not null default false,
  core_auto_apply boolean not null default false,
  approval_required boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into private.autonomy_policy (id) values (1) on conflict (id) do nothing;

revoke all on table private.autonomy_proposal from public, anon, authenticated;
revoke all on table private.autonomy_event from public, anon, authenticated;
revoke all on table private.autonomy_policy from public, anon, authenticated;
revoke all on sequence private.autonomy_event_id_seq from public, anon, authenticated;

comment on table private.autonomy_proposal is 'Approval-gated NEEJEE autonomous improvement proposals and release evidence.';
comment on table private.autonomy_event is 'Immutable audit history for autonomous release proposal lifecycle.';
comment on table private.autonomy_policy is 'Singleton safety policy for NEEJEE autonomous evolution.';
