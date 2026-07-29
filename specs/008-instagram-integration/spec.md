# Feature Specification: Integración de Instagram (Fase 1)

**Feature Branch**: `008-instagram-integration`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: integración de Instagram en Inmox usando "Instagram API con Instagram Login" (sin Facebook Login, sin Página de Facebook). Cada agencia (tenant) conecta SU cuenta de Instagram Business/Creator y, en su nombre, la plataforma puede **publicar** contenido, **moderar comentarios** y **mensajear por DM**. Fase 1 = módulo aislado (NO entra a la bandeja unificada ni lo atiende el agente IA).

---

## Resumen

Inmox hoy solo tiene WhatsApp como canal. Esta feature añade **Instagram como segundo canal** para que cada agencia inmobiliaria conecte su propia cuenta de Instagram y desde Inmox:

1. **Conecte** su cuenta de IG con un clic (OAuth "Business Login for Instagram"), igual de simple que conectar WhatsApp.
2. **Publique** contenido en su perfil: una imagen con descripción, ya sea libre (compositor) o **a partir de una propiedad de su inventario** (reusa las fotos de la feature 007).
3. **Modere** los comentarios de sus publicaciones: ver, responder, ocultar/borrar.
4. **Converse por DM**: reciba mensajes directos y responda dentro de la ventana de 24 h.

En esta fase Instagram es un **módulo independiente** con su propia pantalla; **no** se mezcla con la bandeja de WhatsApp ni lo opera el agente IA (eso queda para una fase futura). El humano (owner/agent) opera Instagram a mano.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conectar la cuenta de Instagram (Priority: P1)

El dueño de la agencia entra a **Configuración**, ve una tarjeta "Instagram" (espejo de la de WhatsApp) y pulsa **Conectar**. Inicia sesión con las credenciales de Instagram de su negocio, autoriza los permisos, y al volver a Inmox su cuenta aparece conectada mostrando su `@usuario`. A partir de ahí la agencia puede publicar, moderar y mensajear.

**Why this priority**: Sin conexión no existe ninguna otra capacidad. Es el cimiento del canal y entrega valor por sí solo (la agencia ve su cuenta vinculada y su estado de token).

**Independent Test**: Conectar una cuenta IG de prueba desde Configuración y verificar que queda guardada (usuario, id de IG, token cifrado, fecha de expiración) y que la tarjeta muestra "@usuario — conectado". Desconectar y verificar que vuelve al estado inicial.

**Acceptance Scenarios**:

1. **Given** una agencia sin Instagram conectado, **When** el dueño pulsa "Conectar" y completa el login de Instagram autorizando los permisos, **Then** vuelve a Configuración con la cuenta conectada mostrando su `@usuario` y el estado del token.
2. **Given** una agencia con Instagram conectado, **When** el dueño pulsa "Desconectar", **Then** la credencial se elimina y la tarjeta vuelve a ofrecer "Conectar".
3. **Given** un intento de conexión manipulado (parámetro anti-CSRF inválido o ausente), **When** vuelve el callback, **Then** la conexión se rechaza y no se guarda ninguna credencial.
4. **Given** dos agencias distintas, **When** cada una conecta su propia cuenta de IG, **Then** cada credencial queda aislada por tenant y una agencia nunca ve ni opera la cuenta de la otra.

---

### User Story 2 - Publicar una imagen (compositor y desde propiedad) (Priority: P1)

Con la cuenta conectada, el agente abre la sección de Instagram, redacta una publicación (sube una imagen + escribe una descripción) **o** elige "Publicar propiedad" y selecciona una propiedad del inventario: Inmox pre-rellena la foto principal y un texto base con los datos de la propiedad. Pulsa **Publicar** y el post aparece en el perfil real de Instagram.

**Why this priority**: Publicar es la razón principal por la que una inmobiliaria quiere Instagram: difundir su inventario. El modo "desde propiedad" conecta el canal con el dominio inmobiliario (Principio VIII).

**Independent Test**: Publicar una imagen por el compositor genérico y verla en el perfil; publicar una propiedad del inventario y verificar que el post lleva su foto principal y un caption derivado de la propiedad.

