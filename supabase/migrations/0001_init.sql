create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ── Hebrew normalization, DB side ──────────────────────────
-- Must stay logically identical to normalizeHebrew() in lib/hebrew.ts.
-- Both are checked against the same inputs in tests/hebrew-sql-equivalence.test.ts.
create or replace function public.normalize_he(txt text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(
      lower(pg_catalog.regexp_replace(txt, '[֑-ׇ]', '', 'g')),  -- niqqud and cantillation
      'םןץףך״׳"''', 'מנצפכ'                                     -- final letters, then quotes get dropped
    ),
    '\s+', ' ', 'g'));
$$;

-- ── Households ─────────────────────────────────────────────
create table public.households (
  id                uuid primary key default gen_random_uuid(),
  name              text not null default 'הבית שלנו',
  secret_slug       text not null unique,
  cookie_generation int  not null default 1,
  realtime_key      uuid not null default gen_random_uuid(),
  created_at        timestamptz not null default now()
);

-- ── Categories ─────────────────────────────────────────────
-- `key` is a stable identifier shared across households ("produce", "dairy"),
-- which is what lets the global catalog point at a category without a uuid.
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  key           text not null,
  name          text not null,
  emoji         text not null default '🛒',
  color         text not null default 'zinc',
  position      int  not null default 0,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (household_id, key),
  unique (household_id, name),
  unique (household_id, id)          -- required by the composite FK on items
);
create index on public.categories (household_id, position);

-- ── Lists ──────────────────────────────────────────────────
create table public.lists (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  emoji         text not null default '🛒',
  position      int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (household_id, id)
);
create index on public.lists (household_id, position);

-- ── Catalog ────────────────────────────────────────────────
-- household_id null = shared global catalog. Category is referenced by key, not uuid.
create table public.catalog_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references public.households(id) on delete cascade,
  name          text not null,
  name_norm     text generated always as (public.normalize_he(name)) stored,
  aliases       text[] not null default '{}',
  aliases_norm  text[],                        -- maintained by trigger
  category_key  text not null default 'other',
  default_unit  text not null default 'יח׳',
  emoji         text,
  use_count     int  not null default 0,
  last_used_at  timestamptz,
  is_staple     boolean not null default false,
  created_at    timestamptz not null default now()
);
create unique index catalog_hh_name  on public.catalog_items (household_id, name_norm)
  where household_id is not null;
create unique index catalog_glb_name on public.catalog_items (name_norm)
  where household_id is null;
create index on public.catalog_items using gin (name_norm gin_trgm_ops);
create index on public.catalog_items using gin (aliases_norm);
create index on public.catalog_items (household_id, use_count desc);

create or replace function public.sync_aliases_norm()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.aliases_norm := (select array_agg(public.normalize_he(a)) from unnest(new.aliases) a);
  return new;
end $$;
create trigger catalog_aliases before insert or update of aliases on public.catalog_items
for each row execute function public.sync_aliases_norm();

-- ── Items ──────────────────────────────────────────────────
create table public.items (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid,                       -- idempotency key for the offline queue
  household_id    uuid not null references public.households(id) on delete cascade,
  list_id         uuid not null,
  category_id     uuid,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  name            text not null,
  name_norm       text generated always as (public.normalize_he(name)) stored,
  quantity        numeric(10,2),
  unit            text,
  note            text,
  is_checked      boolean not null default false,
  is_urgent       boolean not null default false,
  position        int not null default 0,
  added_by        text,
  checked_by      text,
  checked_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Composite FKs physically prevent another household's list or category landing here.
  foreign key (household_id, list_id)     references public.lists(household_id, id)      on delete cascade,
  foreign key (household_id, category_id) references public.categories(household_id, id) on delete set null
);
create index on public.items (list_id, is_checked, position);
create index on public.items (household_id, created_at desc);
create unique index items_client_id on public.items (client_id) where client_id is not null;
-- Lookup index only, deliberately NOT unique. A unique index here breaks Undo and bulk add.
create index items_open_name on public.items (list_id, name_norm) where is_checked = false;

