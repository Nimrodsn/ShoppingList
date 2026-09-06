-- Local development convenience only. Run with `pnpm seed`.
-- The shipped defaults are numbered migrations, because `supabase db push`
-- does not execute this file against a remote project.

-- Creates one household with the 17 categories and three default lists,
-- then prints the join link path.
do $$
declare
  created record;
begin
  if exists (select 1 from public.households) then
    raise notice 'A household already exists, skipping.';
    return;
  end if;

  select * into created from public.create_household('הבית שלנו');
  raise notice 'Household % created. Join link: /j/%', created.id, created.secret_slug;
end $$;

select h.id, h.secret_slug, h.cookie_generation, h.realtime_key
from public.households h
order by h.created_at
limit 1;