**Acceptance Scenarios**:

1. **Given** una cuenta conectada, **When** el agente sube una imagen + descripción y pulsa Publicar, **Then** la publicación aparece en el perfil de Instagram y Inmox confirma el éxito con el identificador del post.
2. **Given** una propiedad con al menos una foto, **When** el agente elige "Publicar propiedad" y selecciona esa propiedad, **Then** el compositor se pre-rellena con la foto principal y un caption derivado (p. ej. título, operación, precio, ubicación) que el agente puede editar antes de publicar.
3. **Given** una propiedad **sin** fotos, **When** el agente intenta "Publicar propiedad", **Then** Inmox lo impide con un mensaje claro (Instagram exige imagen).
4. **Given** que se alcanzó el límite diario de publicaciones de la cuenta, **When** el agente intenta publicar, **Then** Inmox muestra un mensaje claro de "límite alcanzado, intenta más tarde" en vez de fallar en silencio.

---

### User Story 3 - Moderar comentarios (Priority: P2)

El agente abre una publicación dentro de Inmox, ve la lista de comentarios (autor, texto, fecha), responde a un comentario, y puede **ocultar** o **borrar** un comentario inapropiado.

**Why this priority**: La moderación protege la reputación de la marca y fomenta el engagement, pero depende de que ya exista al menos una publicación (US2). Valiosa pero secundaria frente a conectar y publicar.

**Independent Test**: Sobre una publicación con comentarios, listar los comentarios, responder a uno (la respuesta aparece en Instagram) y ocultar otro (deja de ser visible públicamente).

**Acceptance Scenarios**:

1. **Given** una publicación con comentarios, **When** el agente abre sus comentarios en Inmox, **Then** ve la lista con autor, texto y fecha de cada uno.
2. **Given** un comentario, **When** el agente escribe una respuesta y la envía, **Then** la respuesta aparece publicada bajo ese comentario en Instagram.
3. **Given** un comentario inapropiado, **When** el agente lo oculta (o lo borra), **Then** deja de ser visible públicamente en la publicación.

---

### User Story 4 - Recibir y responder mensajes directos (Priority: P2)

Cuando un usuario de Instagram envía un DM a la cuenta de la agencia, el mensaje llega a Inmox (vía webhook) y el agente puede leer el hilo y responder dentro de la ventana de 24 h.

**Why this priority**: Los DMs convierten interés en conversación de venta/renta, pero en Fase 1 se operan a mano (sin agente IA), por lo que aportan valor pero no son el cimiento.

**Independent Test**: Enviar un DM real desde otra cuenta de Instagram a la cuenta de prueba, verificar que aparece en Inmox enrutado a la agencia correcta, y responderlo dentro de las 24 h verificando que la respuesta llega al usuario.

**Acceptance Scenarios**:

1. **Given** una cuenta conectada, **When** un usuario de IG le envía un DM, **Then** el mensaje aparece en Inmox asociado a la agencia dueña de esa cuenta.
2. **Given** un DM recibido hace menos de 24 h, **When** el agente responde, **Then** la respuesta se entrega al usuario en Instagram.
3. **Given** un DM cuya ventana de 24 h ya expiró, **When** el agente intenta responder con un mensaje normal, **Then** Inmox indica que la ventana expiró y no permite el envío estándar (sin colgarse).
4. **Given** que Instagram reenvía el mismo evento de mensaje más de una vez, **When** Inmox lo recibe, **Then** el mensaje no se duplica (procesamiento idempotente).

---

### User Story 5 - Renovación automática de tokens (Priority: P3)

El token de Instagram de cada agencia (60 días de vida) se renueva automáticamente antes de expirar, sin que nadie tenga que reconectar manualmente. Si por algún motivo un token expira o se invalida, la tarjeta de Configuración muestra "Reconectar".

**Why this priority**: Mantiene el canal vivo a largo plazo, pero no se nota en el día 1; es resiliencia operativa, no una capacidad visible inmediata.

