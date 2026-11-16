**DOCUMENTO DE PLANEACIÓN · VERSIÓN 1.0 · CONSERVADO COMO HISTORIAL**

La versión vigente es `ZUNELA_Documento_Maestro_v1_1.md` (5 de noviembre de 2026). Conserva este alcance y agrega la arquitectura de agentes OpenAI, todavía planificada y apagada en el producto.

**ZUNELA**

**Conecta con tu gente.**

Plataforma de afinidades, oportunidades y comunidades

> **PROPÓSITO:** Ayudar a las personas a encontrar aliados, conocimientos, comunidades y oportunidades compatibles con sus intereses y objetivos.

Alcance inicial: Colombia \| Producto: plataforma web instalable (PWA) \| Estado: definición funcional

Nombre de trabajo: ZUNELA (con Z). Pendiente verificación jurídica, dominio y presencia comercial.

*Documento de referencia para análisis, diseño, desarrollo y validación del MVP.*

31 de octubre de 2026

# Control del documento

| **Campo**                     | **Definición**                                                      |
|-------------------------------|---------------------------------------------------------------------|
| Proyecto                      | ZUNELA — Conexiones por afinidad, oportunidades y comunidades       |
| Versión                       | 1.0 — Base funcional inicial                                        |
| Estado                        | Borrador de trabajo consolidado a partir de decisiones del promotor |
| Cobertura                     | Colombia inicialmente; evolución internacional y multilingüe        |
| Canal principal               | Aplicación web responsive / PWA                                     |
| Nombre comercial              | ZUNELA, provisional, sujeto a revisión de marcas y dominios         |
| Modelo                        | Freemium + prueba Premium de 10 días + suscripción mensual/anual    |
| Objetivo de la primera prueba | Validar con una comunidad piloto de aproximadamente 50–100 usuarios |

## Decisiones ya aprobadas

- La plataforma cubre negocios, conocimientos, actividades y hobbies, con orientación comercial y profesional.

- Los usuarios descubren perfiles, oportunidades y comunidades; el vínculo entre personas requiere interés y aceptación recíprocos.

- El usuario gratuito participa en oportunidades preexistentes; la creación de oportunidades propias es Premium.

- Las comunidades pueden ser públicas, privadas o por invitación; las dos últimas corresponden a Premium.

- El usuario gratuito tendrá un cupo parametrizable para crear comunidades públicas; Premium contempla creación ilimitada sujeta a controles de abuso.

- Los datos de contacto estarán ocultos; su intercambio requiere permiso explícito del titular y acceso según plan.

- La verificación de identidad/facial es opcional y se distingue de la reputación.

- El asistente y la búsqueda avanzada con IA son funciones Premium previstas para una fase posterior al MVP.

## Aspectos todavía configurables o pendientes

Tarifas finales, cupos, límites de chat, política de moderación detallada, umbrales de afinidad, proveedor de pago, proveedor biométrico, proveedor de IA y condiciones definitivas del programa de prueba.

# 1. Visión estratégica

## 1.1 Problema que resuelve

Encontrar a la persona correcta para un objetivo concreto suele depender de grupos dispersos, contactos personales y publicaciones poco estructuradas. ZUNELA organiza intenciones, capacidades e intereses para facilitar descubrimiento y colaboración con reglas claras de confianza.

## 1.2 Propuesta de valor

ZUNELA permite decir “qué busco”, “qué puedo aportar” y “con quién quiero conectar”. A partir de esa información, recomienda perfiles, oportunidades existentes y comunidades relacionadas; posteriormente propondrá círculos basados en coincidencias significativas.

## 1.3 Principios de producto

- Objetivo antes que popularidad: priorizar coincidencias útiles, no solo interacción superficial.

- Comunidad además de persona: la unidad de valor incluye círculos, comunidades y oportunidades.

- Consentimiento y privacidad por diseño, sin presión para divulgar contactos.

- Crecimiento gradual: primero validar la interacción núcleo; después pagar, IA y expansión internacional.

- Reglas transparentes de reputación, moderación y beneficios Premium.

