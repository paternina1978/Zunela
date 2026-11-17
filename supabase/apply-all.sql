-- ZUNELA piloto: apply-all.sql
-- Atajo operativo: pegar en Supabase SQL Editor (una sola vez en proyecto nuevo).
-- Fuente de verdad: migrations/001–017 individuales. No editar a mano; regenerar si cambian.


-- =============================================================================
-- 001_profiles_affinity.sql
-- =============================================================================

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


-- =============================================================================
-- 002_affinities_read_for_discover.sql
-- =============================================================================

-- Slice descubrimiento: usuarios autenticados pueden leer afinidades ajenas
-- (señales de descubrimiento). La escritura sigue siendo solo del dueño.

drop policy if exists affinities_select_own on public.affinities;

create policy affinities_select_authenticated
  on public.affinities for select
  to authenticated
  using (true);


-- =============================================================================
-- 003_connections.sql
-- =============================================================================

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


-- =============================================================================
-- 004_private_messages.sql
-- =============================================================================

-- Slice chat privado entre conexiones aceptadas.

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 280),
  created_at timestamptz not null default now(),
  constraint private_messages_distinct_users check (sender_id <> recipient_id)
);

create index if not exists private_messages_pair_created_idx
  on public.private_messages (sender_id, recipient_id, created_at);

create index if not exists private_messages_recipient_created_idx
  on public.private_messages (recipient_id, created_at);

alter table public.private_messages enable row level security;

drop policy if exists private_messages_select_participants on public.private_messages;
create policy private_messages_select_participants
  on public.private_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists private_messages_insert_own on public.private_messages;
create policy private_messages_insert_own
  on public.private_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- Sin update/delete en el piloto: el historial queda auditable en el cliente.


-- =============================================================================
-- 005_opportunities.sql
-- =============================================================================

-- Slice oportunidades compartidas + postulaciones.

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null
    check (char_length(trim(title)) >= 4 and char_length(title) <= 80),
  category text not null
    check (category in ('Conocimiento', 'Negocios', 'Actividad', 'Colaboración')),
  objective text not null
    check (char_length(trim(objective)) >= 12 and char_length(objective) <= 400),
  city text not null check (char_length(trim(city)) > 0),
  modality text not null check (modality in ('presencial', 'remota', 'ambas')),
  spots int not null check (spots >= 2 and spots <= 30),
  interest text not null check (char_length(trim(interest)) > 0),
  role text not null default '' check (char_length(role) <= 60),
  rule text not null default '',
  organizer_name text not null,
  organizer_detail text not null,
  status text not null default 'revision'
    check (status in ('revision', 'publicada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_status_created_idx
  on public.opportunities (status, created_at desc);

create index if not exists opportunities_organizer_idx
  on public.opportunities (organizer_id, created_at desc);

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

create table if not exists public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  applicant_name text not null,
  role text not null default '',
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aceptada', 'rechazada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_applications_unique unique (opportunity_id, applicant_id)
);

create index if not exists opportunity_applications_opp_idx
  on public.opportunity_applications (opportunity_id, status);

create index if not exists opportunity_applications_applicant_idx
  on public.opportunity_applications (applicant_id, created_at desc);

drop trigger if exists opportunity_applications_set_updated_at on public.opportunity_applications;
create trigger opportunity_applications_set_updated_at
  before update on public.opportunity_applications
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;
alter table public.opportunity_applications enable row level security;

-- Publicadas visibles a autenticados; en revisión solo el organizador.
drop policy if exists opportunities_select_visible on public.opportunities;
create policy opportunities_select_visible
  on public.opportunities for select
  to authenticated
  using (status = 'publicada' or auth.uid() = organizer_id);

drop policy if exists opportunities_insert_own on public.opportunities;
create policy opportunities_insert_own
  on public.opportunities for insert
  to authenticated
  with check (auth.uid() = organizer_id);

-- Organizador edita su fila; cualquier autenticado puede aprobar (piloto sin roles DB).
drop policy if exists opportunities_update_organizer_or_review on public.opportunities;
create policy opportunities_update_organizer_or_review
  on public.opportunities for update
  to authenticated
  using (auth.uid() = organizer_id or status = 'revision')
  with check (auth.uid() = organizer_id or status = 'publicada');

-- Postulaciones: organizador ve todas de su oportunidad; postulante ve las suyas.
drop policy if exists opportunity_applications_select_participants on public.opportunity_applications;
create policy opportunity_applications_select_participants
  on public.opportunity_applications for select
  to authenticated
  using (
    auth.uid() = applicant_id
    or exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.organizer_id = auth.uid()
    )
  );

