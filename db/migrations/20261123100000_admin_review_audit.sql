alter table public.properties
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists properties_reviewed_by_idx on public.properties (reviewed_by);
