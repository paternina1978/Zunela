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