drop policy if exists opportunity_applications_insert_own on public.opportunity_applications;
create policy opportunity_applications_insert_own
  on public.opportunity_applications for insert
  to authenticated
  with check (auth.uid() = applicant_id);

drop policy if exists opportunity_applications_update_participants on public.opportunity_applications;
create policy opportunity_applications_update_participants
  on public.opportunity_applications for update
  to authenticated
  using (
    auth.uid() = applicant_id
    or exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.organizer_id = auth.uid()
    )
  )
  with check (
    auth.uid() = applicant_id
    or exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.organizer_id = auth.uid()
    )
  );

drop policy if exists opportunity_applications_delete_own on public.opportunity_applications;
create policy opportunity_applications_delete_own
  on public.opportunity_applications for delete
  to authenticated
  using (auth.uid() = applicant_id);


-- =============================================================================
-- 006_communities.sql
-- =============================================================================

-- Slice comunidades compartidas (ficha + miembros + solicitudes/invites).
-- Chat y posts de comunidad siguen en cliente local hasta un slice posterior.

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null
    check (char_length(trim(title)) >= 4 and char_length(title) <= 80),
  summary text not null
    check (char_length(trim(summary)) >= 12 and char_length(summary) <= 400),
  city text not null check (char_length(trim(city)) > 0),
  modality text not null check (modality in ('presencial', 'remota', 'ambas')),
  interest text not null check (char_length(trim(interest)) > 0),
  rule text not null default '',
  access text not null check (access in ('publica', 'privada', 'invitacion')),
  organizer_name text not null,
  status text not null default 'revision'
    check (status in ('revision', 'publicada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communities_status_access_idx
  on public.communities (status, access, created_at desc);

create index if not exists communities_organizer_idx
  on public.communities (organizer_id, created_at desc);

drop trigger if exists communities_set_updated_at on public.communities;
create trigger communities_set_updated_at
  before update on public.communities
  for each row execute function public.set_updated_at();

create table if not exists public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  person_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  role text not null default 'miembro'
    check (role in ('organizador', 'moderador', 'miembro')),
  created_at timestamptz not null default now(),
  constraint community_members_unique unique (community_id, person_id)
);

create index if not exists community_members_person_idx
  on public.community_members (person_id);

create table if not exists public.community_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  applicant_name text not null,
  created_at timestamptz not null default now(),
  constraint community_requests_unique unique (community_id, applicant_id)
);

create table if not exists public.community_invites (
  community_id uuid not null references public.communities (id) on delete cascade,
  person_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, person_id)
);

-- Helpers sin RLS (evitan recursión entre communities ↔ members).
create or replace function public.is_community_member(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = cid and m.person_id = auth.uid()
  );
$$;

create or replace function public.is_community_staff(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = cid
      and m.person_id = auth.uid()
      and m.role in ('organizador', 'moderador')
  );
$$;

create or replace function public.is_community_organizer_member(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = cid
      and m.person_id = auth.uid()
      and m.role = 'organizador'
  );
$$;

create or replace function public.is_community_invited(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.community_invites i
    where i.community_id = cid and i.person_id = auth.uid()
  );
$$;

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_requests enable row level security;
alter table public.community_invites enable row level security;

drop policy if exists communities_select_visible on public.communities;
create policy communities_select_visible
  on public.communities for select
  to authenticated
  using (
    auth.uid() = organizer_id
    or (
      status = 'publicada'
      and (
        access in ('publica', 'privada')
        or public.is_community_member(id)
        or public.is_community_invited(id)
      )
    )
  );

drop policy if exists communities_insert_own on public.communities;
create policy communities_insert_own
  on public.communities for insert
  to authenticated
  with check (auth.uid() = organizer_id);

drop policy if exists communities_update_organizer_or_review on public.communities;
create policy communities_update_organizer_or_review
  on public.communities for update
  to authenticated
  using (auth.uid() = organizer_id or status = 'revision')
  with check (auth.uid() = organizer_id or status = 'publicada');

