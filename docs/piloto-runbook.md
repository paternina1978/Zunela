# Runbook de piloto interno (Fase 1)

Guion para pruebas internas y piloto acotado (§12, §13, §15.7).  
**Local:** un navegador = un usuario; el catálogo demo no es multiusuario.  
**Remoto (Supabase):** dos cuentas reales (§2b); setup en [`supabase/README.md`](../supabase/README.md).

URL típica: `http://localhost:3001` (o el puerto de `next dev`).

## 0. Preparación

1. Abrir la app en Chromium (o Edge). Opcional: instalar PWA desde el aviso.
2. **Remoto:** aplicar `supabase/apply-all.sql` (o `001`–`017`), configurar `.env.local`, reiniciar dev.
3. Rol elevado: en local, Cuenta → activar administrador. Con Supabase: Cuenta → **Soy el primer administrador**
   (RPC `bootstrap_first_admin`, solo si no hay admin) o SQL en `supabase/bootstrap_admin.sql`. Sin auto-elevación después.
4. Revisar Admin → parámetros frente a `docs/parametros-mvp-decisiones.md`.
5. Abrir Admin → **Listo para piloto** (`pilot-checklist.ts`) y **Actividad del piloto**.

## 1. Guion usuario (checklist §13)

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| Acceso | Crear cuenta / ingresar | Sesión local; sin correo real. Offline bloquea el envío. |
| Perfil | Completar nombre, ciudad, visibilidad | Vista previa; correo oculto. |
| Intereses | Intereses + objetivos | Habilita Descubrir con razones. |
| Descubrir | Filtrar; enviar interés a persona | No abre chat solo. Ver ficha “yo-local”. |
| Conexiones | Aceptar / rechazar / retirar / bloquear | Bilaterales; rechazo no se reactiva solo. |
| Mensajes | Escribir solo con conexión activa | Cupo diario; RB-08 bloquea contacto/enlaces. |
| Contacto | Autorizar + aceptación de la otra parte | Local: simula bilateral. Remoto UUID: ambas cuentas deben autorizar. |
| Oportunidad | Postular en catálogo; opcional prueba Premium para crear | Crear → revisión → Admin aprueba. |
| Comunidad | Unirse / publicar / chat / reportar | Cupo de creación pública; apelación sin sanción auto. |
| Cuenta | Avisos, privacidad, respaldo v2, pausa | Restore recarga; borrar limpia el navegador. |
| Admin | Reportes, suspensiones, parámetros, bitácora | Moderador ≠ admin completo. |

Criterio: en Admin, ítems §13 en **ok** o **parcial** justificado (parcial típico = falta recorrer un flujo o falta multiusuario).

## 2. Protocolo “dos navegadores” (local / demo)

Para ensayar conexión / chat sin servidor:

1. **Navegador A** (perfil real): registro → perfil → intereses → interés a una persona del catálogo.
2. En A, Conexiones: aceptar solicitudes demo si aparecen en “Recibidas”; o usar el flujo de interés saliente.
3. Chat: abrir hilo con conexión activa. Contacto: usar el botón de simulación de aceptación.
4. **Navegador B** (perfil distinto / ventana privada): segunda cuenta local. **No comparte** datos con A.
5. Para probar respaldo: en A descargar respaldo v2 → en B (u otra sesión) restaurar y verificar huella.

No confundir dos cuentas locales con match real entre personas: el catálogo no es multiusuario.

## 2b. Protocolo multi-cuenta (Supabase)

Requiere `NEXT_PUBLIC_ZUNELA_BACKEND=supabase` + migraciones `001`–`018` (ver `supabase/apply-all.sql`).

| Paso | Acción | OK |
|------|--------|----|
| Setup | SQL aplicado + `.env.local` + `npm run dev` | [x] local Docker |
| A | Registro → perfil → intereses → **Soy el primer administrador** | [x] `admin@piloto.local` |
| B | Otro navegador: registro → perfil → intereses | [x] `userb@piloto.local` |
| Match | Interés mutuo → aceptar en Conexiones | [x] connection `accepted` |
| Chat | Mensaje con cupo; RB-08 bloquea contacto/enlaces | [x] `private_messages` OK |
| Aviso | La otra cuenta ve aviso sin correo/teléfono | [x] `notifications` match |
| Contacto | Ambas autorizan (solo prueba Premium si aplica) | [x] `contact_consents` bilateral |
| Suspender | A suspende a B → B no aparece en Descubrir; reactivar | [x] API admin |
| Admin | Parámetros o catálogo guardados; Actividad + Bitácora remotas | [x] UI `/admin`: Usuario Beta, reporte revisado, umbral 5, bitácora |

## 3. Moderación

1. Generar un reporte desde chat privado o comunidad.
2. Admin → reportes: marcar revisado; anotar SLA / tiempo medio si hay varios.
3. Publicación propia en revisión → Admitir / aprobar.
4. Apelación desde comunidad → revisar sin sanción automática.
5. Suspender un usuario (demo local o UUID remoto) y comprobar que no aparece en Descubrir.

## 4. Métricas (sin texto de chat)

- Eventos: `product-events` (Admin → Actividad del piloto).
- Presencia D7/D30: `pilot_presence` (remoto) o `pilot-presence` local.
- Respaldo / borrado / restauración dejan rastro en eventos.

No exportar cuerpos de chat; el respaldo v2 tampoco los incluye.

## 5. Offline / PWA

1. Cargar una pantalla; pasar a offline.
2. Lectura y respaldo siguen; botones de escritura muestran mensaje y quedan deshabilitados.
3. Volver online y reintentar.

## 6. Criterio de cierre de prueba interna (local)

- [ ] Recorrido 01–11 sin bloqueos.
- [ ] Checklist Admin revisado.
- [ ] Al menos un reporte moderado.
- [ ] Un respaldo v2 restaurado con éxito.
- [ ] IA sigue apagada / fail-closed.
- [ ] Acta de parámetros y modelo de datos leídos (`docs/`).

## 6b. Criterio de cierre operativo (Supabase)

- [x] `001`–`018` aplicados (`supabase start` local; `018` = copia/borrado remoto).
- [x] Auth + `.env.local` con `BACKEND=supabase` (Docker local).
- [x] Bootstrap del primer admin (RPC).
- [x] §2b completo en API/DB (match, aviso, chat, contacto, suspender, params).
- [x] Al menos un reporte moderado en remoto (`revisado`, sin sanción auto).
- [x] Panel Admin UI verificado (usuarios, roles, reportes, params v2, bitácora).
- [x] IA sigue apagada / fail-closed.
- [x] Sin service role en el cliente.

## 7. Después de este runbook

Con §2b y §6b OK: seguir [`piloto-50-100.md`](./piloto-50-100.md) (cloud + hosting).  
Antes de invitar: probar Cuenta → **Descargar copia** (RPC remoto) y borrado de una cuenta no-admin.  
No monetizar ni encender IA hasta cerrar esa capa.