# 2. Público objetivo y casos de uso

Usuarios iniciales: emprendedores, vendedores, networkers, empresarios, profesionales, estudiantes, personas que buscan ingresos adicionales y cualquier persona interesada en colaborar, aprender o realizar actividades grupales.

| **Caso**      | **Ejemplo de intención**                                      | **Resultado deseado**              |
|---------------|---------------------------------------------------------------|------------------------------------|
| Socios        | “Busco persona con habilidades comerciales para mi proyecto.” | Match y conversación               |
| Equipos       | “Quiero integrarme a un equipo de ventas.”                    | Unirse a oportunidad existente     |
| Conocimiento  | “Busco comunidad para aprender IA aplicada a negocios.”       | Comunidad y recursos               |
| Colaboradores | “Necesito apoyo con diseño, tecnología o mercadeo.”           | Coincidencia por complementariedad |
| Actividad     | “Quiero organizar senderismo con personas afines.”            | Círculo o comunidad                |
| Mentoría      | “Quiero encontrar profesionales que compartan experiencia.”   | Contacto consensuado               |

La experiencia inicial será nacional en Colombia, con filtros por ciudad, departamento, remoto o alcance nacional. La expansión posterior incorporará idiomas, zonas horarias, moneda y normas locales.

# 3. Experiencia principal del usuario

## 3.1 Recorrido del MVP

1. Registro y aceptación de políticas.

2. Configuración del perfil: nombre visible, foto, profesión, ciudad y privacidad.

3. Selección de intereses, objetivos, habilidades, ofertas y disponibilidad.

4. Descubrimiento de personas, comunidades públicas y oportunidades del catálogo.

5. Expresión de interés y aceptación recíproca para abrir un match individual.

6. Entrada a comunidades según visibilidad y reglas; conversaciones internas con moderación.

7. Evaluación de la experiencia, reportes y seguimiento de actividad.

## 3.2 Perfil de afinidad

Campos propuestos: identificador interno, nombre legal protegido, nombre público configurable, foto o avatar, profesión, ciudad, país, presentación, intereses, objetivos (busco), aportes (ofrezco), conocimientos, habilidades, modalidad presencial/remota, alcance geográfico y preferencias de notificación.

La visibilidad se controla por campo y contexto: perfil público, antes del match, después del match y datos compartidos expresamente. Teléfono y correo no se muestran por defecto.

## 3.3 Descubrimiento

La interfaz permitirá buscar por categorías, explorar tarjetas y filtrar por ubicación, intereses, tipo de objetivo y modalidad. Las recomendaciones mostrarán razones comprensibles: “comparten dos intereses” o “sus habilidades se complementan”.

# 4. Roles y permisos

| **Rol**         | **Responsabilidades**                                                                                                                   |
|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| Visitante       | Conocer presentación pública; registrarse; sin acceso a datos privados.                                                                 |
| Usuario Gratis  | Descubrir, solicitar match, entrar a oportunidades del catálogo, crear comunidades públicas dentro de cuota, conversar con límites.     |
| Usuario Premium | Beneficios Gratis + crear oportunidades propias, comunidades privadas/por invitación, límites ampliados, IA Premium cuando esté activa. |
| Moderador       | Gestionar reportes y contenidos de acuerdo con privilegios específicos y registro de acciones.                                          |
| Administrador   | Configurar catálogos, planes, límites, reglas, seguridad, parámetros y auditoría.                                                       |

## 4.1 Matriz comercial de acceso propuesta

| **Capacidad**                          | **Gratis**         | **Premium**               |
|----------------------------------------|--------------------|---------------------------|
| Perfil, intereses y descubrimiento     | Sí                 | Sí                        |
| Match recíproco                        | Sí                 | Sí                        |
| Participar en oportunidades existentes | Sí                 | Sí                        |
| Crear una oportunidad propia           | No                 | Sí                        |
| Crear comunidades públicas             | Cuota configurable | Sin cupo comercial fijo\* |
| Comunidades privadas/por invitación    | No                 | Sí                        |
| Chat interno                           | Con límites        | Límites ampliados         |
| Compartir datos externos               | No                 | Con permiso del titular   |
| Recomendaciones básicas                | Sí                 | Sí                        |
| Búsqueda/asistencia avanzada de IA     | No                 | Sí, fase posterior        |

