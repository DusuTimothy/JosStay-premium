-- Email verification and password reset.
--
-- Tokens are single-use, short-lived, and stored only as SHA-256 hashes.
-- Raw tokens are delivered by email and never persisted in the database.

alter table public.profiles
  add column if not exists email_verified boolean not null default false;

alter table public.profiles
  add column if not exists email_verified_at timestamptz;

alter table public.profiles
  add column if not exists password_updated_at timestamptz;

-- One-time grandfather for accounts that existed before email verification was
-- introduced. This prevents locking out existing admins/hosts. New accounts
-- created after this migration start unverified (password sign-up) or verified
-- (Google sign-in / admin-created accounts).
update public.profiles
   set email_verified = true,
       email_verified_at = coalesce(email_verified_at, created_at)
 where email_verified = false;

create table if not exists public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  requested_ip text,
  user_agent text,
  constraint auth_tokens_purpose_check
    check (purpose in ('email_verification', 'password_reset')),
  constraint auth_tokens_hash_length
    check (char_length(token_hash) between 32 and 128)
);

create index if not exists auth_tokens_user_purpose_idx
  on public.auth_tokens (user_id, purpose, created_at desc);

create index if not exists auth_tokens_active_lookup_idx
  on public.auth_tokens (token_hash)
  where used_at is null;

create index if not exists auth_tokens_expires_idx
  on public.auth_tokens (expires_at);

-- Defense-in-depth: trusted server-side DB access enforces authorization in the API.
alter table public.auth_tokens enable row level security;
