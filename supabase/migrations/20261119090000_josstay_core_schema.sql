-- JosStay Premium — core schema
-- Apply with Supabase CLI (`supabase db push`) or paste into the SQL editor.
--
-- Security model:
--   * All IDs are UUIDs except the public amenity catalogue.
--   * Booking totals/quotes are always written by the API, never trusted from clients.
--   * The API uses the service-role key server-side only; RLS still denies anon access.
--   * A GiST exclusion constraint prevents double-booking a room.

create schema if not exists extensions;

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "btree_gist" with schema extensions;

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('guest', 'host', 'admin');
create type public.booking_status as enum (
  'upcoming',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);
create type public.payment_method as enum ('card', 'bank', 'ussd');
create type public.payout_status as enum ('scheduled', 'paid', 'on_hold', 'failed');

-- ---------------------------------------------------------------------------
-- Shared helper functions
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.generate_booking_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'JS-';
begin
  for i in 1..6 loop
    result := result || pg_catalog.substr(
      alphabet,
      1 + pg_catalog.floor(pg_catalog.random() * pg_catalog.length(alphabet))::int,
      1
    );
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  role public.user_role not null default 'guest',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint profiles_password_hash_format
    check (password_hash ~ '^\$2[aby]\$'),
  constraint profiles_full_name_length
    check (pg_catalog.char_length(full_name) between 1 and 120)
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  seed_key text unique,
  name text not null,
  joined_year integer not null default extract(year from now())::integer,
  superhost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hosts_name_length check (pg_catalog.char_length(name) between 1 and 120),
  constraint hosts_joined_year check (joined_year between 2000 and 2100)
);

create unique index hosts_user_id_key on public.hosts (user_id) where user_id is not null;

create trigger hosts_set_updated_at
before update on public.hosts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  host_id uuid not null references public.hosts (id) on delete restrict,
  slug text not null unique,
  name text not null,
  type text not null,
  area text not null,
  address text not null,
  price integer not null check (price >= 0),
  cleaning_fee integer not null default 0 check (cleaning_fee >= 0),
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  verified boolean not null default false,
  free_cancellation boolean not null default false,
  distance_km numeric(5, 1) not null default 0 check (distance_km >= 0),
  badge text,
  max_guests integer not null default 1 check (max_guests between 1 and 50),
  summary text not null,
  description text not null,
  house_rules text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint properties_type_check
    check (type in ('hotel', 'apartment', 'airbnb', 'shortlet', 'guesthouse')),
  constraint properties_name_length check (pg_catalog.char_length(name) between 1 and 160),
  constraint properties_summary_length check (pg_catalog.char_length(summary) between 1 and 400),
  constraint properties_description_length
    check (pg_catalog.char_length(description) between 1 and 6000)
);

create index properties_published_idx on public.properties (is_published);
create index properties_area_idx on public.properties (area) where is_published;
create index properties_type_idx on public.properties (type) where is_published;
create index properties_price_idx on public.properties (price) where is_published;
create index properties_rating_idx on public.properties (rating desc) where is_published;

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  url text not null,
  alt text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint property_images_url_https check (url ~ '^https://'),
  constraint property_images_property_position_key unique (property_id, position)
);

create index property_images_property_idx on public.property_images (property_id, position);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  code text not null,
  name text not null,
  price integer not null check (price >= 0),
  capacity integer not null check (capacity between 1 and 50),
  beds text not null,
  size text not null,
  refundable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_property_code_key unique (property_id, code),
  constraint rooms_code_format check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index rooms_property_idx on public.rooms (property_id);

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create table public.amenities (
  id text primary key,
  label text not null,
  constraint amenities_id_format check (id ~ '^[a-zA-Z0-9]+$'),
  constraint amenities_label_length check (pg_catalog.char_length(label) between 1 and 80)
);

create table public.property_amenities (
  property_id uuid not null references public.properties (id) on delete cascade,
  amenity_id text not null references public.amenities (id) on delete restrict,
  primary key (property_id, amenity_id)
);

create index property_amenities_amenity_idx on public.property_amenities (amenity_id);

create table public.property_reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  guest_name text not null,
  reviewed_on date not null,
  rating integer not null check (rating between 1 and 5),
  quote text not null,
  created_at timestamptz not null default now(),
  constraint property_reviews_guest_name_length
    check (pg_catalog.char_length(guest_name) between 1 and 120),
  constraint property_reviews_quote_length
    check (pg_catalog.char_length(quote) between 1 and 1200)
);

create index property_reviews_property_idx
  on public.property_reviews (property_id, reviewed_on desc);

-- ---------------------------------------------------------------------------
-- Bookings and payouts
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.generate_booking_reference(),
  user_id uuid references public.profiles (id) on delete set null,
  property_id uuid not null references public.properties (id) on delete restrict,
  room_id uuid not null references public.rooms (id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guests integer not null check (guests between 1 and 50),
  airport_pickup boolean not null default false,
  payment_method public.payment_method not null default 'card',
  requests text,
  guest_first_name text not null,
  guest_last_name text not null,
  guest_email text not null,
  guest_phone text not null,
  status public.booking_status not null default 'upcoming',
  total integer not null check (total >= 0),
  currency char(3) not null default 'NGN',
  quote jsonb not null default '{}'::jsonb,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_date_order check (check_out > check_in),
  constraint bookings_reference_format check (reference ~ '^JS-[A-Z0-9]{6}$'),
  constraint bookings_requests_length
    check (requests is null or pg_catalog.char_length(requests) <= 1000),
  constraint bookings_guest_email_format
    check (guest_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint bookings_guest_name_length
    check (
      pg_catalog.char_length(guest_first_name) between 1 and 80
      and pg_catalog.char_length(guest_last_name) between 1 and 80
    ),
  constraint bookings_guest_phone_length
    check (pg_catalog.char_length(guest_phone) between 7 and 32)
);

create index bookings_user_idx on public.bookings (user_id, created_at desc);
create index bookings_property_idx on public.bookings (property_id, check_in);
create index bookings_room_idx on public.bookings (room_id, check_in);
create index bookings_status_idx on public.bookings (status);

-- A room cannot be booked twice for overlapping dates. btree_gist supplies the
-- equality operator for UUIDs inside a GiST exclusion constraint.
alter table public.bookings
  add constraint bookings_no_overlapping_room_stay
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('upcoming', 'confirmed'));

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  reference text not null unique,
  gross integer not null check (gross >= 0),
  commission integer not null check (commission >= 0),
  net integer not null check (net >= 0),
  status public.payout_status not null default 'scheduled',
  scheduled_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payouts_reference_format check (reference ~ '^[A-Z0-9-]{4,32}$'),
  constraint payouts_net_matches check (net = gross - commission)
);

create index payouts_host_idx on public.payouts (host_id, created_at desc);

create trigger payouts_set_updated_at
before update on public.payouts
for each row execute function public.set_updated_at();
