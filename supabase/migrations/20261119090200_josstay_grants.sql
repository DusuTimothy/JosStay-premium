-- JosStay Premium — least-privilege grants
--
-- RLS filters rows, but table privileges are the first line of defence.
-- Client roles get SELECT on the public catalogue only. Every write and every
-- sensitive table is reachable solely through the server-side service role.

revoke all on all tables in schema public from public;
revoke all on all tables in schema public from anon, authenticated;

revoke all on all sequences in schema public from public;
revoke all on all sequences in schema public from anon, authenticated;

revoke all on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
revoke create on schema public from anon, authenticated;

grant select on public.properties to anon, authenticated;
grant select on public.property_images to anon, authenticated;
grant select on public.rooms to anon, authenticated;
grant select on public.amenities to anon, authenticated;
grant select on public.property_amenities to anon, authenticated;
grant select on public.property_reviews to anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Keep the same posture for objects created by future migrations.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
