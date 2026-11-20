-- Refresh tokens for cookie-based session refresh / rotation.
-- Store only a hash of the refresh token; raw token is returned to the client once.

create table if not exists public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_token_hash text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  user_agent text,
  ip_address text,
  constraint refresh_tokens_hash_length check (char_length(token_hash) between 32 and 128)
);

create index if not exists refresh_tokens_user_idx
  on public.refresh_tokens (user_id, created_at desc);

create index if not exists refresh_tokens_expires_idx
  on public.refresh_tokens (expires_at);

create index if not exists refresh_tokens_active_lookup_idx
  on public.refresh_tokens (token_hash)
  where revoked_at is null;

-- Defense-in-depth: trusted server-side DB access enforces authorization in the API.
alter table public.refresh_tokens enable row level security;