**Nota:** “Sin cupo comercial fijo” no exime de límites técnicos, prevención de abuso y restricciones por seguridad. La tabla es una configuración inicial, modificable por el panel.

# 5. Módulos funcionales

## M01 — Identidad y acceso

Registro, autenticación, recuperación de acceso, permisos, consentimiento, cierre de sesión y eliminación/desactivación de cuenta.

## M02 — Perfiles e intereses

Campos visibles/privados, fotos, intereses múltiples, habilidades, objetivos, ciudad, disponibilidad y preferencias.

## M03 — Motor de afinidad

Puntuación explicable y recomendaciones por coincidencia y complementariedad; filtros y límites para evitar duplicados.

## M04 — Match y conexiones

Interés/solicitud, aceptación, rechazo, retiro, bloqueo, historial y notificaciones; chat individual después del match.

## M05 — Oportunidades

Catálogo administrado, categorías, fichas, filtros, postulaciones/interés, propietarios Premium y estados de moderación.

## M06 — Comunidades y círculos

Comunidad pública/privada/por invitación, roles, cupos, solicitud de acceso, publicación y chat; sugerencias de círculo posteriores.

## M07 — Mensajería y moderación

Chats individuales y comunitarios, restricción de contactos/enlaces, reportes, bloqueo, rate limiting y registro de incidentes.

## M08 — Reputación y verificación

Calificaciones justificadas, antigüedad, comportamiento, indicadores verificables, verificación opcional y apelaciones.

## M09 — Planes y pagos

Prueba Premium, cuotas parametrizables, suscripción mensual/anual, renovaciones, cambios de plan, cancelación y comprobantes.

## M10 — Administración y analítica

Catálogo de intereses, parámetros, moderación, usuarios, oportunidades, métricas y bitácora de cambios.

## M11 — Asistente IA (posterior)

Búsqueda natural, recomendaciones explicadas, mejora de oportunidad, sugerencia de comunidades y eventual traducción.

# 6. Reglas de negocio

- RB-01: un usuario puede elegir varios intereses, objetivos y habilidades; el catálogo es administrable y ampliable.

- RB-02: un match individual se confirma cuando ambas partes expresan interés o aceptan la solicitud; ningún match habilita por sí solo divulgación de datos privados.

- RB-03: el usuario Gratis podrá seleccionar o participar en oportunidades existentes, pero no publicar oportunidades propias.

- RB-04: la publicación de nuevas oportunidades requiere plan Premium activo y moderación de contenido cuando corresponda.

- RB-05: el usuario Gratis creará comunidades públicas con cupo por período configurable; el valor inicial se decidirá antes de programar.

- RB-06: comunidades privadas y por invitación requieren permiso Premium; las comunidades públicas estarán sujetas a normas generales.

- RB-07: Premium contempla comunidades sin límite comercial predeterminado, sujetas a límites de seguridad, calidad y uso justo.

- RB-08: teléfono, correo, identificadores sociales y enlaces estarán restringidos en chats según reglas administrables; la moderación no garantiza detección perfecta.

- RB-09: compartir un contacto externo requiere consentimiento afirmativo del titular y elegibilidad según plan; se permitirá revocarlo.

- RB-10: la calificación de reputación no penalizará automáticamente al usuario por no usar verificación biométrica.

- RB-11: la insignia “Identidad verificada” solo aparecerá tras completar satisfactoriamente el método aprobado.

- RB-12: al terminar los 10 días de prueba, sin suscripción elegida, la cuenta volverá a Gratis sin cargo automático.

- RB-13: todas las cuotas, límites, planes y umbrales se administrarán por parámetros versionados y auditables.

- RB-14: en cada comunidad los usuarios podrán reportar contenido, bloquear personas y apelar decisiones según políticas.

- RB-15: se evitará recomendar comunidades privadas o datos de miembros sin respetar permisos y visibilidad.