**Independent Test**: Simular un token próximo a expirar y verificar que el proceso de renovación lo extiende y actualiza su fecha de expiración; simular un token inválido y verificar que la cuenta queda marcada como "reconectar".

**Acceptance Scenarios**:

1. **Given** un token al que le quedan menos de ~7 días de vida, **When** corre la renovación periódica, **Then** el token se extiende y su fecha de expiración se actualiza.
2. **Given** un token ya inválido/expirado, **When** la plataforma intenta usarlo o renovarlo, **Then** la cuenta se marca como "reconectar" y la Configuración invita a reconectar; ninguna otra agencia se ve afectada.

---

### Edge Cases

- **Anti-CSRF**: un callback de OAuth sin el parámetro de estado válido (o caducado) se rechaza sin guardar nada.
- **Firma de webhook inválida**: un POST al webhook cuya firma no valida contra el secreto del producto Instagram se rechaza (no se procesa).
- **Webhook de cuenta desconocida**: un evento cuyo `id de IG` no mapea a ninguna agencia se descarta con registro, sin error.
- **Reintentos de webhook**: el mismo evento entregado varias veces no duplica mensajes ni comentarios.
- **Propiedad sin foto** al "Publicar propiedad": se impide con mensaje claro.
- **Límite diario de publicaciones** de la cuenta alcanzado: mensaje claro, sin fallo silencioso.
- **Imagen no accesible**: si la imagen a publicar no puede servirse públicamente, la publicación falla con mensaje claro y no deja un post a medias.
- **Token expirado a mitad de operación** (publicar/comentar/DM): la operación falla con mensaje claro y la cuenta se marca "reconectar".
- **Ventana de 24 h vencida** para DM: el envío estándar se bloquea con aviso.
- **Aislamiento multi-tenant**: ninguna operación de IG (publicar, comentar, DM, ver hilos) puede tocar la cuenta o los datos de otra agencia.

---

## Requirements *(mandatory)*

### Functional Requirements

**Conexión y credenciales**

- **FR-001**: El sistema MUST permitir a una agencia (rol owner) conectar su cuenta de Instagram Business/Creator mediante el flujo OAuth "Business Login for Instagram", sin requerir Página de Facebook.
- **FR-002**: El sistema MUST proteger el inicio del flujo OAuth con un parámetro de estado anti-CSRF asociado al tenant, y MUST rechazar cualquier callback cuyo estado no valide.
- **FR-003**: El sistema MUST intercambiar el código de autorización por un token de larga duración (60 días) y obtener el identificador de la cuenta (`id de IG`) y el `@usuario`.
- **FR-004**: El sistema MUST almacenar la credencial de Instagram **cifrada en reposo**, scoped por `organization_id`, con una relación 1:1 por agencia, y MUST registrar la fecha de expiración del token.
- **FR-005**: El sistema MUST suscribir la cuenta conectada a los eventos de webhook necesarios (mensajes y comentarios) como parte del proceso de conexión.
- **FR-006**: El sistema MUST permitir a la agencia **desconectar** su cuenta, eliminando la credencial almacenada.
- **FR-007**: El sistema MUST mostrar en Configuración el estado de la conexión (`@usuario`, conectado / reconectar) en una tarjeta análoga a la de WhatsApp; el acceso queda restringido a owner.
- **FR-008**: Las credenciales, tokens y secretos de Instagram NUNCA MUST exponerse al cliente ni escribirse en logs.

**Publicación**

- **FR-009**: El sistema MUST permitir publicar una imagen con descripción en el perfil de Instagram de la agencia conectada (compositor genérico).
- **FR-010**: El sistema MUST permitir publicar **a partir de una propiedad** del inventario (feature 007), pre-rellenando la foto principal y un caption derivado de los datos de la propiedad, editable antes de publicar.
- **FR-011**: El sistema MUST servir la imagen a publicar mediante una URL **accesible públicamente** por los servidores de Instagram, sin exponer otros objetos del tenant ni requerir sesión.
- **FR-012**: El sistema MUST impedir "Publicar propiedad" cuando la propiedad no tiene fotos, con un mensaje claro.
- **FR-013**: El sistema MUST informar de forma clara cuando no se pueda publicar por límite diario de la cuenta o por imagen inaccesible, sin dejar publicaciones a medias.
- **FR-014**: El diseño MUST dejar **preparada** (sin entregar en esta fase) la publicación de reels/carrusel/stories; la prueba de Fase 1 es solo imagen.

