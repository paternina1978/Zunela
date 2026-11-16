-- Slice contacto externo bilateral (Premium).
-- Cada fila = un usuario autoriza compartir su contacto hacia otro.
-- Solo se revela al grantee cuando existe el consentimiento inverso.

create table if not exists public.contact_consents (
  id uuid primary key default gen_random_uuid(),
  granter_id uuid not null references public.profiles (id) on delete cascade,
  grantee_id uuid not null references public.profiles (id) on delete cascade,
  contact_email text not null default '',
  contact_phone text not null default '',
  created_at timestamptz not null default now(),
  constraint contact_consents_distinct check (granter_id <> grantee_id),
  constraint contact_consents_unique unique (granter_id, grantee_id)
);

create index if not exists contact_consents_grantee_idx
  on public.contact_consents (grantee_id, created_at desc);

create or replace function public.has_contact_grant(from_user uuid, to_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.contact_consents c
    where c.granter_id = from_user and c.grantee_id = to_user
  );
$$;

alter table public.contact_consents enable row level security;

-- Dueño ve lo que otorgó; la otra parte solo ve el contacto si ya hay bilateral.
drop policy if exists contact_consents_select on public.contact_consents;
create policy contact_consents_select
  on public.contact_consents for select
  to authenticated
  using (
    auth.uid() = granter_id
    or (
      auth.uid() = grantee_id
      and public.has_contact_grant(auth.uid(), granter_id)
    )
  );

drop policy if exists contact_consents_insert_own on public.contact_consents;
create policy contact_consents_insert_own
  on public.contact_consents for insert
  to authenticated
  with check (auth.uid() = granter_id);

drop policy if exists contact_consents_update_own on public.contact_consents;
create policy contact_consents_update_own
  on public.contact_consents for update
  to authenticated
  using (auth.uid() = granter_id)
  with check (auth.uid() = granter_id);

drop policy if exists contact_consents_delete_own on public.contact_consents;
create policy contact_consents_delete_own
  on public.contact_consents for delete
  to authenticated
  using (auth.uid() = granter_id);
