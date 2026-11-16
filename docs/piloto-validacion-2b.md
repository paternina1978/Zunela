# Validación §2b — guía de verificación

Checklist operable del cierre remoto. Setup previo: [`supabase/README.md`](../supabase/README.md).

## Antes de probar

1. Pegar [`supabase/apply-all.sql`](../supabase/apply-all.sql) en SQL Editor (proyecto vacío) y ejecutar.
2. Project Settings → API: copiar Project URL y `anon` `public` key.
3. En `zunela-web`:

```powershell
.\scripts\write-env-local.ps1 -Url "https://XXXX.supabase.co" -AnonKey "eyJ..."
npm run dev
```

4. Confirmar Auth → Providers → Email habilitado.

## Bootstrap

1. Navegador A: crear cuenta (email de prueba).
2. Completar perfil e intereses.
3. Cuenta → **Soy el primer administrador**.
4. Debe aparecer enlace a `/admin`. Si falla “Ya hay un administrador”, usar [`supabase/bootstrap_admin.sql`](../supabase/bootstrap_admin.sql).

## §2b (marcar en [piloto-runbook.md](./piloto-runbook.md))

Ejecutar la tabla §2b del runbook con cuenta A (admin) y B (ventana privada). Criterio de cierre: §6b.

**Cierre local Docker (2026-11-16):** §2b y §6b OK. Admin UI con `admin@piloto.local` mostró Usuario Beta, 1 reporte revisado, umbral afinidad 5 (v2) y bitácora remota.

## Fallos frecuentes

| Síntoma | Revisar |
|---------|---------|
| Sigue en local | `.env.local` con `BACKEND=supabase` + reinicio de `next dev` |
| Error RLS / tabla no existe | Reaplicar `apply-all.sql` |
| No aparece bootstrap | Ya existe un admin → SQL manual |
| Suspender no oculta | Migración `015`; refrescar Descubrir en otra sesión |
| Bitácora vacía | Solo staff ve `audit_log`; rol admin hidratado |