drop policy if exists community_members_select on public.community_members;
create policy community_members_select
  on public.community_members for select
  to authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id
        and (c.organizer_id = auth.uid() or c.status = 'publicada')
    )
  );

drop policy if exists community_members_insert on public.community_members;
create policy community_members_insert
  on public.community_members for insert
  to authenticated
  with check (
    auth.uid() = person_id
    or public.is_community_staff(community_id)
  );

drop policy if exists community_members_update on public.community_members;
create policy community_members_update
  on public.community_members for update
  to authenticated
  using (public.is_community_organizer_member(community_id))
  with check (public.is_community_organizer_member(community_id));

drop policy if exists community_members_delete on public.community_members;
create policy community_members_delete
  on public.community_members for delete
  to authenticated
  using (
    auth.uid() = person_id
    or public.is_community_organizer_member(community_id)
  );

drop policy if exists community_requests_select on public.community_requests;
create policy community_requests_select
  on public.community_requests for select
  to authenticated
  using (
    auth.uid() = applicant_id
    or public.is_community_staff(community_id)
  );

drop policy if exists community_requests_insert on public.community_requests;
create policy community_requests_insert
  on public.community_requests for insert
  to authenticated
  with check (auth.uid() = applicant_id);

drop policy if exists community_requests_delete on public.community_requests;
create policy community_requests_delete
  on public.community_requests for delete
  to authenticated
  using (
    auth.uid() = applicant_id
    or public.is_community_staff(community_id)
  );

drop policy if exists community_invites_select on public.community_invites;
create policy community_invites_select
  on public.community_invites for select
  to authenticated
  using (
    auth.uid() = person_id
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.organizer_id = auth.uid()
    )
  );

drop policy if exists community_invites_insert on public.community_invites;
create policy community_invites_insert
  on public.community_invites for insert
  to authenticated
  with check (
    exists (
      select 1 from public.communities c
      where c.id = community_id and c.organizer_id = auth.uid()
    )
  );

drop policy if exists community_invites_delete on public.community_invites;
create policy community_invites_delete
  on public.community_invites for delete
  to authenticated
  using (
    auth.uid() = person_id
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.organizer_id = auth.uid()
    )
  );


-- =============================================================================
-- 007_community_content.sql
-- =============================================================================

-- Slice chat y publicaciones de comunidad.
-- Solo miembros escriben; lecturas de posts públicas abiertas en comunidades publicadas.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists community_posts_community_created_idx
  on public.community_posts (community_id, created_at desc);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_community_created_idx
  on public.community_messages (community_id, created_at);

create index if not exists community_messages_author_created_idx
  on public.community_messages (author_id, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_messages enable row level security;

-- Posts: miembros siempre; públicos publicados visibles a autenticados.
drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select
  on public.community_posts for select
  to authenticated
  using (
    public.is_community_member(community_id)
    or exists (
      select 1 from public.communities c
      where c.id = community_id
        and c.status = 'publicada'
        and c.access = 'publica'
    )
  );

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert
  on public.community_posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and public.is_community_member(community_id)
  );

-- Chat: solo miembros.
drop policy if exists community_messages_select on public.community_messages;
create policy community_messages_select
  on public.community_messages for select
  to authenticated
  using (public.is_community_member(community_id));

drop policy if exists community_messages_insert on public.community_messages;
create policy community_messages_insert
  on public.community_messages for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and public.is_community_member(community_id)
  );


-- =============================================================================
-- 008_reports_appeals.sql
-- =============================================================================

-- Slice reportes y apelaciones compartidos.
-- Sin sanción automática (A08/A09): revisar solo cambia status / auditoría en app.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('privado', 'comunidad', 'comunidad-chat')),
  target_key text not null check (char_length(trim(target_key)) > 0),
  label text not null default '',
  status text not null default 'pendiente'
    check (status in ('pendiente', 'revisado')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_reporter_key unique (reporter_id, target_key)
);

create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

create index if not exists reports_target_key_idx
  on public.reports (target_key);

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  appellant_id uuid not null references public.profiles (id) on delete cascade,
  community_id text not null,
  community_title text not null,
  kind text not null check (kind in ('reporte', 'bloqueo', 'acceso')),
  note text not null
    check (char_length(trim(note)) > 0 and char_length(note) <= 400),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'revisada')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists appeals_status_created_idx
  on public.appeals (status, created_at desc);

