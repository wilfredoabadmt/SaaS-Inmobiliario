# Research & Decisiones — 012-whatsapp-templates

Decisiones técnicas (DV-WT-n) que resuelven los puntos de diseño antes de implementar. Formato:
**Decisión / Razón / Alternativas**. Las que dependen de Meta o de un humano se marcan como tales.

---

## DV-WT-1 — Extender la tabla `template` existente (aditivo) vs tabla nueva

**Decisión**: **Extender** la tabla `template` existente con columnas aditivas (ver data-model). NO se crea una
tabla nueva ni se borra la actual. Las filas previas (registros locales de plantillas "ya aprobadas") quedan
con `status = null` (= "no sincronizada") y `wa_template_id = null` hasta que el owner pulse **Sincronizar**,
que las reconcilia contra Meta por `name`+`language` (si existen en el WABA, adopta su id/estatus; si no, se
marcan como no encontradas para que el owner decida recrearlas).

**Razón**: Migración aditiva = patrón del proyecto (gotcha-drizzle-data-migration). Preserva los endpoints y
referencias existentes (`message.template_id`, selector de la bandeja). Evita doble fuente de verdad.

**Alternativas**: (a) Tabla nueva `wa_template` + deprecar la vieja → más migración y romper FKs existentes;
descartado. (b) Borrar y recrear → destructivo; descartado.

---

## DV-WT-2 — `status` y `category` como **text** con validación Zod (no `pgEnum`)

**Decisión**: `status` y `category` se almacenan como **text** (no enum de Postgres), validados a nivel de app
con Zod contra un conjunto conocido. Conjunto de estatus: `PENDING`, `APPROVED`, `REJECTED`, `PAUSED`,
`DISABLED`, `IN_APPEAL`, `PENDING_DELETION`, `DELETED`, `LIMIT_EXCEEDED` (más cualquiera futuro tratado como
"desconocido"). Categoría: `MARKETING`, `UTILITY`, `AUTHENTICATION`.

**Razón**: El vocabulario de estatus de WhatsApp **evoluciona** (Meta agrega estados). Un `pgEnum` exigiría
migración cada vez que Meta añade un valor y rompería si llega uno nuevo por webhook. Es exactamente la
decisión que ya tomó el proyecto para `client.channel` (text extensible, no enum). El UI agrupa estados en
badges (Aprobada / Rechazada / Pendiente / Pausada / Otro).

**Alternativas**: `pgEnum` → rígido frente a un vocabulario externo; descartado por la misma razón que channel.

---

## DV-WT-3 — Cliente de gestión en `lib/meta` con el **token de la agencia** (sin frontera nueva)

**Decisión**: Las llamadas a la Management API se implementan como funciones nuevas dentro de `src/lib/meta`
(no una frontera nueva), reutilizando `graphRequest`/`MetaApiError`, y usando el **token cifrado de la propia
agencia** (no `META_SYSTEM_USER_TOKEN`). Se extiende `credentials.ts` con `getManagementCredentials(org) →
{ wabaId, token }` (server-only; el token nunca sale del server).

Endpoints de Meta (Graph `v21.0`, ver contracts para shapes):
- Crear: `POST /{waba_id}/message_templates`
- Listar: `GET /{waba_id}/message_templates?fields=name,status,category,language,components,id,quality_score,rejected_reason&limit=100` (paginado por `paging.cursors.after`)
- Eliminar: `DELETE /{waba_id}/message_templates?name={name}` (todas las traducciones) o `&hsm_id={id}` para una específica
- Analítica: `GET /{waba_id}/template_analytics?...` (DV-WT-7)
- Subida de muestra: `POST /{app_id}/uploads` + sesión (DV-WT-5)

**Razón**: Las plantillas son del **canal WhatsApp**; pertenecen a la misma frontera que envío/recepción.
Crear `lib/whatsapp-templates` fragmentaría la integración. El token correcto es el del WABA de la agencia
(multi-tenant): el de Embedded Signup trae los scopes `whatsapp_business_messaging` **y**
`whatsapp_business_management`.

