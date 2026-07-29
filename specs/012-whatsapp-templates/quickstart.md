# Quickstart & Self-Test — 012-whatsapp-templates

Pasos de configuración (una vez) y el guion del self-test E2E de comportamiento que cierra la feature.

## 1. Configuración en el panel de Meta (App Dashboard)

> No requiere variables de entorno nuevas: se reutiliza `META_APP_ID`, `META_GRAPH_API_VERSION`,
> `META_APP_SECRET` (firma del webhook) y el **token de la agencia** ya almacenado en `metaCredentials`.

1. **Permiso de gestión** — la app debe tener `whatsapp_business_management` además de
   `whatsapp_business_messaging`. En **dev/test** ya funciona sobre el WABA de prueba (el token de Embedded
   Signup trae el scope). Para **producción** → App Review (skill `whatsapp-meta-app-review`).
2. **Suscripción del campo de webhook** — en WhatsApp → Configuration → Webhooks, suscribir los campos:
   - `message_template_status_update` (obligatorio para el push de estatus, DV-WT-6)
   - *(opcional)* `message_template_quality_update`, `template_category_update`
   El callback y el verify token ya existen (`/api/webhooks/whatsapp`, `META_WEBHOOK_VERIFY_TOKEN`).
3. **Analítica** — `template_analytics` requiere que la analítica esté habilitada para el WABA; en cuentas de
   prueba puede devolver vacío (es esperado → la UI muestra "sin datos todavía").

## 2. Verificación previa al build (bloqueo de credenciales)

Antes de implementar a fondo, confirmar que el token de la agencia de prueba **puede gestionar plantillas**:

```bash
# (server-side, token de la agencia descifrado) — esperado: 200 con lista (aunque vacía)
GET https://graph.facebook.com/v21.0/{waba_id}/message_templates?fields=name,status&limit=1
```
Si responde 403/permiso insuficiente → **bloqueo de credenciales**: reportar al dueño (no simular). Si 200 → seguir.

## 3. Migración

`drizzle/0011_whatsapp_templates.sql` (aditiva): `ALTER TABLE template ADD COLUMN ...` (6 columnas) +
`CREATE TABLE template_analytics ...` + índices. Añadir entrada idx 11 a `drizzle/meta/_journal.json`
(patrón gotcha-drizzle-data-migration: escribir el `.sql` + journal a mano; `migrate` no necesita snapshot).
Aplicar en Coolify por Pre-Deployment Command (ya configurado).

## 4. Self-Test E2E de comportamiento (Definición de Hecho reforzada)

Conducido por mí (Claude), no delegado. Camino feliz:

1. **Crear** una plantilla desde la sección `/templates` (owner): categoría UTILITY, idioma `es_MX`, body con
   variables, p. ej. `recordatorio_visita`: "Hola {{1}}, te recordamos tu visita a {{2}} el {{3}}." con
   ejemplos. → aparece en la lista con badge **Pendiente**; verificar en Meta que existe en revisión.
2. **Aprobación (pendiente Meta)**: esperar la decisión de Meta. Cuando llegue el webhook
   `message_template_status_update` (o tras pulsar **Sincronizar**), el badge pasa a **Aprobada**.
   → *Este paso depende de Meta (minutos–24 h) = pendiente de verificación humana/Meta.*
3. **Enviar con variables** desde la bandeja a una conversación del **número de prueba** (Evolution API,
   allowlist `…462…9768`) con la ventana de 24 h **cerrada**: rellenar las 3 variables, ver el preview,
   enviar. → el mensaje llega a WhatsApp con los valores sustituidos y aparece en el hilo.
4. **Estadísticas**: abrir las stats de la plantilla → reflejan el envío (`sent≥1`); el costo aparece si Meta
   lo expone, o "costo no disponible" si aún no (ambos son PASA).
5. **Eliminar** la plantilla (owner) → desaparece de la sección y de Meta; los mensajes del hilo se conservan.

Camino infeliz (provocar y comprobar degradación):

- **Token inválido**: corromper/expirar el token de la agencia → cualquier operación responde
  `reconnect_required` y la UI lo informa sin romperse.
- **Nombre duplicado / formato inválido**: crear con un `waTemplateName` ya existente o body con variable sin
  ejemplo → `meta_error` con **mensaje legible**, sin fila fantasma.
- **Plantilla rechazada**: si Meta rechaza una → badge **Rechazada** + razón visible; no seleccionable para envío.
- **Aislamiento de tenant**: con dos agencias, confirmar que A no ve/sincroniza/borra/consulta stats de las
  plantillas de B (0 fugas).
- **Permisos**: un usuario **agente** no puede crear/eliminar/sincronizar (403) pero sí ver y enviar aprobadas.
- **Analítica sin datos**: rango sin métricas → "sin datos todavía", no error.
- **Webhook idempotente**: reenviar el mismo `message_template_status_update` no corrompe el estatus.
- **Envío de no-aprobada / variable faltante**: bloqueado en selector y en server (422).

## 5. Gate técnico

`pnpm typecheck && pnpm lint && pnpm build` en verde antes de desplegar. Deploy a inmox-dev (Coolify) con la
migración aplicada; verificar `/api/health` y que la sección `/templates` carga.
