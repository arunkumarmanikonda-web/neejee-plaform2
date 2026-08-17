-- Production DB was applied in separate backward-compatible steps. This file
-- records the final release-hardening state for reproducible environments.

create index if not exists coupon_reservation_user_id_idx on private.coupon_reservation (user_id);
create index if not exists "AbAssignment_variantId_idx" on public."AbAssignment" ("variantId");
create index if not exists "AiPhotoRequest_productId_idx" on public."AiPhotoRequest" ("productId");
create index if not exists "Bill_categoryId_idx" on public."Bill" ("categoryId");
create index if not exists "Dispute_orderId_idx" on public."Dispute" ("orderId");
create index if not exists "Dispute_purchaseOrderId_idx" on public."Dispute" ("purchaseOrderId");
create index if not exists "EmployeeSalaryAssignment_structureId_idx" on public."EmployeeSalaryAssignment" ("structureId");
create index if not exists "ExpenseCategory_parentCategoryId_idx" on public."ExpenseCategory" ("parentCategoryId");
create index if not exists "LoyaltyLedger_awardedById_idx" on public."LoyaltyLedger" ("awardedById");
create index if not exists "SellerDocument_changeRequestId_idx" on public."SellerDocument" ("changeRequestId");
create index if not exists "SellerInventorySubmission_productId_idx" on public."SellerInventorySubmission" ("productId");

create or replace function private.process_paid_order_loyalty(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order public."Order"%rowtype;
  v_user public."User"%rowtype;
  v_settings public."LoyaltySettings"%rowtype;
  v_old_tier text;
  v_new_tier text;
  v_new_spend integer;
  v_multiplier double precision;
  v_points integer;
  v_expires_at timestamp without time zone;
begin
  select * into v_order from public."Order" where id = p_order_id for update;
  if not found or v_order."userId" is null or v_order."paymentStatus"::text <> 'PAID' then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'not_eligible');
  end if;

  if coalesce(v_order."pointsEarned", 0) > 0 or exists (
    select 1 from public."LoyaltyLedger" where "orderId" = p_order_id and type = 'EARN'
  ) then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'already_processed', 'userId', v_order."userId");
  end if;

  select * into v_user from public."User" where id = v_order."userId" for update;
  if not found then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'user_not_found');
  end if;

  select * into v_settings from public."LoyaltySettings" where id = 'singleton';
  if not found then raise exception 'LOYALTY_SETTINGS_MISSING'; end if;

  v_old_tier := coalesce(v_user."loyaltyTier", 'FOUND');
  v_new_spend := coalesce(v_user."lifetimeSpend", 0) + coalesce(v_order.total, 0);
  v_new_tier := case
    when v_new_spend >= v_settings."thresholdFamily" then 'FAMILY'
    when v_new_spend >= v_settings."thresholdPersonal" then 'PERSONAL'
    when v_new_spend >= v_settings."thresholdKnown" then 'KNOWN'
    else 'FOUND'
  end;
  v_multiplier := case v_old_tier
    when 'KNOWN' then v_settings."multiplierKnown"
    when 'PERSONAL' then v_settings."multiplierPersonal"
    when 'FAMILY' then v_settings."multiplierFamily"
    else v_settings."multiplierFound"
  end;
  if v_settings."paisePerPoint" <= 0 then raise exception 'INVALID_LOYALTY_SETTINGS'; end if;

  v_points := greatest(0, floor(floor(coalesce(v_order.total, 0)::numeric / v_settings."paisePerPoint") * v_multiplier)::integer);
  v_expires_at := current_timestamp + make_interval(months => greatest(0, v_settings."pointsExpireMonths"));

  insert into public."LoyaltyLedger"(
    id, "userId", type, points, reason, "orderId", "expiresAt", "createdAt"
  ) values (
    gen_random_uuid()::text, v_user.id, 'EARN', v_points,
    'Order ' || v_order."orderNumber", v_order.id, v_expires_at, current_timestamp
  );

  update public."User"
     set "lifetimeSpend" = v_new_spend,
         "loyaltyTier" = v_new_tier,
         "loyaltyPoints" = coalesce("loyaltyPoints",0) + v_points,
         "lifetimePoints" = coalesce("lifetimePoints",0) + v_points,
         "updatedAt" = current_timestamp
   where id = v_user.id;

  update public."Order"
     set "pointsEarned" = v_points, "updatedAt" = current_timestamp
   where id = v_order.id;

  return jsonb_build_object(
    'ok', true, 'awarded', true, 'userId', v_user.id, 'orderId', v_order.id,
    'orderTotal', v_order.total, 'points', v_points, 'oldTier', v_old_tier, 'newTier', v_new_tier
  );
end;
$$;

create or replace function private.expire_checkout_reservations()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inventory integer := 0;
  v_coupon integer := 0;
  v_loyalty integer := 0;
begin
  update private.inventory_reservation set status='EXPIRED', updated_at=now()
   where status='ACTIVE' and expires_at<=now();
  get diagnostics v_inventory=row_count;
  update private.coupon_reservation set status='EXPIRED', updated_at=now()
   where status='ACTIVE' and expires_at<=now();
  get diagnostics v_coupon=row_count;
  update private.loyalty_reservation set status='EXPIRED', updated_at=now()
   where status='ACTIVE' and expires_at<=now();
  get diagnostics v_loyalty=row_count;
  return jsonb_build_object(
    'ok',true,'inventoryExpired',v_inventory,'couponExpired',v_coupon,
    'loyaltyExpired',v_loyalty,'totalExpired',v_inventory+v_coupon+v_loyalty,'ranAt',now()
  );
end;
$$;

revoke all on function private.process_paid_order_loyalty(text) from public, anon, authenticated;
revoke all on function private.expire_checkout_reservations() from public, anon, authenticated;
