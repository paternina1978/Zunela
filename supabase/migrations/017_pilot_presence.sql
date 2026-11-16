-- Slice presencia piloto (retención D7/D30). Sin PII de chat.

create table if not exists public.pilot_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint pilot_presence_order check (last_seen_at >= first_seen_at)
);

create index if not exists pilot_presence_last_seen_idx
  on public.pilot_presence (last_seen_at desc);

alter table public.pilot_presence enable row level security;

drop policy if exists pilot_presence_select_own_or_staff on public.pilot_presence;
create policy pilot_presence_select_own_or_staff
  on public.pilot_presence for select
  to authenticated
  using (auth.uid() = user_id or public.is_staff());

drop policy if exists pilot_presence_insert_own on public.pilot_presence;
create policy pilot_presence_insert_own
  on public.pilot_presence for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists pilot_presence_update_own on public.pilot_presence;
create policy pilot_presence_update_own
  on public.pilot_presence for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Marca visita: no pisa first_seen_at en visitas posteriores.
create or replace function public.touch_pilot_presence()
returns public.pilot_presence
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.pilot_presence;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.pilot_presence (user_id, first_seen_at, last_seen_at)
  values (uid, now(), now())
  on conflict (user_id) do update
    set last_seen_at = now()
  returning * into row;

  return row;
end;
$$;

revoke all on function public.touch_pilot_presence() from public;
grant execute on function public.touch_pilot_presence() to authenticated;
