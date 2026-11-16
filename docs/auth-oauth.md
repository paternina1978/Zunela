# Acceso social (Google / Gmail y otros) — PAUSADO

**Estado:** pausado. Google Cloud pide tarjeta / verificación de crédito para crear el cliente OAuth y no aplica al piloto ahora.

El acceso sigue por **correo + contraseña** (y recuperación). El botón «Continuar con Google» no se muestra en la UI.

El helper `remoteSignInWithOAuth` en `zunela-web/src/lib/remote/identity.ts` queda listo para reactivar más adelante.

## Cuando se retome

1. Google Cloud → OAuth client (Aplicación web) con redirect:

```text
https://lseadxgeffktdnqgknhd.supabase.co/auth/v1/callback
```

2. Supabase → Authentication → Providers → Google → Client ID + Secret → Enable.
3. Volver a mostrar el botón en `AuthCard` (mismo patrón que el commit de OAuth).
4. Redirect URLs de la app: `https://zunela-production.up.railway.app/auth/callback`

## Otros proveedores

Apple, Microsoft, etc.: misma idea en Supabase Providers; no requieren Google Cloud, pero cada uno tiene su consola y a veces costo o requisitos distintos.