create index if not exists appeals_appellant_idx
  on public.appeals (appellant_id, created_at desc);

alter table public.reports enable row level security;
alter table public.appeals enable row level security;

-- Piloto: autenticados leen cola de moderación; el autor siempre ve lo suyo.
drop policy if exists reports_select_authenticated on public.reports;
create policy reports_select_authenticated
  on public.reports for select
  to authenticated
  using (true);

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Cualquier autenticado puede marcar revisado (roles DB = slice posterior).
drop policy if exists reports_update_review on public.reports;
create policy reports_update_review
  on public.reports for update
  to authenticated
  using (true)
  with check (status in ('pendiente', 'revisado'));

drop policy if exists appeals_select_authenticated on public.appeals;
create policy appeals_select_authenticated
  on public.appeals for select
  to authenticated
  using (true);

drop policy if exists appeals_insert_own on public.appeals;
create policy appeals_insert_own
  on public.appeals for insert
  to authenticated
  with check (auth.uid() = appellant_id);

drop policy if exists appeals_update_review on public.appeals;
create policy appeals_update_review
  on public.appeals for update
  to authenticated
  using (true)
  with check (status in ('pendiente', 'revisada'));


-- =============================================================================
-- 009_contact_consents.sql
-- =============================================================================

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


-- =============================================================================
-- 010_memberships.sql
-- =============================================================================

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


-- =============================================================================
-- 011_notifications.sql
-- =============================================================================

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


-- =============================================================================
-- 012_app_settings.sql
-- =============================================================================

-- Slice parámetros globales (app_settings). Lectura autenticada; escritura solo admin.

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  payload jsonb not null,
  version int not null default 1 check (version >= 1),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null check (version >= 1),
  payload jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists app_settings_versions_version_idx
  on public.app_settings_versions (version desc);

insert into public.app_settings (id, payload, version)
values (
  1,
  '{
    "dailyMessages": 20,
    "premiumDailyMessages": 60,
    "communityQuota": 2,
    "communityQuotaDays": 30,
    "matchExpiryDays": 7,
    "trialDays": 10,
    "attachments": "ninguno",
    "reportAlert": 3,
    "affinityThreshold": 0
  }'::jsonb,
  1
)
on conflict (id) do nothing;

insert into public.app_settings_versions (version, payload)
select 1, payload from public.app_settings where id = 1
and not exists (select 1 from public.app_settings_versions where version = 1);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
alter table public.app_settings_versions enable row level security;

drop policy if exists app_settings_select_authenticated on public.app_settings;
create policy app_settings_select_authenticated
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists app_settings_update_admin on public.app_settings;
create policy app_settings_update_admin
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists app_settings_versions_select_authenticated on public.app_settings_versions;
create policy app_settings_versions_select_authenticated
  on public.app_settings_versions for select
  to authenticated
  using (true);

drop policy if exists app_settings_versions_insert_admin on public.app_settings_versions;
create policy app_settings_versions_insert_admin
  on public.app_settings_versions for insert
  to authenticated
  with check (public.is_admin());


-- =============================================================================
-- 013_product_events.sql
-- =============================================================================

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


-- =============================================================================
-- 014_audit_log.sql
-- =============================================================================

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


-- =============================================================================
-- 015_suspensions.sql
-- =============================================================================

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


-- =============================================================================
-- 016_app_catalogs.sql
-- =============================================================================

-- Slice catálogos editables (intereses / objetivos / habilidades). Lectura autenticada; escritura admin.

create table if not exists public.app_catalogs (
  id int primary key default 1 check (id = 1),
  payload jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_catalogs (id, payload)
values (
  1,
  '{
    "interestDisabled": [],
    "interestExtras": [],
    "goalDisabled": [],
    "goalExtras": [],
    "offerDisabled": [],
    "offerExtras": []
  }'::jsonb
)
on conflict (id) do nothing;

drop trigger if exists app_catalogs_set_updated_at on public.app_catalogs;
create trigger app_catalogs_set_updated_at
  before update on public.app_catalogs
  for each row execute function public.set_updated_at();

alter table public.app_catalogs enable row level security;

drop policy if exists app_catalogs_select_authenticated on public.app_catalogs;
create policy app_catalogs_select_authenticated
  on public.app_catalogs for select
  to authenticated
  using (true);