- RB-16: las recomendaciones de círculos serán propuestas optativas, no grupos privados creados automáticamente con personas no consentidoras.

# 7. Afinidad, match y círculos

## 7.1 Puntuación inicial (hipótesis de diseño)

Modelo de reglas simple, auditable y sin IA generativa en el MVP. La puntuación preliminar puede ponderar intereses compartidos (30 %), compatibilidad de objetivos (30 %), habilidades complementarias (20 %), modalidad/alcance (15 %) y disponibilidad (5 %). Los pesos son experimentales y se ajustarán tras medir resultados.

No debe interpretarse como probabilidad objetiva de éxito comercial o personal. La interfaz explicará por qué se recomienda una coincidencia.

## 7.2 Ciclo de match

Estados sugeridos: sugerido → interés enviado → interés mutuo / aceptado → conexión activa → bloqueado, rechazado o cerrado. Una invitación expirada no debe reactivarse sin nueva acción.

## 7.3 Círculos sugeridos (posterior)

El sistema agrupará señales anónimas de compatibilidad por objetivo, categoría o ubicación, y sugerirá crear un círculo si hay usuarios elegibles suficientes. Cada persona elegirá entrar; no se revelará información de terceros durante la sugerencia.

# 8. Privacidad, confianza y moderación

## 8.1 Datos personales y controles

- Minimización: pedir solo los datos necesarios para el servicio y justificar cada campo.

- Roles y permisos de lectura: no exponer correo/teléfono en las respuestas del servidor si el usuario no tiene autorización.

- Preferencias por campo: nombre visible, fotografía, profesión, ciudad, intereses y contactos.

- Seguridad: contraseña con proveedor confiable, autenticación robusta, sesiones con expiración, cifrado en tránsito y control de accesos.

- Derechos del titular: acceso, corrección, retiro del consentimiento, desactivación y solicitudes de eliminación según normativa aplicable.

- Retención: períodos documentados por categoría; especial atención a chat, denuncias, registros de seguridad y documentos de verificación.

## 8.2 Verificación de identidad

La verificación facial será opcional y debe implementarse únicamente después de evaluar necesidad, proporcionalidad, alternativa no biométrica, proveedor, consentimiento específico y protección de datos sensibles. No retener biometría directamente si no es necesario.

## 8.3 Contenido comercial sensible

Se admitirán categorías como multinivel, venta directa, afiliados, inmobiliario y oportunidades comerciales bajo reglas de transparencia. Se prohibirá el fraude, la suplantación, el spam, las promesas engañosas de ingresos y las solicitudes abusivas. Las ofertas de inversión deberán pasar controles legales y de moderación adicionales antes de habilitarse.

Se realizarán revisiones legales específicas para Colombia antes del lanzamiento comercial, particularmente en protección de datos, consumo digital, publicidad, pagos recurrentes y operación de servicios intermediados.

# 9. Modelo conceptual de datos

| **Entidad**                    | **Campos orientativos y relaciones**                                                   |
|--------------------------------|----------------------------------------------------------------------------------------|
| Usuario / Perfil               | usuario_id, nombre_legal, nombre_visible, ciudad, profesión, flags_visibilidad, estado |
| Interés / Habilidad / Objetivo | catálogo_id, nombre, categoría, activo; relaciones N:M con perfil                      |
| Oportunidad                    | oportunidad_id, creador_id, categoría, título, descripción, tipo, estado, visibilidad  |
| Participación en oportunidad   | usuario_id, oportunidad_id, rol_interés, estado, fecha                                 |
| Comunidad                      | comunidad_id, creador_id, tipo_acceso, reglas, cupo, estado                            |
| Miembro de comunidad           | usuario_id, comunidad_id, rol, estado, fecha                                           |
| Conexión / Match               | usuarios vinculados, interés de cada parte, estado, fecha                              |
| Mensaje / Conversación         | conversación_id, autor_id, tipo, texto permitido, moderación, fecha                    |
| Plan / Suscripción             | plan_id, suscripción_id, periodo, estado, prueba, proveedor, fechas                    |
| Calificación / Verificación    | autor, destinatario, evento validado, estado, método opcional                          |
| Reporte / Auditoría            | actor, objetivo, categoría, decisión, timestamp, motivo                                |
| Configuración                  | clave, valor, ámbito, vigencia, modificador, historial                                 |