**Comentarios**

- **FR-015**: El sistema MUST listar los comentarios de una publicación con autor, texto y fecha.
- **FR-016**: El sistema MUST permitir responder a un comentario.
- **FR-017**: El sistema MUST permitir ocultar y/o borrar un comentario.

**Mensajería (DM)**

- **FR-018**: El sistema MUST recibir DMs entrantes vía webhook y asociarlos a la agencia dueña de la cuenta destino.
- **FR-019**: El sistema MUST permitir leer el hilo de conversación y enviar una respuesta dentro de la ventana de 24 h.
- **FR-020**: El sistema MUST impedir el envío estándar fuera de la ventana de 24 h, indicándolo claramente (sin colgarse).

**Webhooks**

- **FR-021**: El sistema MUST responder el handshake de verificación del webhook (comparando el token de verificación esperado).
- **FR-022**: El sistema MUST validar la firma de cada evento entrante contra el secreto del producto Instagram y rechazar los que no validen.
- **FR-023**: El sistema MUST procesar los eventos de webhook de forma **idempotente** (un evento repetido no duplica efectos).
- **FR-024**: El sistema MUST enrutar cada evento a la agencia correcta usando el `id de IG` de la cuenta, y descartar con registro los eventos de cuentas no mapeadas.

**Renovación de tokens**

- **FR-025**: El sistema MUST renovar automáticamente, de forma periódica, los tokens próximos a expirar (umbral ~7 días) y actualizar su fecha de expiración.
- **FR-026**: El sistema MUST marcar como "reconectar" cualquier cuenta cuyo token sea inválido o no se pueda renovar, sin afectar a otras agencias.
- **FR-027**: El proceso de renovación periódica MUST estar protegido contra invocación no autorizada.

**Multi-tenant y aislamiento**

- **FR-028**: Toda operación de Instagram (publicar, comentar, DM, ver hilos, credenciales) MUST estar scoped por `organization_id`; ninguna agencia MUST poder ver ni operar la cuenta o los datos de otra.

### Key Entities *(include if feature involves data)*

- **Credencial de Instagram**: representa la conexión de una agencia con su cuenta de IG. Atributos: agencia (tenant, 1:1), identificador de la cuenta de IG (único, usado para enrutar webhooks), `@usuario`, token de acceso cifrado + metadatos de cifrado, fecha de expiración del token, estado (conectado / desconectado / expirado / reconectar), fecha de conexión.
- **Publicación de Instagram (registro local)**: representa un post creado desde Inmox. Atributos: agencia, identificador del post en Instagram, referencia opcional a la propiedad de origen, descripción usada, fecha. (Permite listar/relacionar comentarios y trazar qué propiedad se publicó.)
- **Comentario (vista efímera)**: autor, texto, fecha, identificador; se obtiene en vivo de Instagram para moderar (no necesariamente se persiste).
- **Mensaje directo (DM) entrante**: remitente (identificador de usuario de IG), texto, fecha, identificador de evento (para idempotencia), agencia destino.
- **Token de estado OAuth**: valor anti-CSRF temporal asociado al tenant que inicia la conexión.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una agencia puede conectar su cuenta de Instagram desde Configuración en menos de 2 minutos y, al terminar, ve su `@usuario` y el estado del token; la credencial queda guardada cifrada.
- **SC-002**: Una agencia puede publicar una imagen (por compositor y desde una propiedad) y verla en su perfil real de Instagram; el post desde propiedad muestra la foto principal y un caption derivado de esa propiedad.
- **SC-003**: Una agencia puede listar los comentarios de una publicación, responder al menos uno (la respuesta aparece en Instagram) y ocultar otro (deja de ser visible).
- **SC-004**: Una agencia recibe un DM en Inmox y lo responde dentro de la ventana de 24 h con entrega confirmada al usuario.
- **SC-005**: El 100% de los eventos de webhook con firma inválida se rechazan, y ningún evento se enruta a una agencia que no sea la dueña de la cuenta.
- **SC-006**: Un evento de webhook repetido no produce mensajes ni comentarios duplicados (0 duplicados observables).
- **SC-007**: Un token próximo a expirar se renueva automáticamente antes de la fecha de expiración; un token inválido deja la cuenta marcada como "reconectar" sin afectar a otras agencias.
- **SC-008**: Ninguna acción de una agencia puede observar ni modificar la cuenta o los datos de Instagram de otra agencia (aislamiento multi-tenant verificable).
- **SC-009** *(camino infeliz)*: Ante firma inválida, token expirado, imagen inaccesible, propiedad sin foto o ventana de 24 h vencida, el sistema degrada con un mensaje claro y **nunca** se cuelga ni deja un estado a medias.

