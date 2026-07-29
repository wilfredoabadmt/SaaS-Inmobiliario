# Quickstart — 009 Gestión de contactos vinculada a la bandeja

Cómo verificar la feature. El gate técnico es el piso; el **self-test E2E de comportamiento** (que
conduzco yo) es el techo y la condición de "Hecho" (constitución V + CLAUDE.md, Definición REFORZADA).
Esta feature toca **bandeja / WhatsApp / auto-alta / envío saliente** → el self-test con número de prueba
es obligatorio.

## 1. Gate técnico (piso)

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Migración aditiva aplicada (local o por Pre-Deployment en Coolify):

```sql
-- esperado tras migrar
\d client   -- debe incluir: channel text NOT NULL DEFAULT 'whatsapp'
```

Verificar backfill: todos los contactos preexistentes quedan con `channel='whatsapp'`.

## 2. Self-test E2E de comportamiento (techo — lo corro yo)

Usar el skill `whatsapp-ai-agent-selftest` (número de prueba Evolution; **allowlist**: 462…9768 personal,
555…8947 plataforma; anti-ráfaga — ver memoria del guardrail). Desplegar primero a inmox-dev.

### Camino feliz

1. **Auto-alta con canal (US2)**: desde el número de prueba, enviar un primer mensaje al número de la
   plataforma con un teléfono que **no** sea contacto aún.
   - ✅ Aparece un contacto nuevo en `/clients` con el teléfono, el nombre de perfil (si la fuente lo
     expone) y **badge de WhatsApp** en el avatar.
   - ✅ Su conversación queda enlazada en la bandeja.
2. **CRUD manual (US1)**: en `/clients`, crear un contacto a mano (nombre + teléfono nuevo).
   - ✅ Aparece de inmediato con **badge neutro "manual"**.
   - Editar su nombre/notas → ✅ persiste tras recargar.
3. **Enriquecimiento no destructivo (US2)**: desde el número de prueba, escribir ahora desde el teléfono
   del contacto creado a mano.
   - ✅ NO se duplica el contacto; el badge pasa de **manual → WhatsApp**; el nombre editado a mano **no**
     se sobrescribe.
4. **Atajo a la bandeja (US4)**: en un contacto, pulsar **"Enviar mensaje"**.
   - ✅ Navega a la bandeja con esa conversación enfocada (`/inbox?c=…`).
   - ✅ Con la ventana de 24h **abierta** (acaba de escribir): la bandeja permite texto libre.

### Camino infeliz (provocar y comprobar degradación)

5. **Teléfono duplicado**: crear/editar un contacto con un teléfono que ya pertenece a otro de la org.
   - ✅ **409** con mensaje claro; **no** se crea/cambia a duplicado.
6. **Ventana 24h cerrada**: tomar un contacto cuya última entrada sea > 24h (o forzarlo) y pulsar "Enviar
   mensaje".
   - ✅ La **bandeja** impide texto libre y **exige plantilla** (regla aplicada por la bandeja, no por
     contactos).
7. **Contacto sin nombre de perfil**: inbound de un remitente sin `profile.name`.
   - ✅ El contacto se crea igual usando el teléfono; la UI muestra iniciales/identidad por teléfono; no
     falla.
8. **Aislamiento entre tenants**: con sesión de otra organización, intentar `GET/PATCH /api/clients/<id>`
   de un contacto ajeno y abrir `/inbox?c=<convAjena>`.
   - ✅ `404` en la API; la bandeja ignora el `?c=` ajeno (abre normal, sin filtrar datos).

### Pendiente de verificación humana

- Juicio visual fino del badge (posición/legibilidad del logo sobre el avatar) → lo confirma el dueño.

## 3. Mapa rápido de aceptación → evidencia

| Criterio (spec) | Cómo se evidencia |
|---|---|
| SC-001 auto-alta con canal | Paso 1 (contacto + badge WhatsApp en segundos) |
| SC-002 crear < 30s | Paso 2 |
| SC-003 1 clic a la conversación | Paso 4 |
| SC-004 cero duplicados | Pasos 3 y 5 |
| SC-005 badge en 100% | Pasos 1–2 (WhatsApp + manual) |
| SC-006 ventana cerrada → plantilla | Paso 6 |
| SC-007 aislamiento tenant | Paso 8 |