Modelo de alto nivel; la base de datos definitiva requiere normalización, claves, índices, política de borrado y controles de acceso a nivel de fila.

# 10. Arquitectura tecnológica propuesta

Candidata inicial: aplicación web responsive/PWA con Next.js, backend de servicios y PostgreSQL; Supabase u otra solución gestionada puede acelerar autenticación, almacenamiento y mensajes en tiempo real. La decisión definitiva depende de costos, residencia de datos, políticas de seguridad y operación.

- Frontend PWA: registro, perfil, descubrimiento, match, comunidad, mensajes, suscripción y administración.

- Backend/API: autorizaciones por rol y plan, parámetros, reglas de match, moderación y registro auditable.

- Base de datos relacional: perfiles, catálogos, comunidades, conexiones, planes, reportes.

- Tiempo real: chat con permisos antes de entregar mensajes y límites por usuario.

- Archivos: fotografías, evidencias y medios sujetos a acceso y retención.

- Servicios futuros desacoplados: pasarela de pagos, proveedor de verificación e IA.

## 10.1 Requisitos no funcionales

- Disponible en móvil y escritorio; accesibilidad básica y buena conectividad en redes móviles.

- Alto nivel de privacidad: ninguna filtración de datos restringidos por endpoints, búsquedas o logs.

- Respaldos automatizados y restauración probada antes del piloto abierto.

- Telemetría sin contenido sensible en registros de actividad.

- Versionado de configuraciones y documentación de cambios.

- Preparación para varios idiomas desde el modelo y la interfaz, aunque el MVP salga en español.

# 11. Pantallas esenciales del MVP

| **Pantalla**                   | **Función principal**                                       |
|--------------------------------|-------------------------------------------------------------|
| 01\. Bienvenida / acceso       | Explicar valor, registro, ingreso y consentimiento.         |
| 02\. Configuración de perfil   | Foto, nombre público, ciudad, profesión, privacidad.        |
| 03\. Mis intereses / objetivos | Selección múltiple, búsqueda y preferencias.                |
| 04\. Descubrir                 | Tarjetas de personas, oportunidades, comunidades y filtros. |
| 05\. Perfil público            | Información autorizada y botón de interés.                  |
| 06\. Detalle de oportunidad    | Categoría, objetivo, creador, reglas y participación.       |
| 07\. Comunidades               | Exploración, miembros, acceso, publicaciones y chat.        |
| 08\. Mis matches               | Solicitudes, aceptaciones y conexiones vigentes.            |
| 09\. Mensajes                  | Chat sujeto a permisos, reportes y límites.                 |
| 10\. Mi cuenta                 | Notificaciones, privacidad, seguridad y membresía.          |
| 11\. Administración            | Usuarios, catálogos, reportes y parámetros.                 |

# 12. Hoja de ruta de desarrollo

| **Fase**              | **Entregables**                                                                                           | **Validación**                                 |
|-----------------------|-----------------------------------------------------------------------------------------------------------|------------------------------------------------|
| Fase 0 — Diseño       | Nombre provisional, reglas, prototipos, modelo de datos, matriz de permisos.                              | Flujos revisados y backlog priorizado.         |
| Fase 1 — MVP          | Perfiles, afinidad básica, match, catálogo de oportunidades, comunidades públicas, chat moderado y admin. | Piloto controlado 50–100 usuarios.             |
| Fase 2 — Negocio      | Planes, prueba 10 días, pagos, comunidades privadas y publicaciones Premium.                              | Conversión, cobros, cancelaciones y seguridad. |
| Fase 3 — Confianza/IA | Reputación, verificación opcional, IA Premium, círculos sugeridos.                                        | Adopción, precisión y costo por usuario.       |
| Fase 4 — Global       | Idiomas, traducción, monedas y regiones.                                                                  | Prueba en nuevo mercado.                       |

