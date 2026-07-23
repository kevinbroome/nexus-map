create table if not exists public.nexus_schema_metadata (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.nexus_schema_metadata enable row level security;
