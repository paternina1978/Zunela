-- Listado de perfiles para Descubrir (sin foto). Evita listados vacíos por RLS/cliente.

create or replace function public.list_discover_profiles()
returns table (
  id uuid,
  visible_name text,
  country text,
  city text,
  profession text,
  knowledge text[],
  presentation text,
  visibility jsonb,
  suspended boolean,
  interests text[],
  goals text[],
  offers text[],
  modality text,
  reach text,
  availability text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.visible_name,
    p.country,
    p.city,
    p.profession,
    p.knowledge,
    p.presentation,
    p.visibility,
    coalesce(p.suspended, false) as suspended,
    a.interests,
    a.goals,
    a.offers,
    a.modality,
    a.reach,
    a.availability
  from public.profiles p
  left join public.affinities a on a.user_id = p.id
  where coalesce(p.suspended, false) = false;
$$;

revoke all on function public.list_discover_profiles() from public;
grant execute on function public.list_discover_profiles() to authenticated;
