-- Idempotency keys for safely retrying mutating operations (e.g. booking/payment create).
-- Store the outcome of a completed operation keyed by (scope, idempotency_key) so
-- duplicate requests can return the same result instead of creating duplicates.

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  idempotency_key text not null,
  operation text not null,
  request_hash text not null,
  status text not null default 'in_progress',
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  locked_at timestamptz not null default now(),
  constraint idempotency_keys_scope_key unique (scope, idempotency_key),
  constraint idempotency_keys_status_check
    check (status in ('in_progress', 'completed', 'failed'))
);

create index if not exists idempotency_keys_expires_at_idx
  on public.idempotency_keys (expires_at);

create index if not exists idempotency_keys_scope_operation_idx
  on public.idempotency_keys (scope, operation, created_at desc);

drop trigger if exists idempotency_keys_set_updated_at on public.idempotency_keys;
create trigger idempotency_keys_set_updated_at
before update on public.idempotency_keys
for each row execute function public.set_updated_at();

-- Defense-in-depth: trusted server-side DB access enforces authorization in the API.
alter table public.idempotency_keys enable row level security;