---

## Assumptions

- **Cuenta de prueba disponible**: el dueño tiene una cuenta de Instagram Business/Creator de prueba lista para conectar, y la app de Meta está en estado **Live** con webhook alcanzable, de modo que el self-test E2E en vivo (publicar imagen real, recibir/responder DM real) lo conduce Claude. Lo no verificable por Claude (juicio visual humano, aprobaciones de Meta) se marca pendiente de verificación humana.
- **Reuso de infraestructura existente**: se reutiliza el cifrado at-rest, la frontera de integración externa, el guard multi-tenant (owner/agent) y el almacenamiento de objetos S3 ya presentes en Inmox.
- **Tabla de credenciales nueva e independiente**: la credencial de Instagram NO reutiliza la tabla de WhatsApp (que es específica de WhatsApp); se crea una entidad propia 1:1 por agencia.
- **Secreto del producto Instagram independiente**: Instagram usa su propio identificador de app y su propio secreto (distintos de los de WhatsApp) para firmar webhooks e intercambiar tokens.
- **Imagen pública vía proxy de la propia app**: como el almacenamiento de objetos entrega URLs firmadas de vida corta y el bucket no es público, la imagen a publicar se expone mediante una ruta pública propia (con token firmado de vida media) que sirve solo el objeto solicitado.
- **Renovación periódica vía tarea programada externa**: al no existir aún un mecanismo de cron en la plataforma, la renovación se dispara mediante una tarea programada (a nivel de despliegue) contra un endpoint protegido por secreto.
- **Operación manual en Fase 1**: comentarios y DMs los opera un humano (owner/agent); el agente IA y la bandeja unificada quedan **fuera de alcance** en esta fase.
- **Pasos manuales de configuración en Meta**: registrar la URL de redirección de OAuth (caso de uso Instagram → inicio de sesión empresarial) y el callback + token de verificación del webhook se hacen manualmente en el App Dashboard de Meta; se documentarán en el quickstart.
- **Permisos**: conectar/desconectar lo realiza el rol owner; publicar/moderar/mensajear lo pueden realizar owner y agent.

---

## Out of Scope (fases futuras)

- Cablear Instagram al **agente IA** y a la **bandeja unificada** (auto-respuesta, matching, handoff sobre DMs/comentarios de IG).
- **Facebook Page + Messenger** como canal.
- **Insights / hashtag search** y el camino con **Facebook Login** (no soportados por Instagram Login).
- Publicación de **reels / carrusel / stories** en producción (solo se deja el diseño preparado).
- Persistencia/archivado histórico completo de conversaciones de DM al estilo de la bandeja de WhatsApp.

---

## Dependencies

- Feature **007-property-management** (inventario de propiedades + fotos en R2) para el modo "Publicar propiedad".
- Infraestructura existente: cifrado at-rest, frontera de integración Meta, guard multi-tenant, almacenamiento de objetos S3.
- App de Meta **Live** con el producto Instagram configurado, cuenta de prueba conectable, y los pasos manuales del App Dashboard completados.
