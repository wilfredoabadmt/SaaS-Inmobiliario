# Configuración de la App de Meta para Inmox

Valores exactos para pegar en el panel de **Meta Developers**
(`https://developers.facebook.com/apps/<TU_APP_ID>/`).

> **Prerequisito de infraestructura:** El dominio `inmox-dev.kevinbelier.cloud`
> debe resolver públicamente por DNS y responder en HTTPS antes de que Meta
> pueda validar cualquiera de las URLs a continuación. Si el A record o el
> certificado TLS aún no están activos, Meta rechazará la validación.

---

## 1. Configuración básica de la app

Panel: **Configuración → Básica**

| Campo | Valor |
|---|---|
| **Privacy Policy URL** | `https://inmox-dev.kevinbelier.cloud/privacidad` |
| **Terms of Service URL** | `https://inmox-dev.kevinbelier.cloud/terminos` |
| **App Domains** | `inmox-dev.kevinbelier.cloud` |
| **Category** | Business and Pages |

---

## 2. Facebook Login for Business

Panel: **Productos → Facebook Login for Business → Configuración**

### Valid OAuth Redirect URIs

El flujo de Embedded Signup de Inmox **no usa un redirect URI tradicional**.
El componente `EmbeddedSignupButton` llama a `FB.login()` con
`response_type: "code"` y recibe el `code` mediante un callback JavaScript
(no mediante un redirect de navegador). El `code` se intercambia
server-side en el endpoint interno `POST /api/whatsapp/connect`.

**No obstante**, Meta requiere al menos un URI de redirección válido como
dominio de origen autorizado. Agrega:

```
https://inmox-dev.kevinbelier.cloud
```

Si Meta exige una ruta completa (no solo el origen), agrega también:

```
https://inmox-dev.kevinbelier.cloud/settings/whatsapp
```

> **Nota confirmada desde el código:** `src/components/whatsapp/embedded-signup-button.tsx`
> usa `FB.login()` con `{ config_id: configId, response_type: "code",
> override_default_response_type: true }`. El resultado (code + WABA ID +
> phone_number_id) se envía via `fetch` a `POST /api/whatsapp/connect`
> (en `src/app/api/whatsapp/connect/route.ts`). No hay redirect de navegador.

### Allowed Domains for the JavaScript SDK

```
inmox-dev.kevinbelier.cloud
```

---

## 3. WhatsApp → Configuración de la API

Panel: **Productos → WhatsApp → Configuración de la API**

| Campo | Valor |
|---|---|
| **Webhook Verify Token** | (el valor de `META_WEBHOOK_VERIFY_TOKEN` en tu `.env`) |
| **Webhook URL** | `https://inmox-dev.kevinbelier.cloud/api/webhooks/whatsapp` |
| **Suscripciones de webhook** | `messages` (mínimo requerido) |

---

## 4. Eliminación de datos

Panel: **Configuración → Básica → Data Deletion** (o equivalente según versión del panel)

| Campo | Valor |
|---|---|
| **Data Deletion Instructions URL** | `https://inmox-dev.kevinbelier.cloud/eliminacion-de-datos` |
| **Data Deletion Callback URL** (opcional) | `https://inmox-dev.kevinbelier.cloud/api/data-deletion-callback` |

> El callback URL automático (`/api/data-deletion-callback`) requiere
> implementación de un endpoint POST que acepte el payload de Meta y responda
> con `{ url, confirmation_code }`. Por ahora, la **Data Deletion Instructions
> URL** (página de instrucciones manuales) cumple el requisito mínimo de Meta
> para la revisión de la app. El endpoint del callback puede implementarse en
> una fase posterior.

---

## 5. Resumen copy-pasteable para el panel de Meta

```
App Domains:
  inmox-dev.kevinbelier.cloud

Privacy Policy URL:
  https://inmox-dev.kevinbelier.cloud/privacidad

Terms of Service URL:
  https://inmox-dev.kevinbelier.cloud/terminos

Data Deletion Instructions URL:
  https://inmox-dev.kevinbelier.cloud/eliminacion-de-datos

Data Deletion Callback URL (opcional):
  https://inmox-dev.kevinbelier.cloud/api/data-deletion-callback

Valid OAuth Redirect URIs (Facebook Login for Business):
  https://inmox-dev.kevinbelier.cloud
  https://inmox-dev.kevinbelier.cloud/settings/whatsapp

Allowed Domains for the JavaScript SDK:
  inmox-dev.kevinbelier.cloud

Webhook URL (WhatsApp):
  https://inmox-dev.kevinbelier.cloud/api/webhooks/whatsapp
```

---

## 6. Notas sobre el config_id del Embedded Signup

El parámetro `configId` que recibe `EmbeddedSignupButton` viene de las
variables de entorno de la aplicación (se pasa como prop desde
`src/app/(dashboard)/settings/whatsapp/page.tsx`). El `config_id` es el
**ID de la configuración del flujo de Embedded Signup** que se genera en:

Meta Developers → WhatsApp → Embedded Signup → Crear configuración

Ese valor debe colocarse en la variable de entorno correspondiente (p. ej.
`NEXT_PUBLIC_META_CONFIG_ID`) y pasarse como prop al componente. No es un
secreto — es público, aparece en el JS del cliente.

---

## 7. Checklist de verificación antes de enviar la app a revisión de Meta

- [ ] `inmox-dev.kevinbelier.cloud` resuelve públicamente (DNS propagado).
- [ ] HTTPS activo con certificado TLS válido (Traefik/Let's Encrypt).
- [ ] `https://inmox-dev.kevinbelier.cloud/privacidad` responde 200 sin auth.
- [ ] `https://inmox-dev.kevinbelier.cloud/terminos` responde 200 sin auth.
- [ ] `https://inmox-dev.kevinbelier.cloud/eliminacion-de-datos` responde 200 sin auth.
- [ ] `https://inmox-dev.kevinbelier.cloud/` (landing) responde 200 sin auth.
- [ ] Webhook de WhatsApp (`/api/webhooks/whatsapp`) verificado por Meta.
- [ ] `config_id` del Embedded Signup creado y configurado en variables de entorno.
- [ ] App de Meta en modo Live (no Development) para usuarios reales.
- [ ] Páginas legales revisadas por un profesional jurídico antes de launch.
