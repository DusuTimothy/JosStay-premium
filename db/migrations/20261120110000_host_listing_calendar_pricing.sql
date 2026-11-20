-- Host listing management: verification workflow, availability blocks, and pricing controls.
-- Safe to run multiple times where practical.

-- ---------------------------------------------------------------------------
-- Listing verification / publication workflow
-- ---------------------------------------------------------------------------

alter table public.properties
  add column if not exists verification_status text not null default 'draft',
  add column if not exists submitted_for_verification_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_notes text,
  add column if not exists weekend_price integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_verification_status_check'
  ) then
    alter table public.properties
      add constraint properties_verification_status_check
      check (verification_status in ('draft', 'pending_review', 'verified', 'rejected', 'suspended'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_weekend_price_check'
  ) then
    alter table public.properties
      add constraint properties_weekend_price_check
      check (weekend_price is null or weekend_price >= 0);
  end if;
end
$$;

-- Backfill: published/verified listings should reflect verified status.
update public.properties
set verification_status = case
      when verified then 'verified'
      when is_published then 'verified'
      else verification_status
    end,
    verified_at = case when verified and verified_at is null then coalesce(updated_at, now()) else verified_at end,
    weekend_price = coalesce(weekend_price, price)
where verification_status = 'draft';

-- Ensure weekend_price has a sensible value for existing rows.
update public.properties
set weekend_price = price
where weekend_price is null;

-- Verification/document submissions (metadata only; file storage handled by app/Cloudinary).
create table if not exists public.host_verification_documents (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  document_type text not null,
  file_name text,
  file_url text,
  mime_type text,
  status text not null default 'submitted',
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint host_verification_documents_type_check
    check (document_type in ('government_id', 'proof_of_ownership', 'property_photo', 'other')),
  constraint host_verification_documents_status_check
    check (status in ('submitted', 'pending_review', 'approved', 'rejected'))
);

create index if not exists host_verification_documents_host_idx
  on public.host_verification_documents (host_id, submitted_at desc);
create index if not exists host_verification_documents_property_idx
  on public.host_verification_documents (property_id, submitted_at desc);

drop trigger if exists host_verification_documents_set_updated_at on public.host_verification_documents;
create trigger host_verification_documents_set_updated_at
before update on public.host_verification_documents
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Availability blocks (host-managed calendar blocks)
-- ---------------------------------------------------------------------------

create table if not exists public.property_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_availability_blocks_date_order check (end_date > start_date),
  constraint property_availability_blocks_reason_length check (reason is null or char_length(reason) <= 240)
);

create index if not exists property_availability_blocks_property_dates_idx
  on public.property_availability_blocks (property_id, start_date, end_date);
create index if not exists property_availability_blocks_room_dates_idx
  on public.property_availability_blocks (room_id, start_date, end_date);

drop trigger if exists property_availability_blocks_set_updated_at on public.property_availability_blocks;
create trigger property_availability_blocks_set_updated_at
before update on public.property_availability_blocks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Per-room weekend/base pricing overrides (optional; property-level defaults remain)
-- ---------------------------------------------------------------------------

alter table public.rooms
  add column if not exists weekend_price integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rooms_weekend_price_check'
  ) then
    alter table public.rooms
      add constraint rooms_weekend_price_check
      check (weekend_price is null or weekend_price >= 0);
  end if;
end
$$;

update public.rooms
set weekend_price = price
where weekend_price is null;
