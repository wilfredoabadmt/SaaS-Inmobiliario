# Data Model — Fichas interactivas (006)

Cambio **aditivo** al esquema (`src/lib/db/schema/domain.ts`). **Sin tablas nuevas, sin alterar datos.**
Migración Drizzle aditiva en `drizzle/`.

---

## Tabla `message` (extendida)

| Columna | Tipo | Notas |
|---------|------|-------|
| … (existentes) | | `body`, `direction`, `aiGenerated`, `waType` (005), `waMessageId` (UNIQUE)… |
| **`property_id`** | `text`, **nullable**, FK → `property(id)` `ON DELETE set null` | NUEVO. Enlaza un mensaje de **ficha-tarjeta** con su propiedad para renderizarla en el hilo (kind `property`). `null` para mensajes que no son ficha. |

**Reglas**:
- Saliente de tipo tarjeta (manual o agente) → `property_id` = la propiedad enviada; `body` = el
  caption (texto de la ficha) para fallback/preview.
- Entrante `button_reply` → `wa_type = "interactive"`, `body` = título del botón (p. ej. "Agendar
  visita"); `property_id` puede quedar null (el contexto va en el id del botón).
- Histórico: filas previas con `property_id = null` (compatibles).
- Scope de tenant: la propiedad referida es del mismo `organization_id` que el mensaje (se valida al
  escribir).

---

## Concepto: Ficha-tarjeta (presentación, sin tabla)

Representación de una propiedad como **un** mensaje de WhatsApp:

- **P1**: mensaje `image` = foto principal (`property_photo` menor `sortOrder`, URL prefirmada) +
  `caption` (nombre, operación, zona, precio MXN, specs).
- **P2**: mensaje `interactive` = header imagen + body (mismo caption) + hasta 3 `reply` buttons.
- **Degradación**: sin foto → ficha de **texto** (sin imagen); con botones pero sin foto → interactivo
  sin header de imagen (body + botones).

Caption (es-MX), mismo contenido que `formatPropertySheet` hoy:
```
🏡 *<título>*
<Operación> · <zona>
<precio> MXN
<specs>
```

---

## Concepto: Botón interactivo (encoding)

| Botón (title, es-MX) | id (encoding) | Acción al tocar |
|----------------------|---------------|-----------------|
| Agendar visita | `visit:<propertyId>` | vincular propiedad + pedir fecha → agendar (004) o señalar al asesor |
| Hablar con asesor | `handoff:<propertyId>` | `needs_human=true`, `reason='requested'` (005) |
| Más fotos | `photos:<propertyId>` | enviar hasta 5 fotos adicionales (o avisar) |

- `title` ≤ 20 chars; `id` ≤ 256 chars (un `prop_…` cabe sobrado).
- Máximo 3 botones por mensaje (límite de WhatsApp).

---

## Foto de propiedad (`property_photo`, existente)

- **Principal** = menor `sortOrder` (desempate por `createdAt`). Va en la tarjeta.
- **Adicionales** = siguientes por orden; "Más fotos" envía **hasta 5**.
- Cada envío resuelve la URL con `storage.getDownloadUrl(storageKey)` (prefirmada, ~15 min).
- Solo fotos del tenant de la conversación (aislamiento).

---

## Reuso de entidades existentes

- **Visita (`showing`, 004)**: la crea el botón "Agendar visita" vía `createShowingFromAgent` (cuando
  hay fecha). Enlaza candidatura cliente↔propiedad.
- **Estado del agente (`conversation`, 005)**: el botón "Hablar con asesor" pone
  `needs_human/needs_human_reason='requested'`.
- **conversation_property**: "Agendar visita" puede marcar la propiedad como **principal** de la
  conversación (contexto para el agendado).

---

## Migración

- `pnpm db:generate`; revisar SQL en `drizzle/`: debe ser solo `ALTER TABLE "message" ADD COLUMN
  "property_id" text` (+ la FK). **Sin** `DROP`/`UPDATE`.
- Aplicar en inmox-dev antes de activar la feature.
