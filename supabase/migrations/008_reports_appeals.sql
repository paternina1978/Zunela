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
