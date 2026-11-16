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
