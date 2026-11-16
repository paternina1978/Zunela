-- Slice suspensiones de usuario (profiles.suspended). Solo admin cambia el flag.

alter table public.profiles
  add column if not exists suspended boolean not null default false;

create index if not exists profiles_suspended_idx
  on public.profiles (suspended)
  where suspended = true;

-- Admin puede actualizar perfiles ajenos (p. ej. suspended).
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- El dueño no puede auto-reactivar ni auto-suspenderse.
create or replace function public.profiles_guard_suspended()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.suspended is distinct from old.suspended
     and not public.is_admin() then
    raise exception 'only admin can change suspended';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_suspended on public.profiles;
create trigger profiles_guard_suspended
  before update on public.profiles
  for each row execute function public.profiles_guard_suspended();