**Alternativas**: usar `META_SYSTEM_USER_TOKEN` global → rompe multi-tenant (gestionaría el WABA equivocado);
descartado. Frontera nueva → sobre-ingeniería; descartado.

---

## DV-WT-4 — Modelo canónico de componentes + variables **posicionales** `{{1}}`

**Decisión**: Definir un **modelo canónico interno** (TS + Zod, en `lib/meta/templates.ts`) que el builder
produce y que se traduce al `components[]` de Meta al crear, y se vuelve a parsear al sincronizar. Estructura:

```
header?: { format: "TEXT"|"IMAGE";  text?: string; example?: string /*texto*/ | handle /*imagen*/ }
body:    { text: string; variables: number; examples: string[] }   // {{1}}..{{n}}
footer?: { text: string }
buttons?: Array<{ type:"QUICK_REPLY"|"URL"|"PHONE_NUMBER"; text:string; url?:string; phoneNumber?:string }>
```

Variables = **posicionales** `{{1}}`, `{{2}}`, … (no named params). El número de variables del body debe
coincidir con `examples.length`; Meta **exige** `example.body_text` para aprobar.

**Razón**: Posicional es lo universal y lo que el envío desde la bandeja resuelve más simple (un array de
valores en orden). Named params son una capa extra que no aporta en v1. Guardar el modelo canónico en
`components` (jsonb) permite re-renderizar preview y enviar sin re-pedir a Meta.

**Alternativas**: named params (`{{nombre}}`) → requiere flag y más UI; diferido. Guardar el shape crudo de
Meta → menos legible para el render local; el canónico lo encapsula.

---

## DV-WT-5 — Header de imagen vía **Resumable Upload API** (handle de muestra)

**Decisión**: Para una plantilla con header de **imagen**, Meta exige un **handle de muestra** en
`components[].example.header_handle`. Se obtiene con la Resumable Upload API: `POST /{app_id}/uploads?
file_length=&file_type=` (con `META_APP_ID` + token de la agencia) → devuelve `upload:<id>`; luego
`POST /{upload_id}` con header `file_offset: 0` y los bytes → devuelve `{ h: "<handle>" }`. Ese `h` se pasa
como `header_handle`. Se expone como endpoint propio `POST /api/templates/upload-sample` (owner) que recibe la
imagen y devuelve el handle; el builder lo usa antes de crear.

La imagen de **muestra** NO se guarda en R2 (es solo para revisión). El envío real con header de imagen (link
dinámico) se resolverá cuando se use header de imagen en envíos automáticos (otra spec); en v1 el envío manual
desde la bandeja se enfoca en body+variables (el header de imagen estático se aprueba pero el envío con media
dinámica queda como mejora futura — documentado como límite).

**Razón**: Es el flujo oficial y obligatorio de Meta para headers de media. Aislarlo en un endpoint mantiene el
builder simple.

**Alternativas**: header solo de texto en v1 → el dueño pidió header imagen explícitamente; se incluye.
Subir a R2 y pasar URL → Meta no acepta URL para el ejemplo de header de plantilla, exige handle; descartado.

---

## DV-WT-6 — Sincronización de estatus: webhook (ruteado por **waba_id**) + pull bajo demanda, idempotente

**Decisión**: Dos vías complementarias:
1. **Webhook `message_template_status_update`** (push). **Gotcha**: este `change.value` **no** trae
   `metadata.phone_number_id` — el `entry.id` ES el **WABA id**. El handler actual (`webhooks/whatsapp/route.ts`)
   hace `if (!phoneNumberId) continue`, así que **hoy lo descartaría**. Se extiende: si
   `change.field === "message_template_status_update"`, resolver la org por **waba_id** (nueva
   `resolveOrgByWabaId`) y llamar `processTemplateStatusUpdate(orgId, value)`. El value trae
   `{ event, message_template_id, message_template_name, message_template_language, reason }`. Es **idempotente**
   por naturaleza (set de estatus: localizar por `wa_template_id`/`name+language` y aplicar el último estado +
   razón; re-procesar el mismo evento no cambia nada).
2. **Pull bajo demanda** (`POST /api/templates/sync`, owner): `GET /{waba_id}/message_templates` paginado →
   upsert de estatus/componentes/razón de todas las plantillas. Es la red de seguridad si el webhook no estaba
   suscrito o se perdió un evento.

