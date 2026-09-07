-- ── Table privileges for the service role ──────────────────
-- Supabase grants these when a project is created. `drop schema public cascade`,
-- which the reset prelude of `pnpm db:bundle --reset` runs, takes them with it, and
-- recreating the schema restores nothing but the schema itself. Every PostgREST call
-- then fails with "permission denied for table households" even with a valid
-- service_role key, because the tables belong to postgres and grant nothing.
--
-- Only postgres and service_role are listed. The browser never issues `.from()`, so
-- anon and authenticated need no table privileges at all — RLS with zero policies is
-- the second lock, not the only one.

grant usage on schema public to postgres, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;

-- Future migrations create tables as postgres; without this every one of them would
-- need its own grant.
alter default privileges for role postgres in schema public
  grant all on tables to postgres, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to postgres, service_role;
