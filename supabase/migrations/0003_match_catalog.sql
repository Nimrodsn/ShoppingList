-- Autocomplete engine. Scoring per the product spec:
--   prefix match on name_norm      -> 100
--   exact match on an alias        ->  80
--   trigram similarity >= 0.35     ->  60 * similarity
-- Ties break on use_count, then last_used_at.
-- search_path is fixed (not mutable) but includes `extensions`, because that is where
-- Supabase installs pg_trgm. On a plain Postgres, pg_trgm lands in `public` instead.
create or replace function public.match_catalog(
  p_household_id uuid,
  p_query        text,
  p_limit        int default 8
)
returns table (
  id           uuid,
  name         text,
  category_key text,
  default_unit text,
  emoji        text,
  is_staple    boolean,
  score        real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (select normalize_he(p_query) as norm)
  select distinct on (ranked.name_norm)
    ranked.id, ranked.name, ranked.category_key, ranked.default_unit,
    ranked.emoji, ranked.is_staple, ranked.score
  from (
    select
      c.id, c.name, c.name_norm, c.category_key, c.default_unit, c.emoji,
      c.is_staple, c.household_id, c.use_count, c.last_used_at,
      greatest(
        case when c.name_norm like (select norm from q) || '%' then 100.0 else 0.0 end,
        case when (select norm from q) = any(coalesce(c.aliases_norm, '{}')) then 80.0 else 0.0 end,
        case when similarity(c.name_norm, (select norm from q)) >= 0.35
             then 60.0 * similarity(c.name_norm, (select norm from q))
             else 0.0 end
      )::real as score
    from public.catalog_items c
    where (c.household_id is null or c.household_id = p_household_id)
      and (select norm from q) <> ''
  ) ranked
  where ranked.score > 0
  order by
    ranked.name_norm,
    -- a household's own row wins over the shared global row with the same name
    ranked.household_id nulls last,
    ranked.score desc,
    ranked.use_count desc,
    ranked.last_used_at desc nulls last
  limit p_limit;
$$;

-- Records that a product was actually bought, which drives autocomplete ranking
-- and the "maybe you forgot?" suggestions.
create or replace function public.bump_catalog_usage(
  p_household_id uuid,
  p_names        text[]
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.catalog_items c
     set use_count    = c.use_count + 1,
         last_used_at = now()
   where (c.household_id is null or c.household_id = p_household_id)
     and c.name_norm = any (
       select public.normalize_he(n) from unnest(p_names) n
     );
$$;
