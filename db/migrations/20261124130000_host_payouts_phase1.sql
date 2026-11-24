-- Host payouts — Phase 1
--
-- Ledger-first payouts: a paid booking creates a host earning, the host requests
-- a payout against available earnings, an admin reviews it, and settlement is
-- recorded manually. No automated Paystack transfers in this phase.

-- ---------------------------------------------------------------------------
-- Host bank accounts
-- ---------------------------------------------------------------------------

create table if not exists public.host_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_number_masked text not null,
  account_name text not null,
  provider text not null default 'paystack',
  recipient_code text,
  status text not null default 'verified'
    check (status in ('pending', 'verified', 'disabled')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint host_bank_accounts_bank_code_length
    check (char_length(bank_code) between 1 and 12),
  constraint host_bank_accounts_masked_length
    check (char_length(account_number_masked) between 4 and 24),
  constraint host_bank_accounts_account_name_length
    check (char_length(account_name) between 1 and 160)
);

create unique index if not exists host_bank_accounts_active_key
  on public.host_bank_accounts (host_id) where status <> 'disabled';

create index if not exists host_bank_accounts_host_idx
  on public.host_bank_accounts (host_id, created_at desc);

drop trigger if exists host_bank_accounts_set_updated_at on public.host_bank_accounts;
create trigger host_bank_accounts_set_updated_at
before update on public.host_bank_accounts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payout requests
-- ---------------------------------------------------------------------------

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  reference text not null unique,
  amount integer not null check (amount > 0),
  currency char(3) not null default 'NGN',
  bank_account_id uuid references public.host_bank_accounts (id) on delete set null,
  bank_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in (
      'pending_review', 'approved', 'processing', 'paid',
      'rejected', 'cancelled', 'failed'
    )),
  host_note text,
  review_note text,
  settlement_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  settled_by uuid references public.profiles (id) on delete set null,
  settled_at timestamptz,
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_requests_reference_format
    check (reference ~ '^JS-PO-[A-Z0-9]{6,12}$'),
  constraint payout_requests_host_note_length
    check (host_note is null or char_length(host_note) <= 500),
  constraint payout_requests_review_note_length
    check (review_note is null or char_length(review_note) <= 500)
);

create index if not exists payout_requests_host_idx
  on public.payout_requests (host_id, created_at desc);
create index if not exists payout_requests_status_idx
  on public.payout_requests (status, created_at);

-- One open request per host at a time.
create unique index if not exists payout_requests_one_open_key
  on public.payout_requests (host_id)
  where status in ('pending_review', 'approved', 'processing');

drop trigger if exists payout_requests_set_updated_at on public.payout_requests;
create trigger payout_requests_set_updated_at
before update on public.payout_requests
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Host earnings ledger
-- ---------------------------------------------------------------------------

create table if not exists public.host_earnings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  booking_reference text not null,
  gross integer not null check (gross >= 0),
  commission integer not null check (commission >= 0),
  net integer not null check (net = gross - commission),
  currency char(3) not null default 'NGN',
  status text not null default 'pending'
    check (status in ('pending', 'available', 'reserved', 'paid', 'reversed')),
  available_at timestamptz,
  reserved_amount integer not null default 0 check (reserved_amount >= 0),
  paid_amount integer not null default 0 check (paid_amount >= 0),
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint host_earnings_booking_key unique (booking_id),
  constraint host_earnings_reserved_within_net check (reserved_amount <= net),
  constraint host_earnings_paid_within_net check (paid_amount <= net),
  constraint host_earnings_allocations_within_net
    check (reserved_amount + paid_amount <= net)
);

create index if not exists host_earnings_host_status_idx
  on public.host_earnings (host_id, status, available_at);
create index if not exists host_earnings_booking_idx
  on public.host_earnings (booking_id);

drop trigger if exists host_earnings_set_updated_at on public.host_earnings;
create trigger host_earnings_set_updated_at
before update on public.host_earnings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Which earnings fund which request (supports partial withdrawals)
-- ---------------------------------------------------------------------------

create table if not exists public.payout_request_earnings (
  request_id uuid not null references public.payout_requests (id) on delete cascade,
  earning_id uuid not null references public.host_earnings (id) on delete restrict,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (request_id, earning_id)
);

create index if not exists payout_request_earnings_earning_idx
  on public.payout_request_earnings (earning_id);

-- ---------------------------------------------------------------------------
-- Settlement record link
-- ---------------------------------------------------------------------------

alter table public.payouts
  add column if not exists payout_request_id uuid
    references public.payout_requests (id) on delete set null;

create unique index if not exists payouts_payout_request_key
  on public.payouts (payout_request_id)
  where payout_request_id is not null;
