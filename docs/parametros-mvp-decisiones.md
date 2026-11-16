# Acta de parámetros MVP (Fase 1)

Acta local alineada al Documento Maestro v1.1 §14 (alta) y §15.2.  
Fuente de verdad en código: `zunela-web/src/lib/admin.ts` (`DEFAULT_ADMIN_PARAMS`), `account.ts`, `chat-rules.ts`, `roles.ts`.

**Estado:** cerrado para piloto interno en un navegador. Sin precios, OpenAI ni reputación.

## 1. Planes (sin cobro)

| Concepto | Decisión |
|----------|----------|
| Planes activos | `gratis` y `prueba` (Premium de prueba). No hay plan de pago. |
| Prueba Premium | 10 días (`trialDays: 10`). Sin cobro; al vencer vuelve a Gratis. |
| Crear oportunidad propia | Solo en prueba Premium; queda en revisión hasta un moderador/admin. |
| Participar en catálogo | Gratis (postulación / interés). |
| Comunidades privadas / por invitación | Disponibles en flujo local; cupo de creación pública aplica a públicas. |
| Contacto externo (correo/teléfono) | Solo en prueba Premium, con consentimiento bilateral en el chat. |
| IA | Apagada (`AI_MODULE_ENABLED = false`). Fail-closed. |

## 2. Cupos y comunicación

| Parámetro | Valor por defecto | Notas |
|-----------|-------------------|--------|
| Mensajes/día Gratis | 20 | Privado + comunidad unificados (`outboundTodayCount`). |
| Mensajes/día prueba Premium | 60 | Mismo contador unificado. |
| Comunidades públicas | 2 cada 30 días | Cliente + API fail-closed. |
| Expiración de solicitud de conexión | 7 días | Sin reactivación automática si se rechaza. |
| Adjuntos | `ninguno` | Fijo en el piloto. |
| Aviso de reportes abiertos | desde 3 | Panel admin. |
| Umbral de afinidad en listado | 0 | Sin filtro por score mínimo. |

Reglas de contenido (RB-08): no correo, teléfono, enlaces ni redes en chat privado ni comunidad (`chat-rules.ts`). Máx. 280 caracteres por envío.

## 3. Visibilidad de perfil

| Campo | Decisión |
|-------|----------|
| Nombre visible | Siempre público. |
| Correo / nombre legal | Solo en cuenta; nunca en perfil ajeno, avisos ni búsqueda. |
| Foto, profesión, país, ciudad, conocimientos, presentación | Controles: público / tras la conexión. |
| Contacto externo | Oculto hasta autorización + aceptación de la otra parte. |

## 4. Roles

| Rol | Puede |
|-----|--------|
| `usuario` | Flujo completo de producto local. |
| `moderador` | Reportes, apelaciones, aprobar publicaciones propias. |
| `administrador` | Todo lo anterior + usuarios, catálogos, parámetros, control IA (stubs). |

Activación local: Cuenta → “Activar administrador” / moderador (`localStorage`).  
Remoto (`010` + `014`): rol en `memberships`; sin auto-elevación; primer admin por RPC `bootstrap_first_admin` o SQL.

## 5. Explicitamente aplazado (no decidir ahora)

- Precios y pasarela de pago.
- Reputación / biometría / verificación formal.
- Circles Fase 3.
- Proveedor OpenAI y cuotas reales de IA.
- Auth compartida y PostgreSQL (siguiente hito técnico tras este acta).

## 6. Cómo cambiar en el piloto

Admin (rol administrador) → parámetros. Cada guardado crea versión y bitácora.  
No inventar valores fuera de este acta sin actualizar este documento.