**Razón**: El webhook da actualizaciones casi en vivo pero requiere suscripción del campo (quickstart) y puede
perderse; el pull garantiza reconciliación determinista. Idempotencia cumple Principio IV.

**Alternativas**: solo pull (polling/cron) → menos vivo y gasta llamadas; el webhook es gratis y push. Solo
webhook → frágil si no está suscrito. Se hacen ambos.

---

## DV-WT-7 — Estadísticas + **costo real** vía Analytics API, con caché diaria y degradación

**Decisión**: Métricas de uso por plantilla desde `GET /{waba_id}/template_analytics` con
`start`/`end` (epoch s), `granularity=DAILY`, `metric_types=[SENT,DELIVERED,READ,CLICKED]`,
`template_ids=[...]` (máx 10 por llamada). Devuelve series por plantilla y día. El **costo** real se obtiene de
la **Analytics de precios** (`GET /{waba_id}?fields=analytics(...)` / `pricing_analytics` con
`dimension TEMPLATE`) **cuando la cuenta lo expone**; si Meta no provee costo para el rango/cuenta (cuentas
nuevas, ventana de procesamiento, permiso insuficiente) se **degrada a "costo no disponible"** sin inventar
cifras (el dueño pidió costo real, no estimado). Resultados **cacheados** en `template_analytics` por
(plantilla, día) → cualquier rango se agrega sumando días; refresh **bajo demanda con TTL** (p. ej. 6 h) al
abrir la vista; sin cron en esta spec.

**Gotcha**: `template_analytics` requiere `whatsapp_business_management` y que la analítica esté **habilitada**
para el WABA; cuentas de prueba pueden devolver vacío → "sin datos todavía" (no error). Las métricas tienen
retraso de procesamiento.

**Razón**: Cumple "costo real" elegido por el dueño, con una degradación honesta cuando Meta aún no tiene datos.
Caché diaria es la unidad natural (granularidad mínima de Meta) y permite cualquier rango.

**Alternativas**: derivar conteos de la tabla `message` local + costo estimado → el dueño eligió Analytics API
real; descartado (pero queda como fallback documentado si Meta no expone nada). Cache por rango exacto → no
reutilizable entre rangos; descartado.

---

## DV-WT-8 — Permisos: gestión = **owner**; ver + enviar = **member**

**Decisión**: `POST/DELETE/sync/upload-sample` (crear, eliminar, sincronizar, subir muestra) exigen
**`requireOwner`**. `GET` (lista, analítica) y el envío de plantilla **aprobada** desde la bandeja exigen
**`requireMember`** (owner+agent). Reusa los guards existentes.

**Razón**: Las plantillas son configuración a nivel de la cuenta de WhatsApp Business de la agencia (afectan a
todos y tienen implicaciones de costo/políticas de Meta), igual que la config org-level del pipeline =
`requireOwner`. Pero un agente sí debe poder **operar** (enviar una plantilla aprobada a su cliente).

**Alternativas**: todo `requireMember` → un agente podría crear/borrar plantillas de la agencia; descartado.
Todo `requireOwner` → un agente no podría reactivar conversaciones fuera de 24 h; descartado.

---

## DV-WT-9 — Envío con variables desde la bandeja (extender el route existente)

**Decisión**: Extender `POST /api/conversations/[id]/messages/template` para aceptar, además de `templateId`,
un `variables` (array de strings posicional para el body, y opcionalmente valores de botones URL dinámicos si
los hubiera). El server: (a) valida que la plantilla esté **APPROVED** y pertenezca a la org; (b) valida que el
nº de `variables` = nº de variables del componente body; (c) construye `template.components` de Meta
(`{ type:"body", parameters:[{type:"text", text:v}] }`); (d) envía vía `graphRequest`; (e) **renderiza** el
cuerpo sustituyendo `{{i}}` por los valores y lo guarda en `message.body` (para el hilo) + `template_id`.

**Razón**: Reusa el envío existente; añade lo mínimo (variables). El selector de la bandeja ya filtra (DV-WT-8
+ queries que solo devuelven aprobadas). Render local del cuerpo da fidelidad en el hilo.

