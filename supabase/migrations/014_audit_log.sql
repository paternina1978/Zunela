-- Slice bitácora de panel + bootstrap del primer admin (una sola vez).

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_insert_staff on public.audit_log;
create policy audit_log_insert_staff
  on public.audit_log for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists audit_log_select_staff on public.audit_log;
create policy audit_log_select_staff
  on public.audit_log for select
  to authenticated
  using (public.is_staff());

create or replace function public.audit_log_reject_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.body ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
     or new.body ~ '(?:\d[\s.-]?){7,}' then
    raise exception 'contact not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists audit_log_reject_contact on public.audit_log;
create trigger audit_log_reject_contact
  before insert on public.audit_log
  for each row execute function public.audit_log_reject_contact();

-- ¿Ya hay administrador? (para UI de bootstrap).
create or replace function public.admin_exists()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.role = 'administrador'
  );
$$;

revoke all on function public.admin_exists() from public;
grant execute on function public.admin_exists() to authenticated;

-- Primer admin: solo si no existe ninguno. Sin auto-elevación después.
create or replace function public.bootstrap_first_admin()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (
    select 1 from public.memberships m
    where m.role = 'administrador'
  ) then
    raise exception 'admin already exists';
  end if;

  insert into public.memberships (user_id, role)
  values (uid, 'administrador')
  on conflict (user_id) do update
    set role = 'administrador', updated_at = now();

  return 'administrador';
end;
$$;

revoke all on function public.bootstrap_first_admin() from public;
grant execute on function public.bootstrap_first_admin() to authenticated;
