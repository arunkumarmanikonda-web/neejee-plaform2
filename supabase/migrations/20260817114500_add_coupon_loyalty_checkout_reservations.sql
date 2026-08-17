-- Applied to production Supabase in two backward-compatible steps:
--   add_coupon_loyalty_checkout_reservations
--   require_identity_for_per_user_coupon
--
-- Reproducible final state for atomic coupon capacity and loyalty-point checkout holds.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create unique index if not exists loyalty_ledger_order_earn_unique_idx
  on public."LoyaltyLedger" ("orderId", type)
  where "orderId" is not null and type = 'EARN';
create unique index if not exists loyalty_ledger_order_redeem_unique_idx
  on public."LoyaltyLedger" ("orderId", type)
  where "orderId" is not null and type = 'REDEEM';

create table if not exists private.coupon_reservation (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text not null unique references public."AbandonedCart"(id) on delete cascade,
  coupon_id text not null references public."Coupon"(id) on delete cascade,
  user_id text references public."User"(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CONSUMED','RELEASED','EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consumed_order_id text,
  consumed_at timestamptz
);
create index if not exists coupon_reservation_capacity_idx
  on private.coupon_reservation (coupon_id, status, expires_at);
create index if not exists coupon_reservation_expiry_idx
  on private.coupon_reservation (expires_at) where status = 'ACTIVE';
create unique index if not exists coupon_reservation_user_active_unique_idx
  on private.coupon_reservation (coupon_id, user_id)
  where user_id is not null and status = 'ACTIVE';

create table if not exists private.loyalty_reservation (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text not null unique references public."AbandonedCart"(id) on delete cascade,
  user_id text not null references public."User"(id) on delete cascade,
  points integer not null check (points > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CONSUMED','RELEASED','EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consumed_order_id text,
  consumed_at timestamptz
);
create index if not exists loyalty_reservation_user_active_idx
  on private.loyalty_reservation (user_id, status, expires_at);
create index if not exists loyalty_reservation_expiry_idx
  on private.loyalty_reservation (expires_at) where status = 'ACTIVE';

create or replace function private.reserve_coupon(
  p_snapshot_id text,
  p_coupon_id text,
  p_user_id text,
  p_subtotal integer,
  p_hold_minutes integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_coupon public."Coupon"%rowtype;
  v_existing private.coupon_reservation%rowtype;
  v_reserved integer := 0;
  v_expires_at timestamptz;
begin
  if p_snapshot_id is null or length(trim(p_snapshot_id)) = 0 then raise exception 'INVALID_SNAPSHOT'; end if;
  if p_coupon_id is null or length(trim(p_coupon_id)) = 0 then raise exception 'INVALID_COUPON'; end if;
  if p_subtotal is null or p_subtotal < 0 then raise exception 'INVALID_SUBTOTAL'; end if;
  if p_hold_minutes < 5 or p_hold_minutes > 60 then raise exception 'INVALID_HOLD_MINUTES'; end if;
  if not exists (select 1 from public."AbandonedCart" where id = p_snapshot_id) then raise exception 'SNAPSHOT_NOT_FOUND'; end if;

  update private.coupon_reservation set status='EXPIRED', updated_at=now()
   where status='ACTIVE' and expires_at <= now();

  select * into v_coupon from public."Coupon" where id = p_coupon_id for update;
  if not found then raise exception 'COUPON_NOT_FOUND'; end if;
  if not v_coupon.active then raise exception 'COUPON_INACTIVE'; end if;
  if v_coupon."validFrom" is not null and v_coupon."validFrom" > now() then raise exception 'COUPON_NOT_YET_ACTIVE'; end if;
  if v_coupon."validTo" is not null and v_coupon."validTo" < now() then raise exception 'COUPON_EXPIRED'; end if;
  if v_coupon."minCart" is not null and p_subtotal < v_coupon."minCart" then raise exception 'COUPON_MIN_CART'; end if;
  if v_coupon."userId" is not null and (p_user_id is null or v_coupon."userId" <> p_user_id) then raise exception 'COUPON_WRONG_USER'; end if;
  if v_coupon."perUserOnce" and p_user_id is null then raise exception 'COUPON_SIGN_IN_REQUIRED'; end if;

  select * into v_existing from private.coupon_reservation where snapshot_id = p_snapshot_id for update;
  if found and v_existing.status = 'CONSUMED' then raise exception 'COUPON_RESERVATION_CONSUMED'; end if;

  if v_coupon."perUserOnce" and p_user_id is not null then
    if exists (select 1 from public."CouponRedemption" where "couponId"=p_coupon_id and "userId"=p_user_id) then
      raise exception 'COUPON_ALREADY_USED';
    end if;
    if exists (
      select 1 from private.coupon_reservation
       where coupon_id=p_coupon_id and user_id=p_user_id and status='ACTIVE' and expires_at>now() and snapshot_id<>p_snapshot_id
    ) then raise exception 'COUPON_ALREADY_RESERVED'; end if;
  end if;

  select count(*)::integer into v_reserved
    from private.coupon_reservation
   where coupon_id=p_coupon_id and status='ACTIVE' and expires_at>now() and snapshot_id<>p_snapshot_id;
  if v_coupon."maxUses" is not null and v_coupon."usedCount" + v_reserved >= v_coupon."maxUses" then
    raise exception 'COUPON_USAGE_LIMIT';
  end if;

  v_expires_at := now() + make_interval(mins => p_hold_minutes);
  insert into private.coupon_reservation(snapshot_id,coupon_id,user_id,status,expires_at,updated_at,consumed_order_id,consumed_at)
  values (p_snapshot_id,p_coupon_id,p_user_id,'ACTIVE',v_expires_at,now(),null,null)
  on conflict (snapshot_id) do update set
    coupon_id=excluded.coupon_id,user_id=excluded.user_id,status='ACTIVE',expires_at=excluded.expires_at,updated_at=now(),consumed_order_id=null,consumed_at=null;

  return jsonb_build_object('ok',true,'snapshotId',p_snapshot_id,'couponId',p_coupon_id,'expiresAt',v_expires_at);
end;
$$;

create or replace function private.consume_coupon_reservation(
  p_snapshot_id text,
  p_order_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_res private.coupon_reservation%rowtype;
  v_coupon public."Coupon"%rowtype;
begin
  select * into v_res from private.coupon_reservation where snapshot_id=p_snapshot_id for update;
  if not found then raise exception 'COUPON_RESERVATION_NOT_FOUND'; end if;
  if v_res.status='CONSUMED' then
    return jsonb_build_object('ok',true,'idempotent',true,'couponId',v_res.coupon_id);
  end if;
  if v_res.status='RELEASED' then raise exception 'COUPON_RESERVATION_RELEASED'; end if;

  select * into v_coupon from public."Coupon" where id=v_res.coupon_id for update;
  if not found then raise exception 'COUPON_NOT_FOUND'; end if;

  if v_res.user_id is not null and exists (
    select 1 from public."CouponRedemption" where "couponId"=v_res.coupon_id and "userId"=v_res.user_id
  ) then raise exception 'COUPON_ALREADY_USED'; end if;

  update public."Coupon" set "usedCount"="usedCount"+1 where id=v_res.coupon_id;
  if v_res.user_id is not null then
    insert into public."CouponRedemption"(id,"couponId","userId","orderId","redeemedAt")
    values (gen_random_uuid()::text,v_res.coupon_id,v_res.user_id,p_order_id,current_timestamp);
  end if;
  update private.coupon_reservation
     set status='CONSUMED', consumed_order_id=p_order_id, consumed_at=now(), updated_at=now()
   where snapshot_id=p_snapshot_id;
  return jsonb_build_object('ok',true,'couponId',v_res.coupon_id,'late',v_res.expires_at<=now());
end;
$$;

create or replace function private.redeem_coupon_now(
  p_coupon_id text,
  p_user_id text,
  p_subtotal integer,
  p_order_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_coupon public."Coupon"%rowtype;
  v_reserved integer := 0;
begin
  update private.coupon_reservation set status='EXPIRED', updated_at=now()
   where status='ACTIVE' and expires_at<=now();
  select * into v_coupon from public."Coupon" where id=p_coupon_id for update;
  if not found then raise exception 'COUPON_NOT_FOUND'; end if;
  if not v_coupon.active then raise exception 'COUPON_INACTIVE'; end if;
  if v_coupon."validFrom" is not null and v_coupon."validFrom">now() then raise exception 'COUPON_NOT_YET_ACTIVE'; end if;
  if v_coupon."validTo" is not null and v_coupon."validTo"<now() then raise exception 'COUPON_EXPIRED'; end if;
  if v_coupon."minCart" is not null and p_subtotal<v_coupon."minCart" then raise exception 'COUPON_MIN_CART'; end if;
  if v_coupon."userId" is not null and (p_user_id is null or v_coupon."userId"<>p_user_id) then raise exception 'COUPON_WRONG_USER'; end if;
  if v_coupon."perUserOnce" and p_user_id is null then raise exception 'COUPON_SIGN_IN_REQUIRED'; end if;
  if v_coupon."perUserOnce" and p_user_id is not null and exists (
    select 1 from public."CouponRedemption" where "couponId"=p_coupon_id and "userId"=p_user_id
  ) then raise exception 'COUPON_ALREADY_USED'; end if;
  select count(*)::integer into v_reserved from private.coupon_reservation
   where coupon_id=p_coupon_id and status='ACTIVE' and expires_at>now();
  if v_coupon."maxUses" is not null and v_coupon."usedCount"+v_reserved>=v_coupon."maxUses" then raise exception 'COUPON_USAGE_LIMIT'; end if;
  update public."Coupon" set "usedCount"="usedCount"+1 where id=p_coupon_id;
  if p_user_id is not null then
    insert into public."CouponRedemption"(id,"couponId","userId","orderId","redeemedAt")
    values (gen_random_uuid()::text,p_coupon_id,p_user_id,p_order_id,current_timestamp);
  end if;
  return jsonb_build_object('ok',true,'couponId',p_coupon_id);
end;
$$;

create or replace function private.release_coupon_reservation(
  p_snapshot_id text,
  p_reason text default 'RELEASED'
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_count integer;
begin
  update private.coupon_reservation
     set status=case when upper(coalesce(p_reason,''))='EXPIRED' then 'EXPIRED' else 'RELEASED' end,
         updated_at=now()
   where snapshot_id=p_snapshot_id and status='ACTIVE';
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function private.reserve_loyalty_points(
  p_snapshot_id text,
  p_user_id text,
  p_points integer,
  p_hold_minutes integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tier text;
  v_balance integer := 0;
  v_reserved integer := 0;
  v_expires_at timestamptz;
  v_existing private.loyalty_reservation%rowtype;
begin
  if p_snapshot_id is null or length(trim(p_snapshot_id))=0 then raise exception 'INVALID_SNAPSHOT'; end if;
  if p_user_id is null or length(trim(p_user_id))=0 then raise exception 'INVALID_USER'; end if;
  if p_points is null or p_points<=0 then raise exception 'INVALID_POINTS'; end if;
  if p_hold_minutes<5 or p_hold_minutes>60 then raise exception 'INVALID_HOLD_MINUTES'; end if;
  if not exists(select 1 from public."AbandonedCart" where id=p_snapshot_id) then raise exception 'SNAPSHOT_NOT_FOUND'; end if;

  update private.loyalty_reservation set status='EXPIRED',updated_at=now()
   where status='ACTIVE' and expires_at<=now();
  select "loyaltyTier" into v_tier from public."User" where id=p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  select * into v_existing from private.loyalty_reservation where snapshot_id=p_snapshot_id for update;
  if found and v_existing.status='CONSUMED' then raise exception 'LOYALTY_RESERVATION_CONSUMED'; end if;

  select coalesce(sum(points),0)::integer into v_balance from public."LoyaltyLedger"
   where "userId"=p_user_id and (v_tier='FAMILY' or "expiresAt" is null or "expiresAt">=now());
  select coalesce(sum(points),0)::integer into v_reserved from private.loyalty_reservation
   where user_id=p_user_id and status='ACTIVE' and expires_at>now() and snapshot_id<>p_snapshot_id;
  if v_balance-v_reserved<p_points then raise exception 'LOYALTY_INSUFFICIENT'; end if;

  v_expires_at:=now()+make_interval(mins=>p_hold_minutes);
  insert into private.loyalty_reservation(snapshot_id,user_id,points,status,expires_at,updated_at,consumed_order_id,consumed_at)
  values(p_snapshot_id,p_user_id,p_points,'ACTIVE',v_expires_at,now(),null,null)
  on conflict(snapshot_id) do update set
    user_id=excluded.user_id,points=excluded.points,status='ACTIVE',expires_at=excluded.expires_at,updated_at=now(),consumed_order_id=null,consumed_at=null;
  return jsonb_build_object('ok',true,'snapshotId',p_snapshot_id,'points',p_points,'expiresAt',v_expires_at);
end;
$$;

create or replace function private.consume_loyalty_reservation(
  p_snapshot_id text,
  p_order_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_res private.loyalty_reservation%rowtype;
  v_tier text;
  v_balance integer := 0;
  v_reserved integer := 0;
begin
  select * into v_res from private.loyalty_reservation where snapshot_id=p_snapshot_id for update;
  if not found then raise exception 'LOYALTY_RESERVATION_NOT_FOUND'; end if;
  if v_res.status='CONSUMED' then return jsonb_build_object('ok',true,'idempotent',true,'points',v_res.points); end if;
  if v_res.status='RELEASED' then raise exception 'LOYALTY_RESERVATION_RELEASED'; end if;
  if exists(select 1 from public."LoyaltyLedger" where "orderId"=p_order_id and type='REDEEM') then
    update private.loyalty_reservation set status='CONSUMED',consumed_order_id=p_order_id,consumed_at=now(),updated_at=now() where snapshot_id=p_snapshot_id;
    return jsonb_build_object('ok',true,'idempotent',true,'points',v_res.points);
  end if;

  select "loyaltyTier" into v_tier from public."User" where id=v_res.user_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  select coalesce(sum(points),0)::integer into v_balance from public."LoyaltyLedger"
   where "userId"=v_res.user_id and (v_tier='FAMILY' or "expiresAt" is null or "expiresAt">=now());

  if v_res.expires_at<=now() or v_res.status='EXPIRED' then
    select coalesce(sum(points),0)::integer into v_reserved from private.loyalty_reservation
     where user_id=v_res.user_id and status='ACTIVE' and expires_at>now() and snapshot_id<>p_snapshot_id;
    if v_balance-v_reserved<v_res.points then raise exception 'LOYALTY_UNAVAILABLE_AFTER_HOLD'; end if;
  end if;

  insert into public."LoyaltyLedger"(id,"userId",type,points,reason,"orderId","createdAt")
  values(gen_random_uuid()::text,v_res.user_id,'REDEEM',-v_res.points,'Checkout redemption',p_order_id,current_timestamp);
  update public."User" set "loyaltyPoints"=greatest(0,v_balance-v_res.points),"updatedAt"=current_timestamp where id=v_res.user_id;
  update private.loyalty_reservation set status='CONSUMED',consumed_order_id=p_order_id,consumed_at=now(),updated_at=now() where snapshot_id=p_snapshot_id;
  return jsonb_build_object('ok',true,'points',v_res.points,'late',v_res.expires_at<=now());
end;
$$;

create or replace function private.redeem_loyalty_points_now(
  p_user_id text,
  p_points integer,
  p_order_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tier text;
  v_balance integer := 0;
  v_reserved integer := 0;
begin
  if p_points is null or p_points<=0 then raise exception 'INVALID_POINTS'; end if;
  if exists(select 1 from public."LoyaltyLedger" where "orderId"=p_order_id and type='REDEEM') then
    return jsonb_build_object('ok',true,'idempotent',true,'points',p_points);
  end if;
  update private.loyalty_reservation set status='EXPIRED',updated_at=now() where status='ACTIVE' and expires_at<=now();
  select "loyaltyTier" into v_tier from public."User" where id=p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  select coalesce(sum(points),0)::integer into v_balance from public."LoyaltyLedger"
   where "userId"=p_user_id and (v_tier='FAMILY' or "expiresAt" is null or "expiresAt">=now());
  select coalesce(sum(points),0)::integer into v_reserved from private.loyalty_reservation
   where user_id=p_user_id and status='ACTIVE' and expires_at>now();
  if v_balance-v_reserved<p_points then raise exception 'LOYALTY_INSUFFICIENT'; end if;
  insert into public."LoyaltyLedger"(id,"userId",type,points,reason,"orderId","createdAt")
  values(gen_random_uuid()::text,p_user_id,'REDEEM',-p_points,'Checkout redemption',p_order_id,current_timestamp);
  update public."User" set "loyaltyPoints"=greatest(0,v_balance-p_points),"updatedAt"=current_timestamp where id=p_user_id;
  return jsonb_build_object('ok',true,'points',p_points);
end;
$$;

create or replace function private.release_loyalty_reservation(
  p_snapshot_id text,
  p_reason text default 'RELEASED'
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_count integer;
begin
  update private.loyalty_reservation
     set status=case when upper(coalesce(p_reason,''))='EXPIRED' then 'EXPIRED' else 'RELEASED' end,
         updated_at=now()
   where snapshot_id=p_snapshot_id and status='ACTIVE';
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
