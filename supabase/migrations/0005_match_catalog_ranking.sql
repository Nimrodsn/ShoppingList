-- Fixes the ordering of `match_catalog`. `distinct on (name_norm)` forces the inner
-- query to sort by name_norm, so both the order and the `limit` were alphabetical:
-- a query like "ח" returned the first eight names, not the eight best matches.
-- The dedupe now happens in a CTE and the ranking is applied after it.
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
  with q as (select normalize_he(p_query) as norm),
  scored as (
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
  ),
  best as (
    select distinct on (scored.name_norm) scored.*
    from scored
    where scored.score > 0
    order by
      scored.name_norm,
      -- a household's own row wins over the shared global row with the same name
      scored.household_id nulls last,
      scored.score desc,
      scored.use_count desc,
      scored.last_used_at desc nulls last
  )
  select
    best.id, best.name, best.category_key, best.default_unit,
    best.emoji, best.is_staple, best.score
  from best
  order by best.score desc, best.use_count desc, best.last_used_at desc nulls last
  limit p_limit;
$$;
