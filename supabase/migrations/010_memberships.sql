-- Slice roles en DB (usuario | moderador | administrador).
-- Bootstrap del primer admin: UPDATE memberships SET role = 'administrador' WHERE user_id = '<uuid>';

create table if not exists public.memberships (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null default 'usuario'
    check (role in ('usuario', 'moderador', 'administrador')),
  updated_at timestamptz not null default now()
);

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

insert into public.memberships (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role in ('moderador', 'administrador')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'administrador'
  );
$$;

-- Extender alta de usuario: perfil + afinidad + membership usuario.
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

  insert into public.memberships (user_id, role)
  values (new.id, 'usuario')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

alter table public.memberships enable row level security;

drop policy if exists memberships_select on public.memberships;
create policy memberships_select
  on public.memberships for select
  to authenticated
  using (auth.uid() = user_id or public.is_staff());

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin
  on public.memberships for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Sin insert/delete desde cliente: solo trigger / admin SQL.

-- Endurecer reportes / apelaciones
drop policy if exists reports_select_authenticated on public.reports;
create policy reports_select_authenticated
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id or public.is_staff());

drop policy if exists reports_update_review on public.reports;
create policy reports_update_review
  on public.reports for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists appeals_select_authenticated on public.appeals;
create policy appeals_select_authenticated
  on public.appeals for select
  to authenticated
  using (auth.uid() = appellant_id or public.is_staff());

drop policy if exists appeals_update_review on public.appeals;
create policy appeals_update_review
  on public.appeals for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Aprobar oportunidades / comunidades: solo staff (organizador no se auto-aprueba)
drop policy if exists opportunities_update_organizer_or_review on public.opportunities;
create policy opportunities_update_organizer_or_review
  on public.opportunities for update
  to authenticated
  using (auth.uid() = organizer_id or public.is_staff())
  with check (
    public.is_staff()
    or (auth.uid() = organizer_id and status = 'revision')
  );

drop policy if exists communities_update_organizer_or_review on public.communities;
create policy communities_update_organizer_or_review
  on public.communities for update
  to authenticated
  using (auth.uid() = organizer_id or public.is_staff())
  with check (
    public.is_staff()
    or (auth.uid() = organizer_id and status = 'revision')
  );
