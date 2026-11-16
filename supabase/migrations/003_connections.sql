-- Slice conexiones (match) entre perfiles reales del piloto.

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_distinct_users check (from_user <> to_user),
  constraint connections_pair unique (from_user, to_user)
);

create index if not exists connections_to_user_status_idx
  on public.connections (to_user, status);

create index if not exists connections_from_user_status_idx
  on public.connections (from_user, status);

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

alter table public.connections enable row level security;

-- Participantes ven filas donde figuran
drop policy if exists connections_select_participants on public.connections;
create policy connections_select_participants
  on public.connections for select
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);

-- Solo el emisor crea la solicitud saliente
drop policy if exists connections_insert_own on public.connections;
create policy connections_insert_own
  on public.connections for insert
  to authenticated
  with check (auth.uid() = from_user);

-- Emisor o destinatario pueden actualizar (aceptar / rechazar / bloquear / retirar)
drop policy if exists connections_update_participants on public.connections;
create policy connections_update_participants
  on public.connections for update
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user)
  with check (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists connections_delete_participants on public.connections;
create policy connections_delete_participants
  on public.connections for delete
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);
