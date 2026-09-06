-- "Maybe you forgot?" — products this household buys on a rhythm, where more time
-- has passed than usual. Needs at least two intervals before it says anything, so a
-- one-off purchase never turns into a nag.
create or replace function public.suggest_forgotten(
  p_household_id uuid,
  p_limit        int default 5
)
returns table (
  name         text,
  category_key text,
  avg_days     numeric,
  days_since   numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with gaps as (
    select
      public.normalize_he(h.name) as norm,
      h.name,
      h.category_key,
      h.purchased_at,
      lag(h.purchased_at) over (
        partition by public.normalize_he(h.name)
        order by h.purchased_at
      ) as previous_at
    from public.purchase_history h
    where h.household_id = p_household_id
      and h.purchased_at > now() - interval '180 days'
  ),
  stats as (
    select
      min(g.name)         as name,
      min(g.category_key) as category_key,
      count(g.previous_at) as interval_count,
      avg(extract(epoch from (g.purchased_at - g.previous_at)) / 86400) as avg_days,
      max(g.purchased_at) as last_at
    from gaps g
    group by g.norm
  )
  select
    s.name,
    s.category_key,
    round(s.avg_days::numeric, 1),
    round((extract(epoch from (now() - s.last_at)) / 86400)::numeric, 1)
  from stats s
  where s.interval_count >= 2
    and s.avg_days between 1 and 60
    -- 20% past the usual gap, so normal variation stays quiet
    and extract(epoch from (now() - s.last_at)) / 86400 > s.avg_days * 1.2
  order by (extract(epoch from (now() - s.last_at)) / 86400) / s.avg_days desc
  limit p_limit;
$$;
