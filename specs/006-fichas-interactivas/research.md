# Research — Fichas interactivas por WhatsApp (006)

Decisiones técnicas (Principio VII). Formato: **Decisión · Razón · Alternativas descartadas**.

---

## Verificación contra documentación de Meta (2026-06-20)

Se verificó el diseño contra la doc del WhatsApp Cloud API (las páginas oficiales de Meta son SPAs y no
renderizan por fetch; se confirmó con el SDK oficial de Meta en GitHub Pages y docs de BSPs —
messengerpeople, 8x8, cm.com, ycloud, 360dialog). Resultados:

- ✅ **Mensaje de imagen** (`type:"image"`): acepta `image.link` (URL hospedada) **y** `caption`
  → la URL prefirmada de R2 sirve (FC-1). Caption hasta ~1024 chars.
- ✅ **Header de imagen en interactivo** (`header:{type:"image",image:{link}}`): acepta **`link`**
  (no obliga a `id` de media subida) → **no hace falta subir la foto a Meta** (confirma FC-5; el punto
  de mayor riesgo queda despejado). Meta también acepta `id`, pero `link` es válido.
- ✅ **Límites de botones**: máx **3** reply buttons, `title` ≤ **20** chars, `body` ≤ **1024** chars
  → nuestros títulos ("Agendar visita" 14, "Hablar con asesor" 17, "Más fotos" 9) caben.
- ✅ **Webhook del tap**: `messages[].type:"interactive"`, `interactive.type:"button_reply"`,
  `interactive.button_reply.{id,title}` → confirma FC-4. Leemos `button_reply.id` (lleva
  `<acción>:<propertyId>`); `title` es solo la etiqueta visible.
- ⚠️ **Gotcha (dos formas distintas de "tap")**: un botón **interactivo** (el nuestro) llega como
  `type:"interactive"` con `interactive.button_reply`. NO confundir con el botón **quick-reply de una
  plantilla**, que llega como `type:"button"` con `button:{text,payload}`. Debemos manejar la forma
  **interactive/button_reply**; la de plantilla no aplica en v1.

---

## FC-1 — Tarjeta con foto = mensaje `image` con caption (un solo mensaje)

- **Decisión**: Para P1, enviar la ficha como un mensaje de WhatsApp Cloud API
  `{ messaging_product, to, type:"image", image:{ link:<URL>, caption:<texto ficha> } }`. La foto y el
  texto van en **el mismo mensaje** (FR-001).
- **Razón**: Es el camino nativo de la Cloud API para "foto + texto" en una burbuja; cumple
  exactamente lo pedido (no dos mensajes). El caption admite ~1024 chars y `*negrita*`/`_itálica_`.
- **Alternativas descartadas**: *imagen y texto por separado* (dos mensajes; explícitamente no
  deseado). *Solo texto* (es el estado actual que se quiere superar).

## FC-2 — Tarjeta con botones = mensaje `interactive` (header imagen + body + reply buttons)

- **Decisión**: Para P2, enviar `type:"interactive"`, `interactive:{ type:"button",
  header:{ type:"image", image:{ link } }, body:{ text:<caption> }, action:{ buttons:[...] } }` con
  **hasta 3** `reply` buttons. Es **un solo mensaje** (foto + texto + botones). Cuando la feature
  llega a P2, la tarjeta por defecto pasa a ser esta (los botones van en la del asesor y la del
  agente, por el clarify).
- **Razón**: Único mensaje que combina foto, texto y acciones de un toque; los botones se apoyan en
  capacidades existentes (agendar 004, handoff 005).
- **Alternativas descartadas**: *Listas interactivas* (más de 3 opciones / menú) — fuera de v1.
  *Plantillas de marketing con botones* — requieren aprobación y son para fuera de ventana (no aplica
  aquí; fuera de ventana se sigue la regla de 005).

## FC-3 — Codificación del botón: `<acción>:<propertyId>`