## 12.1 Métricas piloto

- Activación: porcentaje que completa perfil e intereses.

- Descubrimiento útil: usuarios que ven al menos una recomendación relevante.

- Match: tasa de interés recíproco y tiempo hasta primera conexión.

- Conversación: porcentaje de matches que intercambian mensajes válidos.

- Retención: regreso de usuarios a 7 y 30 días.

- Seguridad: reportes por usuarios activos, tiempos de atención y reincidencia.

- Futuro negocio: conversión de prueba, cancelaciones, ingresos y costo de IA.

# 13. Criterios mínimos de aceptación del MVP

- Un usuario puede registrarse y completar intereses/objetivos sin revelar información de contacto a terceros.

- Un usuario puede descubrir perfiles relevantes y verificar explicaciones de afinidad.

- Ninguna conversación privada se abre sin el estado de conexión exigido por la regla de match.

- El usuario Gratis puede participar en una oportunidad del catálogo pero no crear una nueva.

- Las cuotas de comunidades públicas se respetan incluso frente a intentos de acceso directo a API.

- El chat aplica reglas configurables, bloquea lo detectado y comunica los motivos; las incidencias pueden reportarse.

- El administrador puede suspender un usuario, moderar contenido, modificar parámetros y revisar auditoría.

- Los datos privados no aparecen por búsquedas públicas, perfil ajeno, APIs o notificaciones.

- Existe procedimiento de recuperación, bloqueo, eliminación y respaldo verificable.

- El piloto puede medirse con eventos de producto sin almacenar innecesariamente el contenido de las conversaciones.

# 14. Decisiones pendientes priorizadas

| **Prioridad** | **Decisión**                       | **Propuesta inicial**                                                                      |
|---------------|------------------------------------|--------------------------------------------------------------------------------------------|
| Alta          | Identidad de marca                 | ZUNELA provisional; consulta marcaria y dominios antes de registro.                        |
| Alta          | Cuota Gratis de comunidades        | Configurable: sugerencia inicial 1–2 por período.                                          |
| Alta          | Activación de oportunidad Gratis   | Participar/manifestar interés; definir si puede ofrecer un rol o habilidad dentro de ella. |
| Alta          | Qué hace visible el perfil         | Nombre público y ciudad; resto por controles de privacidad.                                |
| Alta          | Condiciones de chat                | Definir límites diarios, tipos de adjuntos y umbrales de moderación.                       |
| Alta          | Reglas de consentimiento contactos | Acceso solo con autorización explícita, registro y revocación.                             |
| Media         | Precios y suscripciones            | Determinar tarifa después de medir valor y costos.                                         |
| Media         | Reputación                         | Definir eventos calificables, reportes y mecanismos anti-manipulación.                     |
| Media         | IA Premium                         | Asignar casos de uso, límites de consumo, evaluación y costos.                             |
| Media         | Verificación opcional              | Diseñar procedimiento legal/técnico independiente del MVP.                                 |

# 15. Próximas acciones

1. Validar el nombre ZUNELA mediante investigación jurídica y comercial en los territorios prioritarios.

2. Cerrar parámetros de Gratis/Premium, términos de prueba y reglas de comunicación.

3. Producir historias de usuario y diagramas de interacción para cada módulo del MVP.

4. Diseñar wireframes de registro, perfil, descubrimiento, match, oportunidad y comunidad.

5. Aprobar el modelo lógico de datos, políticas de autorización y estructura base de la aplicación.

6. Implementar primero autenticación, perfiles e intereses; luego descubrimiento y match.

7. Realizar pruebas internas y piloto acotado antes de monetizar o implementar IA avanzada.

## Glosario breve

Afinidad: coincidencia de intereses/objetivos. Match: conexión aceptada por ambas partes. Oportunidad: propuesta de colaboración. Comunidad: espacio de interacción con reglas. Círculo: pequeño grupo afín. PWA: aplicación web instalable.

**ZUNELA · Documento vivo de producto**
