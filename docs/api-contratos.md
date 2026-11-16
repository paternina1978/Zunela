# Contratos API MVP (slice identidad)

Contratos del **primer slice compartido**: autenticación, perfil e intereses.  
El resto del producto sigue en cliente local hasta slices posteriores.  
Alineado a [modelo-datos-mvp.md](./modelo-datos-mvp.md) y fail-closed de `zunela-web/src/lib/api-guard.ts`.

**Modo por defecto:** local (`NEXT_PUBLIC_ZUNELA_BACKEND` vacío o `local`).  
**Modo remoto:** `NEXT_PUBLIC_ZUNELA_BACKEND=supabase` + URL y anon key.

## 1. Auth (proveedor: Supabase Auth)

| Operación | Contrato | Notas |
|-----------|----------|--------|
| Registro | email + password + nombre_visible | Email confirmable según proyecto; nombre en `profiles` al crear. |
| Ingreso | email + password | Sesión JWT en el cliente Supabase. |
| Salir | signOut | Limpia sesión remota; no borra perfil. |
| Recuperación | reset por email del proveedor | Sustituye el código local solo en modo remoto. |

No exponer `password` ni hashes propios cuando el backend esté activo.

## 2. Recursos REST (orientación; hoy vía Supabase client + RLS)

### `profiles` (uno por `auth.users.id`)

| Campo | Tipo | Visibilidad |
|-------|------|-------------|
| id | uuid PK = auth.uid() | — |
| visible_name | text | siempre público |
| legal_name | text | solo dueño |
| country | text | según flag |
| city | text | según flag |
| profession | text | según flag |
| knowledge | text[] | según flag |
| presentation | text | según flag |
| photo_url | text null | según flag (sin data URL enorme en DB) |
| visibility | jsonb | dueño R/W |
| updated_at | timestamptz | — |

**Lectura ajena:** solo campos con `visibility.* = public` (o tras conexión, slice futuro).  
**Escritura:** solo `auth.uid() = id`.

### `affinities` (uno por usuario)

| Campo | Tipo |
|-------|------|
| user_id | uuid PK FK profiles |
| interests | text[] |
| goals | text[] |
| offers | text[] |
| modality | text |
| reach | text |
| availability | text[] |
| updated_at | timestamptz |

**R/W:** solo el dueño en este slice (descubrimiento compartido = slice posterior).

## 3. Rutas Next actuales (`/api/*`)

- `GET /api/personas/[id]`: catálogo local; si no hay ficha, acepta `Authorization: Bearer <jwt>` y lee `profiles`/`affinities` con RLS. Sin token → 404 fail-closed.
- Comunidades, adjuntos, agentes, aprobaciones: sin cambio hasta su slice.

Descubrir en cliente también lista perfiles remotos autenticados (`lib/remote/catalog.ts`).

## 4. Errores

| Código | Uso |
|--------|-----|
| 401 | Sin sesión |
| 403 | Sesión sin permiso (fail-closed) |
| 404 | Recurso inexistente o no visible |
| 422 | Validación de campos |

## 5. Conexiones (slice match)

Tabla `connections` (`from_user`, `to_user`, `status`: pending|accepted|declined|blocked|expired).  
RLS: solo participantes. UI: `noteOutgoingInterestAsync` / `acceptMatchAsync` / etc. sobre UUID; ids del catálogo demo siguen en `localStorage`.

## 6. Chat privado (slice mensajes)

Tabla `private_messages` (`sender_id`, `recipient_id`, `body` ≤ 280). RLS: solo participantes; insert solo como remitente.  
UI: `sendPrivateMessageAsync` / `readThreadAsync` para UUID; cupo diario suma remoto + local + comunidad.

## 7. Oportunidades (slice publicar / postular)

Tablas `opportunities` + `opportunity_applications`. RLS: publicadas visibles a autenticados; en revisión solo organizador; aprobación piloto permite update a cualquier autenticado.  
UI: `publishOwnOpportunityAsync`, `applyToOpportunityAsync`, `approveOwnOpportunityAsync`.

## 8. Comunidades (slice ficha / miembros)

Tablas `communities`, `community_members`, `community_requests`, `community_invites`. RLS con helpers `security definer` anti-recursión.  
UI: `publishOwnCommunityAsync`, `joinCommunityAsync`, `requestCommunityAccessAsync`, etc.

## 9. Chat/posts de comunidad

Tablas `community_posts` + `community_messages` (`007`). Solo miembros escriben; posts de comunidades públicas publicadas son legibles. Cupo diario suma mensajes de comunidad remota.  
UI: `publishCommunityPostAsync` / `sendCommunityChatAsync`.

