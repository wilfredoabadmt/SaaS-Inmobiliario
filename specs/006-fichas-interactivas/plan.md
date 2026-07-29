# Implementation Plan: Fichas de propiedad interactivas por WhatsApp

**Branch**: `006-fichas-interactivas` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-fichas-interactivas/spec.md`

## Summary

Convertir la ficha de propiedad en una **tarjeta real de WhatsApp** (foto + caption en un solo
mensaje) y, en un segundo nivel, con **botones** (Agendar visita / Hablar con asesor / Más fotos).
Aplica a los dos emisores: el **botón manual** del panel (hoy no envía nada) y la **acción del
agente** (hoy manda texto). Enfoque técnico:

- **Frontera Meta** (`src/lib/meta`): añadir el envío de **imagen con caption** (`type:"image"`,
  `image:{link,caption}`) y de **mensaje interactivo con botones** (`type:"interactive"` con header
  imagen + body + hasta 3 reply buttons), y los **tipos de entrada** del `button_reply`. La foto se
  pasa por **URL prefirmada de R2** (`getDownloadUrl`) que Meta descarga al enviar.
- **Envío de la ficha** (`src/server/inbox/ficha.ts`, nuevo): resuelve la **foto principal** del
  inventario del tenant, arma el caption (reusa `formatPropertySheet`) y envía la tarjeta; si no hay
  foto **degrada a texto**. Mismo helper para el botón manual y para el agente.
- **Botón manual**: nuevo endpoint `POST /api/conversations/[id]/ficha {propertyId}` (scope de
  tenant) que envía la tarjeta de verdad; `handleSendFicha` deja de inyectar una burbuja local y
  llama a este endpoint.
- **Agente** (`src/server/ai/agent.ts`): la acción `send_sheet` envía la **tarjeta** en vez de texto.
- **Tap de botón** (`src/server/inbox/ingest.ts` + `buttons.ts`, nuevo): el webhook entrante de tipo
  `interactive` (`button_reply`) se persiste (idempotente por `wa_message_id`) y se **rutea** por el
  id del botón (`<acción>:<propertyId>`): **Agendar visita** → pide fecha y agenda (reusa 004),
  **Hablar con asesor** → handoff (reusa 005), **Más fotos** → envía hasta 5 fotos.
- **Datos**: columna aditiva `message.property_id` (nullable) para enlazar la tarjeta a su propiedad
  y renderizarla como burbuja de ficha en el hilo (diseño 003).

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15
(App Router, `after()`), React 19.

**Primary Dependencies**: Sin dependencias nuevas. Reusa `src/lib/meta` (Cloud API), `src/lib/storage`
(`getDownloadUrl` = URL prefirmada S3/R2), Drizzle + PostgreSQL, Zod, el agendado de 004
(`createShowingFromAgent`) y el handoff de 005 (`needs_human`/`needs_human_reason`).

**Storage**: PostgreSQL self-hosted. **Migración aditiva**: `message.property_id` (text, nullable, FK a
`property`). Las fotos ya viven en R2 (`property_photo.storageKey`); no se suben imágenes nuevas.

**Testing**: typecheck + lint + build (Principio V) **+ self-test de comportamiento**: enviar una ficha
al número de prueba y verificar que llega como **una** tarjeta (foto + caption); tocar un botón y ver
la acción. Guardrail de allowlist de Evolution.

**Target Platform**: Web/servidor Next.js en Coolify. WhatsApp Cloud API como canal. Español MX.

**Project Type**: Web app monolítica (Next.js App Router, single project).

**Performance Goals**: La tarjeta sale en un solo mensaje; Meta descarga la foto desde la URL
prefirmada (expira ~15 min, suficiente para el envío). "Más fotos" envía hasta 5 imágenes.

**Constraints**: Tarjeta = **un solo mensaje** (no dos) (FR-001); sin foto → degradar a texto
(FR-004); **idempotencia** del tap por `wa_message_id` (FR-011); acciones de botón **deterministas**
aunque el agente esté off (FR-012); **ventana 24 h** (FR-013, reusa `isServiceWindowOpen` de 005);
aislamiento multi-tenant (FR-015); secretos fuera de cliente/logs (FR-016); sin contratos (FR-017).

**Scale/Scope**: Decenas a bajos cientos de propiedades por tenant, cada una con varias fotos. 1
columna nueva, ~3 helpers de envío (tarjeta, botones, más fotos), 1 endpoint nuevo, ruteo de 3
botones, cambios en `lib/meta`/`ingest`/`agent`/`messages route`/`inbox-client`.

## Constitution Check

*GATE: pasa antes de Fase 0; se re-evalúa tras Fase 1.*

| Principio | Aplica | Cumplimiento en esta feature |
|-----------|--------|------------------------------|
| I. Seguridad de Datos Primero | Sí | La URL prefirmada de R2 es temporal (no expone credenciales); el token de WhatsApp y las llaves S3 viven server-side, nunca al cliente ni a logs (FR-016). |
| II. Soberanía / Self-Hosted | Sí | Acceso a fotos por la **interfaz S3 estándar** (`getDownloadUrl`), portable a MinIO; WhatsApp sigue aislado tras `lib/meta`. No agrega terceros. |
| III. Multi-Tenancy Real | Sí (central) | `propertyId` (manual y de botón) se valida contra el tenant; fotos, propiedades, visitas y acciones, solo del tenant de la conversación (FR-005/015). |
| IV. Idempotencia | Sí (central) | El `button_reply` entra como mensaje normal y se deduplica con el UNIQUE `wa_message_id` + gate insert-nuevo; un reintento no repite la acción (FR-011/SC-006). |
| V. Calidad Verificable | Sí | "Hecho" = typecheck + lint + build **+ self-test** (tarjeta llega como una; botón dispara acción). |
| VI. Specs Antes de Código | Sí | spec.md (clarificado) precede a este plan; el código sigue a tasks. |
| VII. Trazabilidad | Sí | Decisiones FC-1…FC-10 en research.md; supuestos (foto principal, 5 fotos, botones en ambas) explícitos. |
| VIII. Foco Vertical Inmobiliario | Sí | La ficha/tarjeta y "Agendar visita" (crea un `showing`) son dominio inmobiliario puro; **no** genera contratos (FR-017). |

**Resultado**: PASS. Sin violaciones. La elección de **URL prefirmada** (vs subir media a Meta) se
registra en Complexity Tracking como decisión, no como desviación.

**Re-evaluación post-Fase 1**: PASS — el diseño mantiene scope de tenant, idempotencia del tap,
migración aditiva, secretos server-side y reuso de 004/005. Sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/006-fichas-interactivas/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones FC-1…FC-10
├── data-model.md        # Fase 1: message.property_id + tarjeta + encoding de botón
├── quickstart.md        # Fase 1: verificación + self-test (tarjeta + botones)
├── contracts/
│   ├── requirements.md   # (ya existe) checklist de calidad del spec
│   └── fichas-interactivas.md  # Fase 1: contrato de envío de tarjeta + ruteo de button_reply
└── tasks.md             # Fase 2: /speckit-tasks (NO aquí)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── meta/index.ts                # MODIFICA: buildImagePayload + buildInteractiveButtonsPayload + tipos de entrada (interactive/button_reply) + tipos de salida (image/interactive)
│   ├── storage/index.ts             # LEE: getDownloadUrl(storageKey) → URL prefirmada de la foto
│   ├── db/schema/domain.ts          # MODIFICA: message.property_id (text, nullable, FK property)
│   └── inbox/types.ts               # (ya tiene kind:"property"/property; sin cambio o mínimo)
├── server/
│   ├── inbox/
│   │   ├── ficha.ts                 # NUEVO: resuelve foto principal + arma y envía la tarjeta (degrada a texto); enviar "más fotos"
│   │   ├── buttons.ts               # NUEVO: handleButtonReply → rutea visit/handoff/photos (reusa 004 y 005)
│   │   ├── send.ts                  # MODIFICA: helpers de payload de tarjeta/botones reutilizables; persistir property_id
│   │   ├── ingest.ts                # MODIFICA: msg.type === "interactive" → persistir + rutear button_reply (idempotente)
│   │   └── queries.ts               # (sin cambio o mínimo)
│   └── ai/agent.ts                  # MODIFICA: acción send_sheet → enviar tarjeta (no texto)
├── app/api/conversations/[id]/
│   ├── ficha/route.ts               # NUEVO: POST { propertyId } → envía la tarjeta (botón manual), scope de tenant
│   └── messages/route.ts            # MODIFICA: GET surte property_id + join de propiedad/foto → burbuja de ficha
└── components/inbox/
    └── inbox-client.tsx             # MODIFICA: handleSendFicha llama a POST /ficha (envío real) en vez de inyectar burbuja local

drizzle/                              # NUEVO: migración aditiva (message.property_id)
scripts/wa-tester/
└── ficha-card.mjs                   # NUEVO: self-test — enviar tarjeta + tocar un botón
```

