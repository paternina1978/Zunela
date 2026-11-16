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
