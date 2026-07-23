-- Cloud world storage for authenticated users.

create table if not exists public.worlds (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  world_data jsonb not null,
  world_version integer not null,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worlds_user_id_updated_at_idx
  on public.worlds (user_id, updated_at desc);

alter table public.worlds enable row level security;

create policy "Users can read own worlds"
  on public.worlds
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own worlds"
  on public.worlds
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own worlds"
  on public.worlds
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own worlds"
  on public.worlds
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_worlds_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists worlds_set_updated_at on public.worlds;

create trigger worlds_set_updated_at
before update on public.worlds
for each row
execute function public.set_worlds_updated_at();
