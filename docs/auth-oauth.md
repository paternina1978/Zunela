# Acceso social (Google / Gmail y otros)

La app ya tiene el botón **Continuar con Google**. Hay que activar el proveedor en Google Cloud y en Supabase.

## 1. Google Cloud Console

1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea o elige un proyecto.
3. **APIs y servicios → Pantalla de consentimiento OAuth** → External → guarda (app en prueba está bien para el piloto).
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**.
5. Tipo: **Aplicación web**.
6. **URI de redirección autorizados** (añade ambos):

```text
https://lseadxgeffktdnqgknhd.supabase.co/auth/v1/callback
http://127.0.0.1:54321/auth/v1/callback
```

7. Copia **Client ID** y **Client Secret**.

## 2. Supabase (proyecto Zunela)

1. **Authentication → Providers → Google** → Enable.
2. Pega Client ID y Client Secret → Save.
3. **Authentication → URL Configuration** (ya lo tienes casi):
   - Site URL: `https://zunela-production.up.railway.app`
   - Redirect URLs:
     - `https://zunela-production.up.railway.app/**`
     - `https://zunela-production.up.railway.app/auth/callback`

## 3. Probar

1. Espera el deploy de Railway con el botón Google.
2. Abre la app → **Continuar con Google**.
3. Elige la cuenta Gmail → vuelve a `/auth/callback` → perfil.

## Otros proveedores

Misma idea en **Authentication → Providers**:

| Proveedor | Uso típico |
|-----------|------------|
| Google | Gmail / cuentas Google |
| Apple | iPhone / App Store |
| Azure (Microsoft) | Outlook / Hotmail / trabajo |
| Facebook | opcional |
| GitHub | más técnico |

En código ya existe `remoteSignInWithOAuth("apple" | "azure" | …)`; solo hay que activar el provider en Supabase y añadir el botón en `AuthCard` cuando lo quieras.

## Notas

- El correo/contraseña sigue disponible («o con correo»).
- No expongas Client Secret en la app: solo en Supabase.
- En modo local (sin Supabase) el botón Google no aparece.
