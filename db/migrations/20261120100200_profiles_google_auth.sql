-- Allow OAuth-based accounts (e.g. Google) without a local password.
-- password_hash becomes nullable; existing bcrypt format check still permits NULL in PostgreSQL.

alter table public.profiles
  alter column password_hash drop not null;

alter table public.profiles
  add column if not exists google_sub text;

create unique index if not exists profiles_google_sub_key
  on public.profiles (google_sub)
  where google_sub is not null;