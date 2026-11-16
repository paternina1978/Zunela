# Modelo lógico de datos MVP (Fase 1)

Propuesta para aprobar (§15.5 / §19) a partir del prototipo local en `zunela-web`.  
Hoy: claves `zunela.*` en `localStorage` / `sessionStorage`. Destino: PostgreSQL + RLS cuando exista auth real.

## 1. Entidades

| Entidad | Hoy (prototipo) | Destino sugerido |
|---------|-----------------|------------------|
| Acceso / identidad | `zunela.access` | `users` (auth) + perfil mínimo |
| Sesión de pestaña | `zunela.session` (+ `signed-out`) | sesión/JWT; no duplicar en durable |
| Rol | `zunela.role` | `memberships.role` (`010`) |
| Cuenta / plan | `zunela.account` | `subscriptions` / `plans` (Gratis \| prueba) |
| Perfil | `zunela.profile` | `profiles` + `profile_visibility` |
| Afinidad | `zunela.affinity` | `user_interests`, `user_goals`, modalidad |
| Catálogo descubrimiento | embebido `discover.ts` + propios | `people`, `opportunities`, `communities` |
| Interés enviado | `zunela.sent-interest` | `interest_edges` |
| Conexiones (match book) | `zunela.matches` | `connections` (pending/accepted/declined/expired/blocked) |
| Chat privado | `zunela.private-chat` | `private_messages` (migración `004`; no en respaldo v2) |
| Contacto bilateral | `zunela.contact-requests` | `contact_consents` (`009`) |
| Oportunidades propias | `zunela.own-opportunities` | `opportunities` + `status` (migración `005`) |
| Postulaciones | `zunela.opportunity-applications` | `opportunity_applications` (`005`) |
| Comunidades propias | `zunela.own-communities` | `communities` + `community_members` / requests / invites (`006`) |
| Chat/posts comunidad | `community-chat` / `community-posts` | `community_messages` / `community_posts` (`007`) |
| Reportes | ledger + keys | `reports` (`008`) + SLA meta local |
| Apelaciones | `zunela.appeals` | `appeals` (`008`) |
| Avisos | `zunela.notices` | `notifications` (`011`, sin contacto) |
| Parámetros admin | `admin-params` + versiones | `app_settings` + `app_settings_versions` (`012`) |
| Auditoría / eventos | `admin-log`, `product-events` | `product_events` (`013`) + `audit_log` (`014`, solo staff) |
| Suspensiones | `admin-suspended` | `profiles.suspended` (`015`) |
| Catálogos editables | `zunela.catalogs` | `app_catalogs` (`016`) |
| Presencia piloto | `pilot-presence` | `pilot_presence` (`017`, D7/D30) |
| Copia / borrado cuenta | `account-data` + respaldo v2 local | RPC `export_my_account_summary` / `delete_my_account` (`018`) |
| IA (stubs) | policy/limits/runs/… | tablas §19 solo cuando se encienda el módulo |

## 2. Matriz rol × plan × recurso (piloto)

| Recurso | Gratis | Prueba Premium | Moderador | Admin |
|---------|--------|----------------|-----------|-------|
| Perfil / intereses | R/W propios | R/W propios | — | suspender usuarios |
| Descubrir catálogo | R | R | R | R + catálogos |
| Enviar interés / conexión | sí | sí | sí | sí |
| Chat privado | cupo 20/día* | cupo 60/día* | sí | sí |
| Contacto externo | no | bilateral | — | — |
| Postular oportunidad | sí | sí | sí | aprobar propias |
| Crear oportunidad | no | sí → revisión | aprobar | aprobar |
| Comunidad pública (crear) | cupo 2/30d | sin cupo fijo local | aprobar | aprobar |
| Reportar / bloquear | sí | sí | revisar | revisar |
| Parámetros / IA control | no | no | no | sí |
| Invocar IA | no (apagada) | no (apagada) | no | stubs fail-closed |

\*Cupo unificado privado + comunidad.

## 3. Reglas de autorización (fail-closed)

1. Chat privado solo si la conexión está `accepted` y no bloqueada.
2. Contacto externo solo con consentimiento de ambas partes y plan de prueba.
3. APIs en `src/app/api/*` no entregan negocio abierto; validan sesión/permiso o fallan.
4. Agentes/IA no aplican sanciones ni leen chats; aprobaciones vencen sin efecto.
5. Avisos y búsqueda no incluyen correo, teléfono ni redes.
6. Respaldo v2 excluye cuerpos de chat (`CHAT_BODY_KEYS`).

## 4. RLS

**Ya en migraciones:** … / `app_catalogs` / `pilot_presence`.

**Pendiente (fuera del piloto técnico):** pagos, IA en producción.

## 5. Fuera de alcance de este modelo

Circles, reputación, biometría, pagos, proveedor OpenAI en producción.

## 6. Siguiente paso técnico

Aplicar `supabase/apply-all.sql` (o `001`–`017`), bootstrap del primer admin, runbook §2b / §6b.
