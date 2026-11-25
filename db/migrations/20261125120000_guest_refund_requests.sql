-- Guest refund requests
--
-- Guests can ask for a refund from My bookings. Admin reviews each request and
-- records the manual Paystack refund reference. The app never calls Paystack's
-- refund API.

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  booking_reference text not null,
  user_id uuid references public.profiles (id) on delete set null,
  payment_reference text,
  stay_amount integer not null check (stay_amount >= 0),
  payment_fee integer not null default 0 check (payment_fee >= 0),
  amount integer not null check (amount > 0),
  currency char(3) not null default 'NGN',
  reason text not null,
  details text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'refunded', 'rejected', 'cancelled')),
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  refunded_by uuid references public.profiles (id) on delete set null,
  refunded_at timestamptz,
  refund_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_requests_reference_format
    check (reference ~ '^JS-RF-[A-Z0-9]{6,12}$'),
  constraint refund_requests_amount_breakdown
    check (amount = stay_amount + payment_fee),
  constraint refund_requests_reason_length
    check (char_length(reason) between 1 and 80),
  constraint refund_requests_details_length
    check (details is null or char_length(details) <= 1000),
  constraint refund_requests_admin_note_length
    check (admin_note is null or char_length(admin_note) <= 1000),
  constraint refund_requests_refund_reference_length
    check (refund_reference is null or char_length(refund_reference) between 1 and 120)
);

create index if not exists refund_requests_booking_idx
  on public.refund_requests (booking_id, created_at desc);
create index if not exists refund_requests_status_idx
  on public.refund_requests (status, created_at);
create index if not exists refund_requests_user_idx
  on public.refund_requests (user_id, created_at desc);

-- Only one open request per booking at a time.
create unique index if not exists refund_requests_one_open_key
  on public.refund_requests (booking_id)
  where status in ('pending_review', 'approved');

drop trigger if exists refund_requests_set_updated_at on public.refund_requests;
create trigger refund_requests_set_updated_at
before update on public.refund_requests
for each row execute function public.set_updated_at();
