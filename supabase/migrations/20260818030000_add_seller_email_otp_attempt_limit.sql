alter table public."SellerMagicToken"
  add column if not exists "attempts" integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'SellerMagicToken_attempts_nonnegative'
      and conrelid = 'public."SellerMagicToken"'::regclass
  ) then
    alter table public."SellerMagicToken"
      add constraint "SellerMagicToken_attempts_nonnegative"
      check ("attempts" >= 0) not valid;
  end if;
end $$;

alter table public."SellerMagicToken"
  validate constraint "SellerMagicToken_attempts_nonnegative";
