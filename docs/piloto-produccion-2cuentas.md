# Prueba rápida en producción (2 cuentas)

URL: https://zunela-production.up.railway.app

Usá **dos navegadores** o uno normal + uno privado (cada uno = una cuenta).

## Preparación

0. En Supabase SQL Editor (si aún no): ejecutar `supabase/migrations/019_private_messages_accepted.sql`.
1. Cuenta **A**: crear cuenta → perfil (ciudad + profesión) → intereses.
2. En A → **Cuenta** → **Soy el primer administrador** (solo la primera vez, si aún no hay admin).
3. Cuenta **B** (otra ventana): crear cuenta → perfil → intereses.

## Match y chat

1. En **A** → Descubrir → abrir el perfil de B → enviar interés.
2. En **B** → Conexiones (o avisos) → **Aceptar**.  
   Si no aparece: tocá la pestaña otra vez o volvé a Conexiones (se refresca al enfocar).
3. En cualquiera → Mensajes → abrir el hilo → escribir.
4. Contacto externo (correo/tel): en **ambas** cuentas iniciá la **prueba Premium** en Cuenta; luego en el chat usá Permisos.

## Si algo falla

| Síntoma | Qué hacer |
|---------|-----------|
| No ves a la otra persona | Confirmar que ambos completaron perfil + intereses |
| “Conversación cerrada” | Que la otra acepte en Conexiones; luego reabrir Mensajes |
| Ya te enviaron interés | No reenviar: ir a Conexiones y aceptar |
| Fondo oscuro / logo viejo | Borrar datos del sitio en ese celular |

Google OAuth sigue **pausado**. Acceso solo con correo y contraseña.