## 10. Reportes y apelaciones

Tablas `reports` + `appeals` (`008`). Insert propio; lectura/revisión solo staff tras `010`. Revisar solo cambia `status` — sin sanción automática.

## 11. Contacto bilateral

Tabla `contact_consents` (`009`). RLS bilateral. UI: `grantContactConsentAsync` / `revokeContactConsentAsync`.

## 12. Roles (memberships)

Tabla `memberships` (`010`: usuario|moderador|administrador). Helpers `is_staff` / `is_admin`. Alta → usuario. Sin auto-elevación en cliente. Admin asigna desde panel o SQL bootstrap.  
Aprobación de oportunidades/comunidades y review de reportes/apelaciones: solo staff.

## 13. Avisos (notifications)

Tabla `notifications` + RPC `notify_user` (`011`). Solo el dueño lee/actualiza/borra; avisar a otro va por RPC (sin contacto en el texto). Preferencias de Cuenta filtran la bandeja en cliente.  
UI: `recordNoticeAsync`, `notifyOtherUserAsync`, `refreshRemoteNotices`.

## 14. Parámetros globales (app_settings)

Tablas `app_settings` (singleton `id=1`) + `app_settings_versions` (`012`). Lectura autenticada; escritura solo `is_admin()`. Seed con defaults del MVP.  
UI: `saveAdminParamsAsync`, `refreshRemoteAdminParams`. Demo local sigue en `localStorage`.

## 15. Eventos de producto (product_events)

Tabla `product_events` (`013`). Insert propio; lectura solo staff (`is_staff`). Sin cuerpo de chat; trigger rechaza correo/teléfono en el texto (máx. 280).  
UI: `recordProductEvent` (fire-and-forget remoto), `refreshRemoteProductEvents`. Demo local en `localStorage`.

## 16. Bitácora + bootstrap admin (audit_log)

Tabla `audit_log` (`014`). Insert/lectura solo staff. Sin contacto en el texto.  
RPC `admin_exists` / `bootstrap_first_admin`: la primera cuenta puede elevarse una sola vez; después falla. Alternativa SQL en `supabase/bootstrap_admin.sql`.  
UI: `recordAudit`, `refreshRemoteAudit`, `bootstrapFirstAdminAsync` (Cuenta → «Soy el primer administrador»).

## 17. Suspensiones

Columna `profiles.suspended` (`015`). Lectura autenticada; solo `is_admin()` cambia el flag (política + trigger). Descubrir excluye suspendidos.  
UI: `setUserSuspendedAsync`, `refreshRemoteSuspendedIds`. Demo local en `localStorage`.

## 18. Catálogos editables (app_catalogs)

Tabla singleton `app_catalogs` (`016`). Payload JSON (extras/desactivados) sobre defaults de código. Lectura autenticada; escritura `is_admin()`.  
UI: `addCatalogItemAsync` / `deactivateCatalogItemAsync` / `resetCatalogsAsync` / `refreshRemoteCatalogs`.

## 19. Presencia piloto (pilot_presence)

Tabla `pilot_presence` + RPC `touch_pilot_presence` (`017`). Insert/update propios; lectura propia o staff. `first_seen_at` no se pisa.  
UI: `touchPilotPresenceAsync`, `refreshRemotePilotPresence`. Métricas D7/D30 en Admin.

## 20. Ciclo de vida de cuenta (export + delete)

RPC `export_my_account_summary` y `delete_my_account` (`018`).  
Export: JSON resumido (perfil, afinidad, conteos) sin cuerpos de chat ni contactos ajenos.  
Delete: borra `auth.users` (cascade); bloquea al único administrador.  
UI: Cuenta → Descargar copia / Eliminar cuenta (`exportRemoteAccountCopy`, `deleteRemoteAccount`).  
Respaldo v2 (restaurar navegador) sigue siendo local.

## 21. Auth cloud (confirmación / recuperación)

Registro remoto: `emailRedirectTo` → `/auth/callback`. Si el proyecto exige confirmar correo y no hay sesión tras `signUp`, la UI muestra «Revisa tu correo» (`pendingEmailConfirm`).  
Recuperación: `resetPasswordForEmail` con el mismo callback.  
Página: `app/auth/callback` intercambia `?code=` (PKCE) y redirige a `/perfil`.

## 22. Fuera de alcance aún

Pagos, IA en producción.  
Despliegue 50–100: [`piloto-50-100.md`](./piloto-50-100.md).