**Structure Decision**: Web app monolítica de Next.js. La capacidad de "media + interactivo" se
concentra en `src/lib/meta` (frontera) y el dominio de la ficha en `src/server/inbox/{ficha,buttons}`.
La UI reutiliza la burbuja de ficha de 003. **No se toca** auth ni el contrato del webhook (firma/
idempotencia se preservan; el `button_reply` entra por el mismo camino idempotente que el texto).

## Decisiones de alcance y trazabilidad (Principio VII)

- **Tarjeta = un solo mensaje** (clarify/FR-001): imagen+caption (P1) o interactivo con header imagen +
  body + botones (P2). Nunca dos mensajes.
- **Botones en ambas tarjetas** (asesor y agente) (clarify). Sin foto + botones → interactivo sin
  header de imagen (solo body + botones); sin foto y sin P2 → texto.
- **Agendar visita** (clarify): el botón pide fecha; con agente activo, su `schedule_visit` (004)
  cierra; con agente off, se señala para el asesor. Reusa `createShowingFromAgent`.
- **URL prefirmada** para la foto (no subir media a Meta): más simple y portable (S3 estándar).
- **`message.property_id`** aditivo: enlaza la tarjeta a su propiedad para renderizarla en el hilo y
  dar contexto; el ruteo del tap usa el id del botón, no esta columna.

## Complexity Tracking

> Única decisión a registrar: cómo se entrega la imagen a WhatsApp.

| Decisión | Por qué | Alternativa descartada porque |
|----------|---------|-------------------------------|
| Foto vía **URL prefirmada de R2** (`getDownloadUrl`) como `image.link` | Un paso, sin estado; Meta descarga la foto al enviar; usa la interfaz S3 estándar (portable a MinIO) | **Subir la media a Meta** (resumable upload → media id) añade un round-trip y estado (id por imagen) sin beneficio en el MVP; la URL prefirmada (≈15 min) es pública para el fetcher de Meta sin exponer credenciales. |