drop policy if exists app_catalogs_update_admin on public.app_catalogs;
create policy app_catalogs_update_admin
  on public.app_catalogs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 017_pilot_presence.sql
-- =============================================================================

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
-- Slice ciclo de vida de cuenta: copia resumida remota + borrado (sin cuerpos de chat).
-- Piloto 50–100: recuperación/eliminación verificable en servidor (§13).

-- Resumen exportable: perfil, afinidad, conteos. Sin mensajes ni contactos ajenos.
create or replace function public.export_my_account_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mail text;
  p public.profiles%rowtype;
  a public.affinities%rowtype;
  conexiones int;
  pendientes int;
  reportes_abiertos int;
  opps jsonb;
  coms jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select email into mail from auth.users where id = uid;
  select * into p from public.profiles where id = uid;
  select * into a from public.affinities where user_id = uid;

  select count(*)::int into conexiones
  from public.connections c
  where c.status = 'accepted'
    and (c.from_user = uid or c.to_user = uid);

  select count(*)::int into pendientes
  from public.connections c
  where c.status = 'pending'
    and c.to_user = uid;

  select count(*)::int into reportes_abiertos
  from public.reports r
  where r.reporter_id = uid
    and r.status = 'pendiente';

  select coalesce(jsonb_agg(jsonb_build_object('titulo', o.title, 'estado', o.status) order by o.created_at), '[]'::jsonb)
    into opps
  from public.opportunities o
  where o.organizer_id = uid;

  select coalesce(jsonb_agg(jsonb_build_object('titulo', c.title, 'acceso', c.access, 'estado', c.status) order by c.created_at), '[]'::jsonb)
    into coms
  from public.communities c
  where c.organizer_id = uid;

  return jsonb_build_object(
    'generado', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'correo', coalesce(mail, ''),
    'perfil', case
      when p.id is null then null
      else jsonb_build_object(
        'nombre', p.visible_name,
        'pais', p.country,
        'ciudad', p.city,
        'profesion', p.profession,
        'conocimientos', to_jsonb(p.knowledge),
        'presentacion', p.presentation,
        'foto', (p.photo_url is not null and length(p.photo_url) > 0),
        'nombreLegalGuardado', (length(coalesce(p.legal_name, '')) > 0)
      )
    end,
    'intereses', coalesce(to_jsonb(a.interests), '[]'::jsonb),
    'plan', 'gratis',
    'conexiones', coalesce(conexiones, 0),
    'solicitudesPendientes', coalesce(pendientes, 0),
    'reportesAbiertos', coalesce(reportes_abiertos, 0),
    'oportunidades', coalesce(opps, '[]'::jsonb),
    'comunidades', coalesce(coms, '[]'::jsonb),
    'nota', 'Copia remota del piloto: perfil, afinidad y conteos. No incluye mensajes, chats, contraseña ni contactos de otras personas. El plan Premium de prueba sigue siendo local hasta el slice de cobros.'
  );
end;
$$;

revoke all on function public.export_my_account_summary() from public;
grant execute on function public.export_my_account_summary() to authenticated;

-- Borra la cuenta en Auth (cascade a profiles y datos propios). Bloquea al único admin.
create or replace function public.delete_my_account()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  admin_count int;
  is_admin boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.role = 'administrador'
  ) into is_admin;

  if is_admin then
    select count(*)::int into admin_count
    from public.memberships m
    where m.role = 'administrador';
    if admin_count <= 1 then
      raise exception 'cannot delete sole administrator';
    end if;
  end if;

  insert into public.product_events (user_id, body)
  values (uid, 'Solicito eliminacion de cuenta remota.');

  delete from auth.users where id = uid;

  return 'deleted';
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;


-- =============================================================================
-- 019_private_messages_accepted.sql
-- =============================================================================

create or replace function public.private_message_pair_accepted(sender uuid, recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and (
        (c.from_user = sender and c.to_user = recipient)
        or (c.from_user = recipient and c.to_user = sender)
      )
  );
$$;

revoke all on function public.private_message_pair_accepted(uuid, uuid) from public;
grant execute on function public.private_message_pair_accepted(uuid, uuid) to authenticated;

drop policy if exists private_messages_insert_own on public.private_messages;
create policy private_messages_insert_own
  on public.private_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.private_message_pair_accepted(sender_id, recipient_id)
  );

