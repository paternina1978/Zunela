# Prueba rápida en producción (2 cuentas)

URL: https://zunela-production.up.railway.app

Usá **dos navegadores** o uno normal + uno privado (cada uno = una cuenta).

## Preparación

0. En Supabase SQL Editor (si aún no): ejecutar `supabase/migrations/019_private_messages_accepted.sql`.
1. Cuenta **A**: crear cuenta → perfil (ciudad + profesión) → intereses.
2. En A → **Cuenta** → **Soy el primer administrador** (solo la primera vez, si aún no hay admin).
3. Cuenta **B** (otra ventana): crear cuenta → perfil → intereses.

## Match y chat (personas)

No hay invitación por correo entre personas. Cada cuenta se registra sola; luego se encuentran en Descubrir.

1. **Todas** las cuentas: Perfil (ciudad + profesión) → Intereses (al menos 1 interés y 1 objetivo) → Guardar.
2. En **A** → Descubrir → filtro **Personas** + **Toda Colombia** → abrir B → enviar interés.
3. En **B** → Conexiones → **Aceptar** (si no aparece, volvé a enfocar la pestaña).
4. Mensajes → escribir.
5. Contacto externo: ambas en **prueba Premium** (Cuenta) → Permisos en el chat.

## Comunidad

1. Cualquier cuenta → Descubrir → **Crear una comunidad**.
2. **Pública** (Gratis, con cupo): sale en Descubrir y cualquiera se une.
3. **Privada / por invitación**: requieren prueba Premium en Cuenta; **no** salen en el listado público. En la ficha de la comunidad (acceso invitación) podés invitar a personas ya conectadas.

## Si algo falla

| Síntoma | Qué hacer |
|---------|-----------|
| No ves a la otra persona | Perfil + intereses en **ambas**; filtros Personas + Toda Colombia; Admin → umbral = 0. En Supabase: `select id, visible_name, city from profiles;` (deben salir las 3). Recargá Descubrir tras el deploy de sesión. |
| Solo ves oportunidades/comunidades | Cambiar filtro a Personas |
| “Conversación cerrada” | Aceptar en Conexiones; reabrir Mensajes |
| Ya te enviaron interés | Ir a Conexiones y aceptar |
| Fondo oscuro / logo viejo | Borrar datos del sitio en ese celular |

Google OAuth sigue **pausado**. Acceso solo con correo y contraseña.
