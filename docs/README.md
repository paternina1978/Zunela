# Documentación de cierre Fase 1 (local → piloto)

Tras el MVP en navegador (`zunela-web`), estos documentos cumplen §15.2, §15.5 y §15.7 del Documento Maestro v1.1.

| Documento | Para qué |
|-----------|----------|
| [parametros-mvp-decisiones.md](./parametros-mvp-decisiones.md) | Acta de cupos, planes, chat, visibilidad y roles |
| [modelo-datos-mvp.md](./modelo-datos-mvp.md) | Entidades, matriz de autorización y orientación RLS |
| [piloto-runbook.md](./piloto-runbook.md) | Guion de prueba interna y protocolo multi-cuenta |
| [piloto-validacion-2b.md](./piloto-validacion-2b.md) | Guía paso a paso: SQL → env → bootstrap → §2b |
| [piloto-50-100.md](./piloto-50-100.md) | Supabase cloud + Railway (piloto 50–100) |
| [auth-oauth.md](./auth-oauth.md) | Google/Gmail y otros inicios sociales |
| [api-contratos.md](./api-contratos.md) | Contratos del slice remoto (Auth → presencia / cuenta) |

**Estado del código:** piloto técnico + §2b/§6b OK en Docker local — migraciones `001`–`018`, Auth callback para correo, demo local intacta.

**Hito activo:** [piloto-50-100.md](./piloto-50-100.md) — proyecto Supabase **Zunela** + Railway (`zunela-web`).  
Local: [`supabase/README.md`](../supabase/README.md) · SQL [`supabase/apply-all.sql`](../supabase/apply-all.sql).

**Fuera del piloto:** pagos, IA en producción.
