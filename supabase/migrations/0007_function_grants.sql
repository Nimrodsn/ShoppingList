-- Locks every function to the service role.
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and no migration
-- before this one revoked it. Anyone holding the public anon key could therefore call
-- the SECURITY DEFINER RPCs directly — including rotate_household_secrets, which only
-- needs a household UUID — bypassing the signed-cookie boundary the Server Actions
-- enforce. RLS was a second lock for tables; functions needed their own.
--
-- The browser never calls RPCs directly (all data access goes through Server Actions
-- with the service role key), so nothing user-facing changes.

revoke all on all functions in schema public from PUBLIC, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Functions created by future migrations get the same shape without remembering
-- this file. 0006 already granted tables/sequences/functions to service_role; the
-- revoke half was missing for functions.
alter default privileges for role postgres in schema public
  revoke all on functions from PUBLIC;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
