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