- **Decisión**: El `id` de cada reply button codifica la acción y la propiedad:
  `visit:<propertyId>`, `handoff:<propertyId>`, `photos:<propertyId>`. El `title` visible (es-MX,
  ≤20 chars): "Agendar visita" (14), "Hablar con asesor" (17), "Más fotos" (9).
- **Razón**: Al recibir el tap, el sistema sabe **qué acción** y **a qué propiedad** sin estado
  externo (FR-007). El id admite hasta 256 chars; un `prop_…` cabe sobrado.
- **Alternativas descartadas**: *Guardar el contexto en BD por mensaje y resolver por id de mensaje*
  — más estado; el id autoportante es suficiente y robusto.

## FC-4 — Recibir el tap: webhook entrante `interactive` / `button_reply`

- **Decisión**: Extender los tipos de `lib/meta` para el entrante: `message.type === "interactive"`
  con `message.interactive.type === "button_reply"` y `message.interactive.button_reply.{id,title}`.
  En `ingest.ts`: persistir el entrante (con `wa_type:"interactive"`, `body`= título del botón para la
  bandeja) y, si es nuevo (idempotente por `wa_message_id`), **rutear** vía `buttons.ts` en `after()`.
- **Razón**: El tap es un mensaje entrante más; reusa el gate insert-nuevo + UNIQUE (idempotencia,
  FR-011) y el patrón `after()`. Mostrar el título en la bandeja deja rastro de lo que tocó el cliente.
- **Verificado (2026-06-20)**: la forma correcta es `type:"interactive"` →
  `interactive.button_reply.{id,title}`. NO es `type:"button"`/`button.payload` (esa es de botones de
  **plantilla**, no de mensajes interactivos). El parser debe ramificar por `msg.type==="interactive"`.
- **Alternativas descartadas**: *Procesar el tap fuera del flujo de ingest* — rompería la idempotencia
  unificada y el rastro en el hilo.

## FC-5 — Foto principal y "Más fotos" desde R2 (URL prefirmada)

- **Decisión**: La **foto principal** = `property_photo` del tenant con menor `sortOrder` (luego
  `createdAt`). Para cada foto se genera una **URL prefirmada** con `storage.getDownloadUrl(storageKey)`
  y se pasa como `image.link`. "Más fotos" = las siguientes por orden, **hasta 5**, cada una como un
  mensaje `image`.
- **Razón**: Reusa el almacenamiento existente por la interfaz S3 estándar; Meta descarga la imagen al
  enviar (la URL ~15 min basta). Sin subir nada nuevo.
- **Alternativas descartadas**: *Subir media a Meta y usar media id* (round-trip + estado por imagen).
  *Servir las fotos por una ruta propia* (reinventar el presigned que ya existe).

## FC-6 — Botón manual: endpoint `POST /api/conversations/[id]/ficha`

- **Decisión**: Nuevo endpoint `POST { propertyId }` con `requireMember` (scope de tenant): valida que
  la propiedad sea del tenant, envía la tarjeta (FC-1/FC-2) y persiste el saliente con `property_id`.
  `handleSendFicha` en `inbox-client.tsx` **llama a este endpoint** (y deja que el poll de tiempo real
  muestre el mensaje) en vez de inyectar una burbuja local.
- **Razón**: Arregla el bug raíz (el botón no enviaba). Mantiene el patrón de los endpoints de
  conversación (auth + tenant).
- **Alternativas descartadas**: *Reusar `POST /messages`* — ese endpoint es de texto; una ruta
  dedicada de ficha es más clara y valida la propiedad.

## FC-7 — Persistencia: `message.property_id` (aditivo)

- **Decisión**: Añadir `message.property_id` (text, nullable, FK a `property`). La tarjeta saliente lo
  guarda; el `GET /messages` hace join a `property` + foto principal para renderizar la **burbuja de
  ficha** (kind `property`) en el hilo (diseño 003).
- **Razón**: Una columna aditiva habilita el render de la tarjeta en la bandeja del asesor sin
  reinterpretar el texto. El histórico queda con `property_id = null` (compatible).
- **Alternativas descartadas**: *No persistir y mostrar solo texto* (pierde la tarjeta en la vista del
  asesor). *Tabla nueva* (sobra para v1).

