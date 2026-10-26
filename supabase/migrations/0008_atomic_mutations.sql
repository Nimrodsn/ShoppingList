-- ── Operation ledger ───────────────────────────────────────
-- Every mutating Server Action carries a clientId from the offline queue. The ledger
-- records which clientIds were applied, so a retried request is a no-op instead of a
-- second apply. RLS with zero policies, like every table: only the service role in.
create table public.applied_operations (
  client_id    uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  kind         text not null,
  outcome      jsonb not null,
  created_at   timestamptz not null default now()
);
create index on public.applied_operations (household_id, created_at);
alter table public.applied_operations enable row level security;

-- ── Atomic add/merge ───────────────────────────────────────
-- Replaces the read-then-write pair that used to live in actions/items.ts. The open
-- row is locked and the quantity increment happens inside one statement, so two
-- simultaneous adds of the same product cannot lose each other, and a retried add
-- cannot double the quantity or create a second row. Undo keeps working: a restore
-- arrives with a fresh clientId, so it applies as a normal add.
create or replace function public.apply_add_item(
  p_client_id    uuid,
  p_household_id uuid,
  p_list_id      uuid,
  p_category_id  uuid,
  p_name         text,
  p_quantity     numeric,
  p_unit         text,
  p_note         text,
  p_is_urgent    boolean,
  p_added_by     text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  open_item     public.items;
  new_id        uuid;
  next_quantity numeric;
  outcome       jsonb;
begin
  -- Retries of the same clientId serialize here, then exit as duplicates below.
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));

  select o.outcome into outcome
    from public.applied_operations o
   where o.client_id = p_client_id;
  if found then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- Concurrent adds of the same product on the same list serialize here, so the
  -- merge check cannot miss a row mid-insert in another transaction.
  perform pg_advisory_xact_lock(
    hashtextextended(p_list_id::text || ':' || public.normalize_he(p_name), 0));

  select * into open_item
    from public.items i
   where i.household_id = p_household_id
     and i.list_id      = p_list_id
     and i.name_norm    = public.normalize_he(p_name)
     and i.is_checked   = false
   order by i.created_at
   limit 1
   for update;

  if found then
    next_quantity := coalesce(open_item.quantity, 1) + coalesce(p_quantity, 1);
    update public.items
       set quantity  = next_quantity,
           is_urgent = open_item.is_urgent or coalesce(p_is_urgent, false)
     where id = open_item.id;
    outcome := jsonb_build_object(
      'status', 'merged',
      'itemId', open_item.id,
      'name', open_item.name,
      'quantity', next_quantity);
  else
    insert into public.items (
      client_id, household_id, list_id, category_id, name,
      quantity, unit, note, is_urgent, added_by
    ) values (
      p_client_id, p_household_id, p_list_id, p_category_id, p_name,
      p_quantity, p_unit, p_note, coalesce(p_is_urgent, false), p_added_by
    )
    returning id into new_id;
    outcome := jsonb_build_object(
      'status', 'added',
      'itemId', new_id,
      'name', p_name);
  end if;

  insert into public.applied_operations (client_id, household_id, kind, outcome)
  values (p_client_id, p_household_id, 'add', outcome);

  return outcome;
end $$;

-- ── Atomic trip close ──────────────────────────────────────
-- Archives exactly the rows captured under lock, then deletes exactly those rows.
-- Before this, the archive and the delete were separate statements: an item checked
-- in between vanished without reaching the history, and a retry after a partial
-- failure could not heal. Now a retry either finds the same checked rows (the
-- history insert is idempotent on client_id) or finds none and reports zero.
create or replace function public.close_trip(
  p_household_id uuid,
  p_list_id      uuid,
  p_purchased_by text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  checked_ids     uuid[];
  archived_count  int;
  remaining_count int;
begin
  select array_agg(locked.id) into checked_ids
    from (
      select i.id
        from public.items i
       where i.household_id = p_household_id
         and i.list_id      = p_list_id
         and i.is_checked   = true
       order by i.id
       for update
    ) locked;

  if checked_ids is null then
    select count(*) into remaining_count
      from public.items i
     where i.household_id = p_household_id
       and i.list_id      = p_list_id
       and i.is_checked   = false;
    return jsonb_build_object('archived', 0, 'remaining', remaining_count);
  end if;

  -- The item's own id becomes the history client_id, same convention as before,
  -- so replaying this function for the same rows can never duplicate history.
  insert into public.purchase_history (
    client_id, household_id, name, category_key, quantity, unit, purchased_by
  )
  select
    i.id,
    i.household_id,
    i.name,
    c.key,
    i.quantity,
    i.unit,
    coalesce(i.checked_by, p_purchased_by)
  from public.items i
  left join public.categories c
    on c.household_id = i.household_id
   and c.id           = i.category_id
  where i.id = any(checked_ids)
  on conflict (client_id) do nothing;

  -- The catalog learns the purchase, inline; same rule as bump_catalog_usage.
  update public.catalog_items c
     set use_count    = c.use_count + 1,
         last_used_at = now()
   where (c.household_id is null or c.household_id = p_household_id)
     and c.name_norm = any (
       select public.normalize_he(i.name)
         from public.items i
        where i.id = any(checked_ids)
     );

  delete from public.items where id = any(checked_ids);

  archived_count := array_length(checked_ids, 1);

  select count(*) into remaining_count
    from public.items i
   where i.household_id = p_household_id
     and i.list_id      = p_list_id
     and i.is_checked   = false;

  return jsonb_build_object('archived', archived_count, 'remaining', remaining_count);
end $$;

-- New functions arrive after 0007's default privileges, so they are already
-- service-role only. Stating it anyway keeps this file self-sufficient.
revoke all on function public.apply_add_item(uuid, uuid, uuid, uuid, text, numeric, text, text, boolean, text) from PUBLIC, anon, authenticated;
revoke all on function public.close_trip(uuid, uuid, text) from PUBLIC, anon, authenticated;
grant execute on function public.apply_add_item(uuid, uuid, uuid, uuid, text, numeric, text, text, boolean, text) to service_role;
grant execute on function public.close_trip(uuid, uuid, text) to service_role;
