<!-- SPECKIT START -->
## Active feature: 013-user-settings

Plan técnico: [specs/013-user-settings/plan.md](specs/013-user-settings/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Convierte el shell vacío `/dashboard/settings` en un **panel de configuración real** con 4 secciones
nuevas (sin tocar las settings ya existentes de WhatsApp/Instagram/Calendario): **(1) Perfil** (todo
miembro): editar `user.name` + **avatar** por subida prefirmada a R2 (patrón de fotos 007, key en
`user.image`, presigned al render como `resolveMainPhotoUrls`); el riel pasa de iniciales a foto.
**(2) Seguridad** (todo miembro): cambiar contraseña (`authClient.changePassword`, revoke other
sessions) + **logout** (`authClient.signOut` — hoy inexistente en la UI). **(3) Organización** (solo
owner): editar `organization.name` + **logo** (misma subida). **(4) Equipo** (solo owner muta):
listar miembros + **invitar por email real** (`lib/mail` 011, best-effort → **degrada a enlace
copiable**), aceptar por ruta `/accept-invitation/[token]` (exige sesión + email coincidente,
idempotente), **cambiar rol** owner↔agent y **eliminar** miembro. **SIN MIGRACIÓN**: reutiliza las
tablas de Better Auth (`user`/`organization`/`member`/`invitation`); `invitation.id` = token; solo se
añaden prefijos `member`/`invitation` a `newId`. Endpoints propios `/api/team/*` con Drizzle directo
(NO el access-control del plugin) para controlar el **guardia de último-owner** (la org nunca queda
sin dueño), duplicados legibles y la degradación de email. Permisos: perfil/seguridad =
`requireMember`; organización/equipo = `requireOwner` (agente → 403). **FUERA DE ALCANCE:** reseteo
"olvidé contraseña" sin sesión, verificación de email, facturación, branding avanzado, y
reorganización visual de las settings existentes. **Cierre = self-test E2E** (editar nombre+avatar→
riel; cambiar contraseña→re-login; logout→login; owner edita agencia; invitar→aceptar→aparece;
rol; eliminar; camino infeliz: agente→403, único owner no se degrada/elimina, aislamiento de tenant,
contraseña incorrecta→legible, email ya miembro→legible, imagen inválida→422, email OFF→enlace
copiable). DV-US-1…12 en research.md.

## Feature previa: 012-whatsapp-templates

Plan técnico: [specs/012-whatsapp-templates/plan.md](specs/012-whatsapp-templates/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Convierte el registro local de plantillas (hoy solo metadata de plantillas ya aprobadas, sin estatus ni
sincronización) en una **sección de administración real** que habla directo con la **WhatsApp Business
Management API por agencia** (reusa `metaCredentials`: `wabaId` + token cifrado). **(1)** cliente de gestión
**en `lib/meta`** (sin frontera nueva; las plantillas son del canal WhatsApp): `createMessageTemplate`/
`listMessageTemplates`/`deleteMessageTemplate`/`getTemplateAnalytics` + Resumable Upload (`POST /{app_id}/
uploads`) para la imagen de muestra del header; token de la **agencia** (no el system user global). **(2)**
migración **aditiva 0011** que extiende `template` (`wa_template_id`, `status`/`category` como **text** no
enum —vocabulario externo evolutivo, espejo de `client.channel`—, `components` jsonb canónico, `rejected_reason`,
`quality_rating`, `last_synced_at`) + tabla `template_analytics` (caché **diaria** por plantilla). Estatus por
**doble vía**: webhook `message_template_status_update` (idempotente; **gotcha**: NO trae `phone_number_id` →
rutear por `entry.id`=waba_id, el handler actual lo descartaría → nueva `resolveOrgByWabaId`) **+** pull bajo
demanda `POST /api/templates/sync`. **(3)** sección `/templates`: builder práctico (categoría MARKETING/UTILITY/
AUTHENTICATION, header texto/imagen, body con variables `{{1}}` + **ejemplos obligatorios**, footer, botones
URL/quick-reply/call), badges de estatus + razón de rechazo, y **estadísticas** (enviados/entregados/leídos/
clics + **costo real** vía Analytics API, cacheadas; sin datos → degrada). **(4)** envío **manual con variables**
desde la bandeja (extiende `POST /api/conversations/[id]/messages/template`: valida APPROVED + nº variables,
construye `components`, renderiza el cuerpo en el hilo). Permisos: crear/eliminar/sincronizar/subir-muestra =
**owner**; ver + enviar = **member**. Degradación: token inválido → `reconnect_required` + marca
`metaCredentials.status=expired`; 5xx/sin-datos → no rompe UI; errores de Meta → mensaje **legible** sin
fantasmas. **FUERA DE ALCANCE (otra spec):** envíos AUTOMÁTICOS — recordatorio de visita al cliente, re-enganche
del agente fuera de 24 h, follow-ups (esta spec deja la base lista). **App Review** (`whatsapp_business_management`)
necesaria para producción; la **aprobación** la decide Meta (min–24 h) = pendiente de verificación humana/Meta.
**Cierre = self-test E2E**: crear→PENDING→(Meta aprueba)→APPROVED por sync/webhook→enviar con variables al
número de prueba→llega→stats reflejan envío/costo→eliminar; camino infeliz: token inválido degrada, nombre
duplicado/inválido→error legible, rechazada muestra razón, aislamiento de tenant, agente no puede gestionar
(403), analítica sin datos degrada, webhook idempotente. DV-WT-1…12 en research.md.

## Feature previa: 011-visit-scheduling

Plan técnico: [specs/011-visit-scheduling/plan.md](specs/011-visit-scheduling/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Vuelve **real** el agendamiento de visitas ("mini cal.com") para **agentes independientes** (cada `user`
tiene SU calendario; sin políticas de equipo todavía). Sobre la base existente (`showing` +
`createShowingFromAgent` + ancla `visit` del pipeline 010): **(1)** nueva tabla `calendar_settings` (1:1 por
usuario: horas hábiles por día, duración de slot, buffer, timezone default America/Mexico_City) + motor
`availability.ts` que calcula slots libres = horas hábiles − visitas Inmox − ocupado de Google. **(2)** el
agente IA **propone 2-3 slots concretos** (disponibilidad y visitas activas **inyectadas en el contexto**
como los `matches`; sigue single-shot JSON) y el servidor ejecuta `schedule_visit`/`reschedule_visit`/
`cancel_visit` (anti-alucinación: solo slots ofrecidos + `propertyId`/`showingId` reales + re-check). **(3)**
**Google Calendar OAuth bidireccional POR USUARIO**: frontera nueva `src/lib/google` (espejo de
`lib/instagram`: state HMAC, exchange/refresh por fetch, freeBusy + events) + tabla
`google_calendar_credentials` (access+refresh cifrados con `seal/open`); LECTURA freeBusy bloquea
disponibilidad, ESCRITURA crea/mueve/borra el evento (`showing.google_event_id`); token inválido →
`reconnect_required` + degradación a local. **(4)** **email al asesor** (frontera `src/lib/mail`, nodemailer
→ Gmail SMTP + App Password, remitente único temporal): confirmación al agendar/reprogramar/cancelar
(best-effort) + **recordatorio 1 h antes** vía cron `*/5` idempotente (`showing.reminder_email_sent_at`,
patrón `CRON_SECRET`). Migración **aditiva** `0009` (2 tablas + 3 columnas en `showing` + enum
`google_calendar_status`). Deps nuevas: `nodemailer`, `luxon`. **FUERA DE ALCANCE (solo cascarón):**
recordatorio al CLIENTE por plantilla de WhatsApp/llamada (otra spec); `showing.remind_at` (24 h) y el banner
de la lista quedan como placeholder. **Cierre = self-test E2E** (configurar horas → conectar Google → WhatsApp
real: agente propone slots/agenda → visita en /showings + evento en Google + email al asesor + recordatorio
1 h; camino infeliz: Google off degrada, slot ocupado no se ofrece, reprogramar mueve evento, cancelar lo
borra, token expirado→reconnect, aislamiento de usuario/tenant, no-JSON degrada). DV-VS-1…14 en research.md.

## Feature previa: 010-sales-pipeline

Plan técnico: [specs/010-sales-pipeline/plan.md](specs/010-sales-pipeline/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Vuelve **real** el pipeline de ventas (hoy `/pipeline` con `SAMPLE_LEADS`, cosmético) conectándolo a la
entidad existente **`candidacy`** (cliente+propiedad+etapa+agente, scoped por org). 4 mejoras del dueño
sobre ese cimiento: **(1) etapas configurables por agencia** — el `pgEnum candidacyStage` global pasa a
tabla nueva **`pipeline_stage`** (org-scoped, ordenada) y `candidacy.stage`→`stage_id` (FK), con backfill
seed-then-map de las 8 etapas actuales; anclas `kind` ∈ {won,lost,visit} **no eliminables** (renombrables);
solo `requireOwner` configura. **(2) drag-and-drop** con `@dnd-kit/core` (chevrons como fallback accesible)
+ arreglo de scroll. **(3) panel lateral** al abrir tarjeta (cliente+canal 009 / requisitos 004 / propiedad
007 / últimos mensajes) + **"Abrir en bandeja"** = deep-link `/inbox?c=` reusando `getOrCreateConversation`
(la bandeja sigue dueña de las reglas de canal/24h). **(4) asignación real** reusa `candidacy.assignedAgentId`
validando membresía. `candidacy.property_id` pasa a **nullable** (lead temprano sin propiedad). **Auto-alta
por inbound** (DV-SP-6): el primer inbound de un contacto auto-crea un trato sin-propiedad en la etapa
inicial (extiende `ingest.ts`) → todo contacto entra al pipeline (idempotente). **Regla de avance**
(DV-SP-8, resuelve F1): las automatizaciones (visita ahora; IA en 011) **solo avanzan**, nunca retroceden
solas; `showings/service.ts` pasa a `advanceStageForward` + promueve el trato sin-propiedad. El **movimiento
agéntico por IA** (modelo barato `gemini-2.5-flash-lite` + prompt de clasificación editable por agencia) se
**difiere a la feature 011**, que reutiliza las etapas configurables + la regla de avance de 010. ~7
endpoints `/api/pipeline`. **Cierre = self-test E2E conductual** (inbound→tarjeta en Nuevo→crear→mover/
persistir→configurar etapas como owner→abrir panel→asignar→agendar visita avanza) + camino infeliz
(aislamiento de tenant, reasignar a no-miembro→400, borrar etapa con tratos→409, borrar ancla→400, mover a
etapa inexistente→400, soltar fuera de columna, inbound repetido no duplica, visita no retrocede).
DV-SP-1…8 en research.md.

## Feature previa: 009-client-management

Plan técnico: [specs/009-client-management/plan.md](specs/009-client-management/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Vuelve **real** el módulo de contactos (hoy `/clients` con `SAMPLE_CLIENTS`, cosmético): listar desde BD
con scope de tenant, **crear** y **editar** contactos, **badge del canal de origen** sobre el avatar y un
atajo **"Enviar mensaje"** a la bandeja. Reusa la entidad `client`; añade **1 columna aditiva**
`client.channel` (`text`, no enum, extensible WhatsApp→IG/Messenger; backfill `'whatsapp'`). Completa el
**auto-alta** que ya existe en `src/server/inbox/ingest.ts` (registra canal + **enriquece sin
sobrescribir** lo editado a mano; `onConflictDoNothing`→`onConflictDoUpdate` idempotente). El botón
"Enviar mensaje" **no reimplementa reglas de canal**: resuelve la conversación (get-or-create, helper
compartido extraído de `ingest.ts`) y hace deep-link a `/inbox?c=<conversationId>`; **la bandeja** —única
dueña de la ventana 24h— decide texto libre vs. plantilla. ~5 endpoints bajo `/api/clients`. Todo scoped
por `organization_id` vía `requireMember()` (owner+agent). **Cierre = self-test E2E en vivo** (inbound del
número de prueba → contacto con badge WhatsApp; manual → "Enviar mensaje" → bandeja exige plantilla fuera
de ventana) + camino infeliz (teléfono duplicado→409, sin nombre de perfil, aislamiento de tenant).

Decisión del dueño (en la spec): "Enviar mensaje" SOLO redirige a la bandeja y ella decide las reglas de
canal. Defaults míos: badge neutro para manuales (canal de origen = primer toque real) · teléfono editable
con unicidad por org. DV-CM-1…7 en research.md.

## Feature previa: 008-instagram-integration

Plan técnico: [specs/008-instagram-integration/plan.md](specs/008-instagram-integration/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Añade **Instagram como segundo canal** ("Instagram API con Instagram Login", host
`graph.instagram.com`, sin Facebook Login). Cada tenant conecta SU cuenta IG vía OAuth y, en su
nombre, **publica** (compositor genérico + "Publicar propiedad" reusando fotos R2 de 007), **modera
comentarios** y **mensajea por DM** (recibir por webhook + responder en ventana 24h). Fase 1 = módulo
**aislado**: NO entra a la bandeja unificada ni lo opera el agente IA (operación manual). Frontera
nueva `src/lib/instagram` (espejo de `lib/meta` contra `graph.instagram.com`, tokens por-tenant, firma
con `IG_APP_SECRET` ≠ `META_APP_SECRET`); tabla nueva `instagram_credentials` (1:1 cifrada) +
`instagram_post`; **ruta proxy pública** `/api/public/media/[...key]` (token HMAC por objeto) para que
Meta descargue la imagen a publicar; cron `/api/cron/instagram-refresh` (token 60d). Reusa tal cual
`seal/open`, `verifyWebhookSignature(secret)`, `requireOwner`, `src/lib/storage`. ~11 endpoints nuevos.
**Cierre = self-test E2E en vivo** (conectar cuenta de prueba → publicar imagen real → comentar →
DM real en 24h + camino infeliz: firma inválida, token expirado→`reconnect_required`, ventana vencida).

Decisiones del dueño (antes de la spec): IG aislado sin agente · publicar = ambos modos · imagen vía
proxy público · hay cuenta IG de prueba para el self-test. DV-IG-1…9 en research.md.

## Feature previa: 007-property-management

Plan técnico: [specs/007-property-management/plan.md](specs/007-property-management/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Convierte `/properties` (hoy `SAMPLE_PROPERTIES` + botón "Nueva propiedad" cosmético) en el
**inventario real** del tenant: CRUD de propiedades, estatus rápido, **archivar/desarchivar**
(soft-delete reversible que preserva historial — columna aditiva `property.archived_at`, NO borrado
duro), detalle desplegable con **galería + CRUD de fotos** (subida directa prefirmada a R2 vía
`getUploadUrl`, reordenar, principal = menor `sortOrder`, eliminar) que por fin da fotos reales a la
ficha de 006, **match inverso** propiedad→clientes (reusa `scoreProperty` de
`src/server/matching/engine.ts` invirtiendo la entrada) y **edición manual** de `client_requirements`
(reusa `upsertRequirements(..., "manual")`). ~9 endpoints nuevos bajo `/api/properties` + `PUT
/api/clients/[id]/requirements`; todo scoped por `organization_id` vía `requireMember()` (owner+agent).
El matching directo de 004 también debe excluir archivadas. **Cierre = self-test E2E**
(crear→foto→estatus→archivar→match inverso + camino infeliz).

Decisiones del dueño (antes de la spec): fotos SÍ en alcance · quitar = archivar (no borrar) · match
inverso + requisitos manuales. DV en research.md (archived_at vs enum; PUT prefirmado vs proxy;
sortOrder vs is_main; reuso de scoring; reuso de upsertRequirements).

## Feature previa: 006-fichas-interactivas

Plan técnico: [specs/006-fichas-interactivas/plan.md](specs/006-fichas-interactivas/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

Convierte la ficha de propiedad en una **tarjeta real de WhatsApp** (foto + caption en UN solo
mensaje) y, en P2, con **botones** (Agendar visita / Hablar con asesor / Más fotos). Arregla el botón
"Enviar ficha" del panel, hoy cosmético (`handleSendFicha` solo inyecta burbuja local, no envía). Dos
emisores: botón manual (nuevo `POST /api/conversations/[id]/ficha`) y el `send_sheet` del agente (hoy
texto → tarjeta). Frontera `lib/meta`: añadir `buildImagePayload` (image+caption) + interactivo con
botones + tipos de entrada `button_reply`. Foto principal de R2 vía **URL prefirmada**
(`getDownloadUrl`); sin foto → degrada a texto. El **tap** entra por `ingest.ts` (idempotente por
`wa_message_id`) y se rutea en `buttons.ts`: botón id `<acción>:<propertyId>` → visit (reusa agendado
004) / handoff (reusa needs_human 005) / photos (hasta 5). Migración aditiva: `message.property_id`.
**Cierre = self-test** (tarjeta llega como UNA; botón dispara acción).

Decisiones del clarify: Agendar visita → pide fecha y agenda (agente cierra / asesor si off); botones
en **ambas** tarjetas (asesor y agente); Más fotos = hasta 5. SIN carrusel (descartado por el dueño).
Sibling pendiente: **agente multimodal** (entrada: STT/visión) sigue siendo feature futura.

Metodología: tras `implement` va un paso EXTRA de **auto-test** del comportamiento (ver memoria
`feedback-self-test-after-implement`).

Feature previa: [specs/005-robustez-agente/plan.md](specs/005-robustez-agente/plan.md)
(robustez del agente: ventana 24h, no-texto, ráfaga, fallo IA visible; enum `needs_human_reason` +
`message.wa_type`; desplegada en inmox-dev, pendiente self-test live + merge a main).

Feature previa: [specs/004-ai-agent-matching/plan.md](specs/004-ai-agent-matching/plan.md)
(agente IA conversacional + matching propiedad↔cliente; cerebro `deepseek/deepseek-v4-flash`,
matching `google/gemini-2.5-flash-lite`; tabla `client_requirements` + flags del agente).

Feature previa: [specs/003-design-system/plan.md](specs/003-design-system/plan.md)
(sistema de diseño: paleta papel, riel 66px, panel "Matching en vivo" — hoy con fixtures).

Base previa: [specs/001-realestate-whatsapp-crm/plan.md](specs/001-realestate-whatsapp-crm/plan.md)
(spec, research, data-model, contracts y quickstart en la misma carpeta).

CRM inmobiliario multi-tenant con WhatsApp como canal principal (renta y venta).

**Stack**: Next.js 15 (App Router) + TypeScript estricto (`strict` +
`noUncheckedIndexedAccess`) · Tailwind + shadcn/ui (modo claro) · Drizzle ORM +
PostgreSQL self-hosted · Better Auth (plugin `organization` = multi-tenancy,
roles owner/agent) · Zod en todo input externo · IDs `text` con prefijo (nanoid) ·
almacenamiento de objetos S3-compatible vía AWS SDK (R2 en MVP, portable a MinIO por
env vars) · WhatsApp Cloud API en `src/lib/meta` · pnpm · deploy en Coolify
(app + Postgres separados; migraciones por Pre-Deployment Command; healthcheck
`/api/health`).

**Reglas que vienen de la constitución v1.2.0** (gobierna todo):
- Secretos cifrados en reposo (token de Meta AES-256-GCM); nunca al cliente ni a logs.
- `organization_id` indexado en toda tabla de dominio; ninguna query sin scope de tenant.
- Webhooks de WhatsApp idempotentes: verificar firma `X-Hub-Signature-256` + dedup por
  `wa_message_id` (UNIQUE).
- Core self-hosted (auth + Postgres); almacenamiento de objetos solo vía interfaz S3
  estándar.
- "Hecho" = typecheck + lint + build (+ tests donde apliquen); lo no verificable se
  marca pendiente de verificación humana.
- Foco inmobiliario; el sistema NO genera contratos (solo almacena y rastrea estado).
- Orden de entrega: P1 comunicación → P2 dominio → P3 operación → P4 documentos.

Decisiones técnicas DV-1…DV-5 **resueltas** (research.md → "Decisiones resueltas"):
DV-1 bandeja por **polling tras una abstracción** (`lib/realtime`, websocket-ready);
DV-2 recordatorio de muestra **por WhatsApp con plantilla aprobada**; DV-3 tokens de
diseño extraídos en [design-tokens.md](specs/001-realestate-whatsapp-crm/design-tokens.md)
(Geist; teal venta / ámbar renta); DV-4 **modelo rico** (cliente 1:N conversaciones;
conversación M:N propiedades con principal); DV-5 estado "documentación" **manual**.
<!-- SPECKIT END -->

## Manejo de variables de entorno / credenciales (obligatorio)

Cuando necesite que el dueño provea **variables de entorno o credenciales** (API keys, OAuth client
id/secret, tokens, App Passwords, etc.), mi comportamiento por defecto es:
1. **Crear los placeholders directamente en `.env`** (append, sin tocar lo existente), con un marcador
   claro tipo `REEMPLAZA_...`.
2. Dejar **inline (comentarios `#` arriba de cada bloque)** una **guía breve y accionable** de cómo
   obtener cada valor (pasos numerados cortos: dónde dar clic, qué debe coincidir, p. ej. redirect URIs).
3. Resumir en 1-2 líneas en el chat y seguir; NO recitar las variables en el chat como única vía.

`.env` está gitignored (valores dummy para build/typecheck local). Recordar al dueño que para deploy las
vars también van en **Coolify** (runtime, `is_buildtime=false`).

## Definición de Hecho REFORZADA (obligatoria — sobrescribe el comportamiento por defecto)

"Typecheck + lint + build" es el piso, NO el techo. Una spec/feature **no está "Hecha"**
hasta que **yo (Claude) corra el self-test de COMPORTAMIENTO de punta a punta** y lo deje
verde. Prohibido delegar la prueba funcional al usuario o declarar "listo" pidiéndole que
confirme — si lo puedo manejar con mis herramientas, lo manejo yo.

Para CUALQUIER feature que toque el **agente IA / WhatsApp / bandeja / matching / envío
saliente / fichas**, antes de decir "Hecho" DEBO:
1. Invocar el skill **`whatsapp-ai-agent-selftest`** y conducir yo mismo una **conversación
   real multi-turno** desde el número de prueba (Evolution API, allowlist `…462…9768`) hacia
   el número de la plataforma — no una llamada aislada, el **flujo completo** (p. ej.
   calificar → matchear → `send_sheet`/ficha → tocar botones → handoff).
2. Verificar el **resultado observable** (la tarjeta llegó como UN mensaje con foto+botones;
   el tap disparó la acción; el agente no se calló), no solo que el endpoint devolvió 2xx.
3. Cubrir el **camino infeliz** que el LLM expone (formato no-JSON, respuesta vacía, fuera de
   ventana 24 h, no-texto): provocarlo y comprobar que **degrada sin colgarse**.
4. Si algo NO es verificable por mí (juicio visual humano, aprobación de Meta), marcarlo
   explícitamente como **pendiente de verificación humana** — eso es lo único que se delega.

Regla operativa: el **gotcha del LLM es impredecible** → todo turno del agente debe tolerar
formato/respuesta del modelo con extracción robusta + reintentos; un solo hipo del proveedor
**nunca** debe tumbar el turno ni marcar `ai_error` a la primera. Ver memorias
[[feedback-self-test-after-implement]] y [[project-ai-agent-matching]].

## Modo Objetivo — Loop SDD (cuando el dueño da una META, no prompts paso a paso)

Paradigma de trabajo (lo pidió el dueño): él define **objetivos** —qué debe lograr o cómo debe
comportarse el SaaS— y yo ejecuto el **loop completo de forma autónoma**, volviendo a él **solo
cuando el objetivo está verificado o estoy genuinamente bloqueado**. No le pido que me guíe paso
a paso, no le devuelvo trabajo a medio verificar, y no me detengo a pedir permiso por cada paso
reversible. Reemplaza el patrón `Ask→Answer→Stop` por `Goal→Work→Check→Repeat`.

El loop, mapeado a Spec Kit / SDD:
1. **Discover** — entiendo el estado real: leo spec/plan/tasks/código/memoria/logs. Si el
   objetivo es nuevo o ambiguo, `speckit-specify` + `speckit-clarify`. **Agrupo TODAS las
   preguntas bloqueantes y las hago de una sola vez al inicio** (no goteo de preguntas).
2. **Plan** — `speckit-plan` → `speckit-tasks` → `speckit-analyze`.
3. **Execute** — `speckit-implement` (yo construyo por tareas; el servidor ejecuta).
4. **Verify** — gate técnico (typecheck+lint+build) **Y** el self-test de COMPORTAMIENTO E2E de
   la "Definición de Hecho REFORZADA": despliego y ejerzo el flujo real + el camino infeliz.
5. **Iterate** — si Verify falla, diagnostico (logs, `raw=` del LLM), corrijo y **re-verifico yo**;
   repito hasta verde. Cada fix entra al loop, NO a la bandeja del dueño.

Sostén del loop (lo que el diagrama llama Memory/State/Verifier/Stop/Cost):
- **State** = los artefactos SDD (`spec.md`, `plan.md`, **`tasks.md`**): son mi estado durable;
  me dejan reanudar si se corta el contexto. Mantengo `tasks.md` al día (hecho/pendiente).
- **Memory** = el sistema de memoria: persisto decisiones, gotchas y correcciones para no repetir.
- **Verifier** = self-test E2E + gate + liveness del deploy. Sin verde **verificado por mí**, no
  está hecho.
- **Stop condition** — vuelvo al dueño SOLO cuando:
  - ✅ el objetivo cumple sus criterios de aceptación **en vivo**, con evidencia mía
    (transcripción / captura / log); o
  - ⛔ hay bloqueo real (y solo entonces interrumpo a mitad): (a) decisión de producto ambigua
    que cambia el resultado; (b) falta de credenciales/acceso; (c) **acción irreversible o hacia
    afuera** que exige su OK explícito (merge a `main`, borrado destructivo, enviar comunicación
    externa, gastar dinero/créditos de pago); (d) techo de costo/tiempo acordado. En un bloqueo
    traigo contexto + opciones + mi recomendación, no solo la pregunta.
- **Cost / disciplina** — no hago *spin* (no repito comandos en bucle ciego); los deploys son
  lentos (~8-15 min) → mientras avanzo en otra cosa o espero con criterio; agrupo verificaciones;
  no quemo créditos sin necesidad.

Invocable como **`/loop-sdd <objetivo>`** (skill `loop-sdd`), pero esta es mi forma de operar por
defecto siempre que el dueño plantee una meta en vez de un prompt.
