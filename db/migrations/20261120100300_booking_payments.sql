-- Booking payments (Paystack) and webhook/idempotency support.
-- Additive migration: keeps existing booking flows working while enabling payment-aware flows.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'pending',
      'initialized',
      'paid',
      'failed',
      'cancelled',
      'abandoned'
    );
  end if;
end
$$;

alter table public.bookings
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists payment_reference text,
  add column if not exists payment_provider text,
  add column if not exists paid_at timestamptz;

create unique index if not exists bookings_payment_reference_key
  on public.bookings (payment_reference)
  where payment_reference is not null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  booking_reference text,
  provider text not null default 'paystack',
  reference text not null,
  amount integer not null check (amount >= 0),
  currency char(3) not null default 'NGN',
  status public.payment_status not null default 'initialized',
  channel text,
  authorization_url text,
  access_code text,
  customer_email text,
  metadata jsonb not null default '{}'::jsonb,
  initialized_at timestamptz,
  paid_at timestamptz,
  raw_initialize jsonb not null default '{}'::jsonb,
  raw_verify jsonb not null default '{}'::jsonb,
  last_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_reference_key unique (provider, reference),
  constraint payments_provider_check check (provider in ('paystack')),
  constraint payments_amount_currency_check check (char_length(currency) = 3)
);

create index if not exists payments_booking_id_idx on public.payments (booking_id);
create index if not exists payments_booking_reference_idx on public.payments (booking_reference);
create index if not exists payments_status_idx on public.payments (status, created_at desc);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_key text not null,
  event_type text,
  reference text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payment_webhook_events_provider_key unique (provider, event_key),
  constraint payment_webhook_events_provider_check check (provider in ('paystack'))
);

create index if not exists payment_webhook_events_reference_idx
  on public.payment_webhook_events (provider, reference, created_at desc);

alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
