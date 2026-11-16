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