-- ── History ────────────────────────────────────────────────
create table public.purchase_history (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid unique,
  household_id   uuid not null references public.households(id) on delete cascade,
  name           text not null,
  category_key   text,
  quantity       numeric(10,2),
  unit           text,
  purchased_at   timestamptz not null default now(),
  purchased_by   text
);
create index on public.purchase_history (household_id, name, purchased_at desc);
create index on public.purchase_history (household_id, purchased_at desc);

-- ── updated_at ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch before update on public.items
for each row execute function public.touch_updated_at();

-- ── Realtime: notification only, never content ─────────────
create or replace function public.broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  key uuid;
begin
  rec := coalesce(new, old);
  select h.realtime_key into key
    from public.households h where h.id = rec.household_id;

  begin
    perform realtime.send(
      pg_catalog.jsonb_build_object('op', tg_op, 'table', tg_table_name),  -- no row payload
      'change',
      'hh:' || key::text,
      false
    );
  exception when others then
    raise warning 'broadcast failed: %', sqlerrm;   -- never fail the user's write
  end;
  return null;
end $$;

create trigger items_broadcast      after insert or update or delete on public.items
  for each row execute function public.broadcast_change();
create trigger categories_broadcast after insert or update or delete on public.categories
  for each row execute function public.broadcast_change();
create trigger lists_broadcast      after insert or update or delete on public.lists
  for each row execute function public.broadcast_change();

-- ── Default category reference ─────────────────────────────
-- `categories` requires a household_id, so the shipped defaults live here and
-- create_household() copies them. Rows are seeded in 0002_seed_catalog.sql.
create table public.default_categories (
  key       text primary key,
  name      text not null,
  emoji     text not null,
  color     text not null,
  position  int  not null
);

-- ── Household provisioning ─────────────────────────────────
-- 22 URL-safe characters (~88 bits). Built from gen_random_uuid(), which is core in
-- Postgres 13+, so the function does not depend on where pgcrypto happens to be installed.
create or replace function public.new_secret_slug()
returns text
language sql volatile
set search_path = ''
as $$
  select substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1, 22);
$$;

create or replace function public.create_household(p_name text default 'הבית שלנו')
returns table (id uuid, secret_slug text, realtime_key uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  hh public.households;
begin
  insert into public.households (name, secret_slug)
  values (coalesce(nullif(btrim(p_name), ''), 'הבית שלנו'), public.new_secret_slug())
  returning * into hh;

  insert into public.categories (household_id, key, name, emoji, color, position)
  select hh.id, d.key, d.name, d.emoji, d.color, d.position
  from public.default_categories d;

  insert into public.lists (household_id, name, emoji, position) values
    (hh.id, 'סופר',  '🛒', 0),
    (hh.id, 'פארם',  '💊', 1),
    (hh.id, 'כלבו',  '🏠', 2);

  return query select hh.id, hh.secret_slug, hh.realtime_key;
end $$;

-- Rotates the join link: new slug, bumped generation, new realtime channel.
-- Old devices lose both data access and the realtime stream at once.
create or replace function public.rotate_household_secrets(p_household_id uuid)
returns table (secret_slug text, cookie_generation int, realtime_key uuid)
language sql volatile
security definer
set search_path = ''
as $$
  update public.households
     set secret_slug       = public.new_secret_slug(),
         cookie_generation = cookie_generation + 1,
         realtime_key      = gen_random_uuid()
   where id = p_household_id
  returning secret_slug, cookie_generation, realtime_key;
$$;

-- ── RLS: closes the database to the browser ────────────────
alter table public.households        enable row level security;
alter table public.categories        enable row level security;
alter table public.lists             enable row level security;
alter table public.catalog_items     enable row level security;
alter table public.items             enable row level security;
alter table public.purchase_history  enable row level security;
alter table public.default_categories enable row level security;
-- Zero policies on purpose: anon and authenticated can do nothing. Only service_role bypasses.
