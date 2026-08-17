create table if not exists private.auth_login_throttle (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint auth_login_throttle_attempts_nonnegative check (attempts >= 0)
);

revoke all on private.auth_login_throttle from public, anon, authenticated;

create or replace function private.auth_login_rate_status(
  p_key_hash text,
  p_window_seconds integer default 900
)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row private.auth_login_throttle%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'invalid throttle key';
  end if;

  select * into v_row
  from private.auth_login_throttle
  where key_hash = p_key_hash;

  if not found then
    return query select true, 0;
    return;
  end if;

  if v_row.locked_until is not null and v_row.locked_until > v_now then
    return query select false, greatest(1, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer);
    return;
  end if;

  if v_row.window_started_at < v_now - make_interval(secs => greatest(60, p_window_seconds)) then
    delete from private.auth_login_throttle where key_hash = p_key_hash;
  elsif v_row.locked_until is not null then
    update private.auth_login_throttle
      set locked_until = null,
          updated_at = v_now
      where key_hash = p_key_hash;
  end if;

  return query select true, 0;
end;
$$;

create or replace function private.record_auth_login_failure(
  p_key_hash text,
  p_limit integer default 12,
  p_window_seconds integer default 900,
  p_lock_seconds integer default 900
)
returns table(allowed boolean, retry_after integer, attempts integer)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row private.auth_login_throttle%rowtype;
  v_now timestamptz := clock_timestamp();
  v_limit integer := greatest(3, p_limit);
  v_window integer := greatest(60, p_window_seconds);
  v_lock integer := greatest(60, p_lock_seconds);
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'invalid throttle key';
  end if;

  insert into private.auth_login_throttle(key_hash, attempts, window_started_at, locked_until, updated_at)
  values (p_key_hash, 0, v_now, null, v_now)
  on conflict (key_hash) do nothing;

  select * into v_row
  from private.auth_login_throttle
  where key_hash = p_key_hash
  for update;

  if v_row.locked_until is not null and v_row.locked_until > v_now then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer),
      v_row.attempts;
    return;
  end if;

  if v_row.window_started_at < v_now - make_interval(secs => v_window) then
    v_row.attempts := 1;
    v_row.window_started_at := v_now;
    v_row.locked_until := null;
  else
    v_row.attempts := v_row.attempts + 1;
  end if;

  if v_row.attempts >= v_limit then
    v_row.locked_until := v_now + make_interval(secs => v_lock);
  end if;

  update private.auth_login_throttle
    set attempts = v_row.attempts,
        window_started_at = v_row.window_started_at,
        locked_until = v_row.locked_until,
        updated_at = v_now
    where key_hash = p_key_hash;

  if v_row.locked_until is not null and v_row.locked_until > v_now then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer),
      v_row.attempts;
  else
    return query select true, 0, v_row.attempts;
  end if;
end;
$$;

create or replace function private.clear_auth_login_failures(p_key_hash text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    return;
  end if;
  delete from private.auth_login_throttle where key_hash = p_key_hash;
end;
$$;

revoke all on function private.auth_login_rate_status(text, integer) from public, anon, authenticated;
revoke all on function private.record_auth_login_failure(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function private.clear_auth_login_failures(text) from public, anon, authenticated;
grant execute on function private.auth_login_rate_status(text, integer) to postgres;
grant execute on function private.record_auth_login_failure(text, integer, integer, integer) to postgres;
grant execute on function private.clear_auth_login_failures(text) to postgres;

create index if not exists auth_login_throttle_updated_idx
  on private.auth_login_throttle(updated_at);
