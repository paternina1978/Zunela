-- Slice avisos / notificaciones (sin correo ni teléfono en el texto).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('match', 'mensaje', 'comunidad', 'cuenta')),
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 140),
  source text not null default '',
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create unique index if not exists notifications_user_source_uidx
  on public.notifications (user_id, source)
  where source <> '';

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists notifications_insert_own on public.notifications;
create policy notifications_insert_own
  on public.notifications for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- Avisar a otro usuario (p. ej. interés recibido). Sin contacto en body.
create or replace function public.notify_user(
  p_user_id uuid,
  p_kind text,
  p_body text,
  p_source text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := trim(p_body);
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'invalid recipient';
  end if;
  if p_kind not in ('match', 'mensaje', 'comunidad', 'cuenta') then
    raise exception 'invalid kind';
  end if;
  if cleaned is null or char_length(cleaned) = 0 or char_length(cleaned) > 140 then
    raise exception 'invalid body';
  end if;
  if cleaned ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' or cleaned ~ '(?:\d[\s.-]?){7,}' then
    raise exception 'contact not allowed';
  end if;

  if coalesce(p_source, '') <> '' then
    select id into new_id
    from public.notifications
    where user_id = p_user_id and source = p_source
    limit 1;
    if new_id is not null then
      return new_id;
    end if;
  end if;

  insert into public.notifications (user_id, kind, body, source)
  values (p_user_id, p_kind, cleaned, coalesce(p_source, ''))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.notify_user(uuid, text, text, text) from public;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;
