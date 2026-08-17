-- Applied to production Supabase as: add_private_cod_inventory_consumer
-- Atomically consumes only inventory not already held by prepaid reservations.

create or replace function private.consume_unreserved_inventory(
  p_items jsonb
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
  v_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_INVENTORY_ITEMS';
  end if;

  update private.inventory_reservation
     set status = 'EXPIRED', updated_at = now()
   where status = 'ACTIVE' and expires_at <= now();

  create temporary table if not exists pg_temp.neejee_consume_items (
    variant_id text primary key,
    quantity integer not null
  ) on commit drop;
  truncate pg_temp.neejee_consume_items;

  insert into pg_temp.neejee_consume_items (variant_id, quantity)
  select item->>'variantId', sum((item->>'quantity')::integer)
    from jsonb_array_elements(p_items) item
   where nullif(item->>'variantId','') is not null
     and (item->>'quantity') ~ '^[1-9][0-9]*$'
   group by item->>'variantId';

  select count(*) into v_count from pg_temp.neejee_consume_items;
  if v_count = 0 then
    raise exception 'NO_VARIANTS_TO_CONSUME';
  end if;

  perform 1
    from public."Variant" v
    join pg_temp.neejee_consume_items i on i.variant_id = v.id
   order by v.id
   for update of v;

  if (select count(*) from public."Variant" v join pg_temp.neejee_consume_items i on i.variant_id = v.id) <> v_count then
    raise exception 'VARIANT_NOT_FOUND';
  end if;

  for r in select variant_id, quantity from pg_temp.neejee_consume_items order by variant_id loop
    select inventory into v_inventory from public."Variant" where id = r.variant_id;
    select coalesce(sum(quantity),0)::integer into v_reserved
      from private.inventory_reservation
     where variant_id = r.variant_id
       and status = 'ACTIVE'
       and expires_at > now();
    v_available := greatest(0, v_inventory - v_reserved);
    if v_available < r.quantity then
      raise exception 'INSUFFICIENT_UNRESERVED_INVENTORY:%:requested=%:available=%', r.variant_id, r.quantity, v_available;
    end if;
  end loop;

  update public."Variant" v
     set inventory = v.inventory - i.quantity
    from pg_temp.neejee_consume_items i
   where v.id = i.variant_id;

  return jsonb_build_object('ok', true, 'variantCount', v_count);
end;
$$;

revoke all on function private.consume_unreserved_inventory(jsonb) from public, anon, authenticated;
