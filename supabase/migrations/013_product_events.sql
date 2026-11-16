-- Slice eventos de producto (sin cuerpo de chat ni contacto).

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists product_events_created_idx
  on public.product_events (created_at desc);

create index if not exists product_events_user_created_idx
  on public.product_events (user_id, created_at desc);

alter table public.product_events enable row level security;

-- Cualquier autenticado registra su propia actividad.
drop policy if exists product_events_insert_own on public.product_events;
create policy product_events_insert_own
  on public.product_events for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Solo staff lee el feed agregado (piloto / admin).
drop policy if exists product_events_select_staff on public.product_events;
create policy product_events_select_staff
  on public.product_events for select
  to authenticated
  using (public.is_staff());

-- Bloquear contacto en el texto (misma regla que notifications).
create or replace function public.product_events_reject_contact()
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

drop trigger if exists product_events_reject_contact on public.product_events;
create trigger product_events_reject_contact
  before insert on public.product_events
  for each row execute function public.product_events_reject_contact();
