-- ZUNELA slice 1: identidad compartida (profiles + affinities)
-- Aplicar en el proyecto Supabase del piloto. RLS fail-closed por defecto.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  visible_name text not null default '',
  legal_name text not null default '',
  country text not null default 'Colombia',
  city text not null default '',
  profession text not null default '',
  knowledge text[] not null default '{}',
  presentation text not null default '',
  photo_url text,
  visibility jsonb not null default '{
    "photo":"after-match",
    "profession":"after-match",
    "city":"public",
    "country":"public",
    "knowledge":"after-match",
    "presentation":"after-match"
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affinities (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  offers text[] not null default '{}',
  modality text not null default 'ambas'
    check (modality in ('presencial', 'remota', 'ambas')),
  reach text not null default 'ciudad'
    check (reach in ('ciudad', 'departamento', 'nacional', 'remoto')),
  availability text[] not null default '{"Horario flexible"}',
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists affinities_set_updated_at on public.affinities;
create trigger affinities_set_updated_at
  before update on public.affinities
  for each row execute function public.set_updated_at();

-- Perfil + afinidad vacíos al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, visible_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'visible_name', '')
  )
  on conflict (id) do nothing;

  insert into public.affinities (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.affinities enable row level security;

-- profiles: dueño todo; ajenos solo lectura de filas (filtrar campos en app según visibility)
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- affinities: solo dueño en este slice
drop policy if exists affinities_select_own on public.affinities;
create policy affinities_select_own
  on public.affinities for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists affinities_insert_own on public.affinities;
create policy affinities_insert_own
  on public.affinities for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists affinities_update_own on public.affinities;
create policy affinities_update_own
  on public.affinities for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists affinities_delete_own on public.affinities;
create policy affinities_delete_own
  on public.affinities for delete
  to authenticated
  using (auth.uid() = user_id);