## FC-8 — Ruteo de acciones de botón (deterministas, agente-agnóstico)

- **Decisión** (`buttons.ts`):
  - **`visit`**: vincular la propiedad a la conversación (principal) y enviar un prompt determinista
    "¿Qué día y hora te acomoda para visitar *<título>*?". Con el **agente activo**, su acción
    `schedule_visit` (004, `createShowingFromAgent`) cierra la cita cuando el cliente da la fecha; con
    el agente **off**, la conversación queda señalada (atención humana) para que el asesor agende.
  - **`handoff`**: `needs_human=true`, `needs_human_reason='requested'` (reusa 005) + confirmación
    "Con gusto te paso con un asesor 🙌".
  - **`photos`**: enviar hasta 5 fotos adicionales; si no hay más, avisar.
  - Todas validan que `propertyId` sea del tenant; corren con o sin agente (FR-012).
- **Razón**: Cada botón reusa una capacidad existente; el agendado real con fecha se apoya en el agente
  (su fuerte) o en el asesor, sin inventar parsing de fechas determinista.
- **Alternativas descartadas**: *Agendar una visita sin hora al tocar* (deja `showing` inconsistentes;
  `scheduledAt` es obligatorio). *Parsear la fecha sin IA* (frágil).

## FC-9 — Ventana de 24 h y degradación

- **Decisión**: Antes de enviar la tarjeta (manual o agente), verificar la ventana con
  `isServiceWindowOpen` (005). Fuera de ventana: el agente ya no envía (guard de 005); el endpoint
  manual responde con un error claro ("fuera de la ventana de 24 h: usa una plantilla") — como ya hace
  el `POST /messages` ante 131047. Sin foto → degradar a la ficha de **texto** actual.
- **Razón**: Coherencia con 005 (no enviar libre fuera de ventana) y robustez (sin foto no se rompe).
- **Alternativas descartadas**: *Intentar y mapear el error de Meta* (se mantiene como respaldo, pero
  se previene con el check).

## FC-10 — Self-test

- **Decisión**: `scripts/wa-tester/ficha-card.mjs`: activa el agente/abre la conversación de prueba,
  dispara el envío de una ficha (vía el endpoint manual) y verifica que el saliente quedó con
  `property_id` y tipo imagen/interactivo; para el tap, documenta enviar el `button_reply` (vía
  Evolution si soporta interactivos, o manual desde el teléfono) y verifica la acción (visita/handoff/
  fotos). Reusa el guardrail de allowlist.
- **Razón**: El cierre es comportamiento real (metodología). El envío de la tarjeta es verificable
  desde el SaaS; el tap puede requerir tocar el botón en el teléfono (Evolution no siempre emite
  button_reply), lo que se marca como verificación humana.
- **Alternativas descartadas**: *Solo typecheck/lint/build* (no demuestra la tarjeta ni el tap).

---

## Resumen de decisiones

| ID | Tema | Decisión |
|----|------|----------|
| FC-1 | Tarjeta foto | mensaje `image` con caption (un solo mensaje) |
| FC-2 | Botones | `interactive` con header imagen + body + ≤3 reply buttons (un mensaje) |
| FC-3 | Encoding botón | id `<acción>:<propertyId>` (visit/handoff/photos) |
| FC-4 | Recibir tap | webhook `interactive/button_reply`, persistir + rutear, idempotente |
| FC-5 | Fotos | foto principal = menor sortOrder; URL prefirmada R2; "más fotos" ≤5 |
| FC-6 | Botón manual | `POST /api/conversations/[id]/ficha {propertyId}`; cablear handleSendFicha |
| FC-7 | Datos | `message.property_id` aditivo (render de ficha en el hilo) |
| FC-8 | Ruteo | visit→agendar(004), handoff→needs_human(005), photos→hasta 5 |
| FC-9 | Ventana/degradación | check 24h (005); sin foto → texto |
| FC-10 | Self-test | enviar tarjeta + tocar botón (tap puede ser verificación humana) |
