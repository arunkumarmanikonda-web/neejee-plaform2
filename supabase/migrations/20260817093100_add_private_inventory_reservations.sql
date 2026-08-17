-- Applied to production Supabase as: add_private_inventory_reservations
-- Server-only inventory reservation ledger for prepaid checkout.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.inventory_reservation (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text not null references public."AbandonedCart"(id) on delete cascade,
  variant_id text not null references public."Variant"(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CONSUMED','RELEASED','EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id, variant_id)
);

create index if not exists inventory_reservation_variant_active_idx
  on private.inventory_reservation (variant_id, status, expires_at);
create index if not exists inventory_reservation_snapshot_idx
  on private.inventory_reservation (snapshot_id);
create index if not exists inventory_reservation_expiry_idx
  on private.inventory_reservation (expires_at)
  where status = 'ACTIVE';

create or replace function private.reserve_inventory(
  p_snapshot_id text,
  p_items jsonb,
  p_hold_minutes integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r record;
  v_inventory integer;
  v_reserved integer;
  v_available integer;
  v_expires_at timestamptz;
  v_count integer;
begin
  if p_snapshot_id is null or length(trim(p_snapshot_id)) = 0 then
    raise exception 'INVALID_SNAPSHOT';
  end if;
  if p_hold_minutes < 5 or p_hold_minutes > 60 then
    raise exception 'INVALID_HOLD_MINUTES';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_RESERVATION_ITEMS';
  end if;
  if not exists (select 1 from public."AbandonedCart" where id = p_snapshot_id) then
    raise exception 'SNAPSHOT_NOT_FOUND';
  end if;

  update private.inventory_reservation
     set status = 'EXPIRED', updated_at = now()
   where status = 'ACTIVE' and expires_at <= now();

  create temporary table if not exists pg_temp.neejee_reserve_items (
    variant_id text primary key,
    quantity integer not null
  ) on commit drop;
  truncate pg_temp.neejee_reserve_items;

  insert into pg_temp.neejee_reserve_items (variant_id, quantity)
  select item->>'variantId', sum((item->>'quantity')::integer)
    from jsonb_array_elements(p_items) item
   where nullif(item->>'variantId','') is not null
     and (item->>'quantity') ~ '^[1-9][0-9]*$'
   group by item->>'variantId';

  select count(*) into v_count from pg_temp.neejee_reserve_items;
  if v_count = 0 then
    raise exception 'NO_VARIANTS_TO_RESERVE';
  end if;

  perform 1
    from public."Variant" v
    join pg_temp.neejee_reserve_items i on i.variant_id = v.id
   order by v.id
   for update of v;

  if (select count(*) from public."Variant" v join pg_temp.neejee_reserve_items i on i.variant_id = v.id) <> v_count then
    raise exception 'VARIANT_NOT_FOUND';
  end if;

  for r in select variant_id, quantity from pg_temp.neejee_reserve_items order by variant_id loop
    select inventory into v_inventory from public."Variant" where id = r.variant_id;
    select coalesce(sum(quantity),0)::integer into v_reserved
      from private.inventory_reservation
     where variant_id = r.variant_id
       and status = 'ACTIVE'
       and expires_at > now()
       and snapshot_id <> p_snapshot_id;
    v_available := greatest(0, v_inventory - v_reserved);
    if v_available < r.quantity then
      raise exception 'INSUFFICIENT_INVENTORY:%:requested=%:available=%', r.variant_id, r.quantity, v_available;
    end if;
  end loop;

  v_expires_at := now() + make_interval(mins => p_hold_minutes);

  insert into private.inventory_reservation (
    snapshot_id, variant_id, quantity, status, expires_at, updated_at
  )
  select p_snapshot_id, variant_id, quantity, 'ACTIVE', v_expires_at, now()
    from pg_temp.neejee_reserve_items
  on conflict (snapshot_id, variant_id) do update
    set quantity = excluded.quantity,
        status = 'ACTIVE',
        expires_at = excluded.expires_at,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'snapshotId', p_snapshot_id,
    'expiresAt', v_expires_at,
    'variantCount', v_count
  );
end;
$$;

create or replace function private.consume_inventory_reservation(
  p_snapshot_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r record;
  v_inventory integer;
  v_other_reserved integer;
  v_available integer;
  v_count integer := 0;
begin
  if p_snapshot_id is null or length(trim(p_snapshot_id)) = 0 then
    raise exception 'INVALID_SNAPSHOT';
  end if;

  update private.inventory_reservation
     set status = 'EXPIRED', updated_at = now()
   where status = 'ACTIVE' and expires_at <= now() and snapshot_id <> p_snapshot_id;

  perform 1
    from public."Variant" v
    join private.inventory_reservation ir on ir.variant_id = v.id
   where ir.snapshot_id = p_snapshot_id
     and ir.status in ('ACTIVE','EXPIRED')
   order by v.id
   for update of v;

  for r in
    select ir.variant_id, ir.quantity, ir.status, ir.expires_at
      from private.inventory_reservation ir
     where ir.snapshot_id = p_snapshot_id
       and ir.status in ('ACTIVE','EXPIRED')
     order by ir.variant_id
  loop
    select inventory into v_inventory from public."Variant" where id = r.variant_id;
    if v_inventory is null then
      raise exception 'VARIANT_NOT_FOUND:%', r.variant_id;
    end if;

    if r.status = 'ACTIVE' and r.expires_at > now() then
      if v_inventory < r.quantity then
        raise exception 'INVENTORY_CORRUPTION:%:requested=%:inventory=%', r.variant_id, r.quantity, v_inventory;
      end if;
    else
      select coalesce(sum(quantity),0)::integer into v_other_reserved
        from private.inventory_reservation
       where variant_id = r.variant_id
         and status = 'ACTIVE'
         and expires_at > now()
         and snapshot_id <> p_snapshot_id;
      v_available := greatest(0, v_inventory - v_other_reserved);
      if v_available < r.quantity then
        raise exception 'INVENTORY_UNAVAILABLE_AFTER_HOLD:%:requested=%:available=%', r.variant_id, r.quantity, v_available;
      end if;
    end if;

    update public."Variant"
       set inventory = inventory - r.quantity
     where id = r.variant_id;

    update private.inventory_reservation
       set status = 'CONSUMED', updated_at = now()
     where snapshot_id = p_snapshot_id and variant_id = r.variant_id;

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  return jsonb_build_object('ok', true, 'snapshotId', p_snapshot_id, 'variantCount', v_count);
end;
$$;

create or replace function private.release_inventory_reservation(
  p_snapshot_id text,
  p_reason text default 'RELEASED'
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_count integer;
begin
  update private.inventory_reservation
     set status = case when upper(coalesce(p_reason,'')) = 'EXPIRED' then 'EXPIRED' else 'RELEASED' end,
         updated_at = now()
   where snapshot_id = p_snapshot_id
     and status = 'ACTIVE';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