**Alternativas**: nuevo endpoint separado → duplicación; descartado. Enviar sin render local → el hilo
mostraría `{{1}}`; descartado.

---

## DV-WT-10 — Degradación: token inválido → `reconnect_required`; 5xx/sin datos → no rompe UI

**Decisión**: Toda llamada a Meta envuelve `MetaApiError`. Si el error es de autenticación (HTTP 401, o
`error.code` 190 / `type` OAuthException / subcódigos de token), el servicio marca
`metaCredentials.status = "expired"` y responde `{ error: { code: "reconnect_required" } }` (409). Otros
errores (4xx de validación → mensaje legible mapeado DV-WT-11; 5xx/timeout → "WhatsApp no disponible, intenta
de nuevo") **no** rompen la UI: las lecturas (lista/estatus) muestran el último estado local conocido y la
analítica vacía muestra "sin datos todavía".

**Razón**: Consistente con cómo 011 maneja Google (`reconnect_required` + degradación). El usuario nunca ve una
pantalla rota por un hipo de Meta. Cumple Principio I (no exponer detalles del token en el error).

**Alternativas**: propagar 500 → rompe la sección; descartado.

---

## DV-WT-11 — Mapeo de errores de Meta a mensajes legibles

**Decisión**: Al crear/eliminar, parsear el cuerpo de error de Meta (`error.error_user_msg`,
`error.error_user_title`, `error.message`, `error.code`/`error_subcode`) y devolver al cliente un **mensaje
legible** (p. ej. nombre duplicado → "Ya existe una plantilla con ese nombre"; formato inválido → el texto de
Meta; variable sin ejemplo → "Cada variable necesita un valor de ejemplo"). Nunca se expone el token ni trazas.
Si no hay registro creado en Meta, **no** se inserta fila local (sin fantasmas).

**Razón**: El dueño pidió "estatus aprobado/desaprobado" claro; los rechazos de creación deben ser accionables.

**Alternativas**: devolver el JSON crudo de Meta → confuso y arriesga filtrar detalles; descartado.

---

## DV-WT-12 — App Review / aprobación fuera de nuestro control (pendiente humano/Meta)

**Decisión**: Gestionar plantillas requiere el permiso **`whatsapp_business_management`**. En **dev/test**
funciona sobre el WABA de prueba con el token actual (que ya incluye el scope vía Embedded Signup). Para
**producción** se requiere **App Review** (gestionada por la skill `whatsapp-meta-app-review`; fuera del código
de esta feature). La **decisión de aprobar/rechazar** una plantilla y su **latencia** (minutos–24 h) las toma
Meta: en el self-test, el paso "queda APPROVED" se marca **pendiente de verificación humana/Meta**; el código
solo debe **reflejar** el resultado con fidelidad (vía webhook/sync).

**Razón**: Trazabilidad (Principio VII) + Definición de Hecho reforzada: lo no verificable por mí se marca
explícitamente.

**Verificación previa al build**: durante la implementación se comprueba con una llamada real
`GET /{waba_id}/message_templates` que el token de la agencia de prueba tiene el scope de gestión; si Meta
responde 403/permiso, es un **bloqueo de credenciales** que se reporta al dueño (no se simula).

---

## Resumen de gotchas (para no tropezar)

- El webhook `message_template_status_update` **no trae `phone_number_id`** → rutear por `entry.id` (waba_id),
  o se pierde (el handler actual lo descartaría).
- `template_analytics` y el costo requieren `whatsapp_business_management` + analítica habilitada; cuentas de
  prueba pueden devolver vacío → degradar a "sin datos".
- Header de imagen exige **handle** de Resumable Upload (no URL).
- `example.body_text` es **obligatorio** si el body tiene variables, o Meta rechaza la creación.
- Nombre de plantilla: `snake_case`, minúsculas, sin espacios; longitud y unicidad las valida Meta → mapear el
  error.
- El token correcto es el **de la agencia** (multi-tenant), no el system user global.
- Eliminar por `name` borra **todas** las traducciones; para una sola, usar `hsm_id`.
