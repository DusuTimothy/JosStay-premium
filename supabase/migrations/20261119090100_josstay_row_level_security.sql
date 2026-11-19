-- JosStay Premium — row level security
--
-- Default deny: every table has RLS enabled. Only the public catalogue is
-- readable with the anon key. Profiles, hosts, bookings and payouts have no
-- client policies at all; they are reachable only through the Express API,
-- which holds the service-role key on the server.
--
-- If you later adopt Supabase Auth, add narrowly scoped policies for
-- `auth.uid()` instead of granting broad table access.

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

-- Public catalogue: published properties only.
create policy properties_public_read
on public.properties
for select
to anon, authenticated
using (is_published = true);

create policy property_images_public_read
on public.property_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_images.property_id
      and p.is_published = true
  )
);

create policy rooms_public_read
on public.rooms
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = rooms.property_id
      and p.is_published = true
  )
);

create policy amenities_public_read
on public.amenities
for select
to anon, authenticated
using (true);

create policy property_amenities_public_read
on public.property_amenities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_amenities.property_id
      and p.is_published = true
  )
);

create policy property_reviews_public_read
on public.property_reviews
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_reviews.property_id
      and p.is_published = true
  )
);

-- Sensitive tables: intentionally no policies.
-- profiles, hosts, bookings, payouts remain fully denied to anon/authenticated.
