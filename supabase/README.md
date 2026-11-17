# Supabase — cierre operativo piloto

Código de la app: puente en `zunela-web` + flag `NEXT_PUBLIC_ZUNELA_BACKEND`. Por defecto sigue **local**.

## Opción A — Supabase local (Docker)

Requiere Docker Desktop. Desde la raíz del repo:

```powershell
npx supabase start
cd zunela-web
.\scripts\write-env-local.ps1 -Url "http://127.0.0.1:54321" -AnonKey "<ANON_KEY de supabase start>"
npm run dev -- -p 3001
```

Las migraciones `001`–`019` se aplican solas al arrancar. Studio: `http://127.0.0.1:54323`. Correos de Auth: Mailpit `http://127.0.0.1:54324`.

## Checklist de setup (cloud u local)

**Local Docker (2026-11-16):** §2b/§6b OK.

**Cloud (proyecto Zunela) + Railway:** ver [`docs/piloto-50-100.md`](../docs/piloto-50-100.md).

- [x] Stack local listo (`npx supabase start`).
- [x] Proyecto cloud **Zunela** (`lseadxgeffktdnqgknhd`) + SQL `001`–`018`.
- [ ] Aplicar `019_private_messages_accepted.sql` en cloud (SQL Editor).
- [x] Auth email + Site URL / Redirect = dominio Railway.
- [x] Railway online + env vars.
- [x] Primera cuenta cloud → bootstrap admin.
- [x] Runbook local §2b / §6b ([`docs/piloto-runbook.md`](../docs/piloto-runbook.md)).

## 1. Aplicar SQL

**Preferido (proyecto nuevo):** SQL Editor → pegar y ejecutar [`apply-all.sql`](./apply-all.sql) (concatena `001`–`019`).

**Proyecto cloud ya con 001–018:** ejecutar solo [`migrations/019_private_messages_accepted.sql`](./migrations/019_private_messages_accepted.sql).

**Alternativa:** ejecutar en orden:

- [`migrations/001_profiles_affinity.sql`](./migrations/001_profiles_affinity.sql)
- [`migrations/002_affinities_read_for_discover.sql`](./migrations/002_affinities_read_for_discover.sql)
- [`migrations/003_connections.sql`](./migrations/003_connections.sql)
- [`migrations/004_private_messages.sql`](./migrations/004_private_messages.sql)
- [`migrations/005_opportunities.sql`](./migrations/005_opportunities.sql)
- [`migrations/006_communities.sql`](./migrations/006_communities.sql)
- [`migrations/007_community_content.sql`](./migrations/007_community_content.sql)
- [`migrations/008_reports_appeals.sql`](./migrations/008_reports_appeals.sql)
- [`migrations/009_contact_consents.sql`](./migrations/009_contact_consents.sql)
- [`migrations/010_memberships.sql`](./migrations/010_memberships.sql)
- [`migrations/011_notifications.sql`](./migrations/011_notifications.sql)
- [`migrations/012_app_settings.sql`](./migrations/012_app_settings.sql)
- [`migrations/013_product_events.sql`](./migrations/013_product_events.sql)
- [`migrations/014_audit_log.sql`](./migrations/014_audit_log.sql)
- [`migrations/015_suspensions.sql`](./migrations/015_suspensions.sql)
- [`migrations/016_app_catalogs.sql`](./migrations/016_app_catalogs.sql)
- [`migrations/017_pilot_presence.sql`](./migrations/017_pilot_presence.sql)
- [`migrations/018_account_lifecycle.sql`](./migrations/018_account_lifecycle.sql)
- [`migrations/019_private_messages_accepted.sql`](./migrations/019_private_messages_accepted.sql)

Las migraciones individuales son la fuente de verdad. `apply-all.sql` es solo atajo; regenerarlo si cambian los archivos en `migrations/`.

## 2. Variables de entorno

En `zunela-web/.env.local` (copiar de `.env.example` o usar el script):

```env
NEXT_PUBLIC_ZUNELA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

Script (desde `zunela-web`):

```powershell
.\scripts\write-env-local.ps1 -Url "https://TU_PROYECTO.supabase.co" -AnonKey "tu_anon_key"
```

`.env.local` está en `.gitignore` (`zunela-web/.gitignore`: `.env*` con excepción de `.env.example`). Nunca commitear la anon key ni la service role.

## 3. Arranque

1. Reinicia `npm run dev`.
2. Con el flag activo, Auth / Perfil / Intereses / panel usan el puente remoto.
3. Sin esas variables, todo sigue 100% local.

## 4. Primer admin

1. Registra la primera cuenta en la app.
2. Cuenta → **Soy el primer administrador** (RPC `bootstrap_first_admin`; solo si aún no hay admin).
3. Alternativa SQL: [`bootstrap_admin.sql`](./bootstrap_admin.sql).

Después: sin auto-elevación; solo un admin asigna roles.

## 5. Prueba

Seguir [`docs/piloto-validacion-2b.md`](../docs/piloto-validacion-2b.md) y marcar §2b / §6b en [`docs/piloto-runbook.md`](../docs/piloto-runbook.md).
