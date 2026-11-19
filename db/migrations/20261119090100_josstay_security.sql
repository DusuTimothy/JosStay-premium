-- JosStay Premium — security posture for Aiven PostgreSQL
--
-- The Express API is the only data access path and uses a trusted server-side
-- database connection. Object-level authorization is enforced in the API.
-- This migration enables RLS on all tables as defense-in-depth. No public
-- anon/authenticated policies are created because this is not a Supabase
-- PostgREST deployment. Ensure the API database user has the required
-- privileges to read/write application tables.

alter table public.profiles enable row level security;
alter table public.hosts enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.rooms enable row level security;
alter table public.amenities enable row level security;
alter table public.property_amenities enable row level security;
alter table public.property_reviews enable row level security;
alter table public.bookings enable row level security;
alter table public.payouts enable row level security;

-- Optional hardening: if you connect with a dedicated non-owner app role and
-- want the database to bypass RLS for that role, run (as owner/superuser):
--   alter role <app_role> bypassrls;
-- Otherwise, add explicit policies/grants for that role. The default API
-- deployment expects a trusted server-side connection.