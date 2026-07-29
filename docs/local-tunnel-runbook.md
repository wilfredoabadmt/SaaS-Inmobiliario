# Loop de pruebas LOCAL con túnel (sin desplegar en cada cambio)

Objetivo: iterar el agente de WhatsApp **contra el código local** y solo desplegar la
versión final. Meta entrega los entrantes a una URL pública **estable de ngrok** (dominio
estático gratis) que apunta a tu máquina; la app local usa la **BD de inmox-dev** (mismos
datos: conversación de prueba, propiedades, fotos y el mapeo del número en
`meta_credentials`), así que observas el resultado en la misma UI de inmox-dev.

```
WhatsApp (número de prueba) → Meta Cloud API
   → POST https://TU-DOMINIO.ngrok-free.app/api/webhooks/whatsapp   (webhook estable)
   → ngrok (túnel) → http://localhost:3000   (tu app local, BD = inmox-dev)
   → agente responde → envía saliente con el token de la BD dev → WhatsApp
```

Por qué funciona sin tocar secretos en código: el verify-token
(`META_WEBHOOK_VERIFY_TOKEN`) y la firma (`META_APP_SECRET`) ya están en tu `.env`, y el
mapeo `phone_number_id → org + token` vive en la BD dev. El webhook local resuelve la org
y manda con el token correcto.

> ⚠️ Meta permite **una sola** URL de callback por app. Mientras el webhook apunte a tu
> túnel, inmox-dev **no** recibe entrantes (los recibe tu local). Al terminar la sesión,
> regresa el webhook a inmox-dev (Paso 5). Por eso el túnel es para **sesiones de
> desarrollo**, no permanente.

¿Por qué ngrok y no un subdominio propio? El DNS de `kevinbelier.cloud` se administra en
**Hostinger**, no en Cloudflare; un túnel nombrado de Cloudflare exigiría mover el DNS. El
dominio estático gratis de ngrok da una URL estable sin tocar tu DNS.

---

## Pre-requisitos
- `ngrok` ya instalado (winget `Ngrok.Ngrok`). Abre una **terminal nueva** para que quede
  en el PATH.
- Node + pnpm + este repo.

---

## Paso 1 — [TÚ] BD dev alcanzable + `.env.tunnel`

La app local necesita el `DATABASE_URL` del Postgres de inmox-dev. El agente de Coolify está
exponiendo el **Public Port** del Postgres y me dará host/puerto/DB/usuario (la contraseña la
copias tú del panel de Coolify). Con eso, crea **`.env.tunnel`** en la raíz (gitignored):
copia tu `.env` y cambia solo:

```dotenv
# BD = inmox-dev (puerto público de Coolify). NO la localhost de desarrollo.
DATABASE_URL=postgres://USER:PASSWORD@kvm1-host:PUERTO_PUBLICO/DB?sslmode=require

# La app local se sirve en localhost; el webhook entra por el túnel.
APP_BASE_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
# El resto (META_*, S3_*, OPENROUTER_*, ENCRYPTION_KEY, BETTER_AUTH_SECRET) = igual que .env
```

> Avísame cuando tengas el `DATABASE_URL` dev y valido la conexión + que las migraciones
> estén al día antes de seguir.

---

## Paso 2 — [TÚ] Cuenta de ngrok + authtoken + dominio estático

Único trabajo tuyo (cuenta gratis):
1. Crea cuenta en **https://dashboard.ngrok.com/signup** (o login si ya tienes).
2. Copia tu **authtoken**: dashboard → *Your Authtoken*. Pégalo:
   ```
   ngrok config add-authtoken <TU_AUTHTOKEN>
   ```
3. Reclama tu **dominio estático gratis**: dashboard → *Universal Gateway → Domains →
   New Domain*. Te queda algo como `inmox-kevin.ngrok-free.app`. **Pásamelo** (o anótalo).

No necesitas tocar DNS ni nada más. ngrok no requiere el paso de "crear túnel + DNS" que sí
pedía Cloudflare.

---

## Paso 3 — [TÚ, una sola vez] Apuntar el webhook en el panel de Meta

En developers.facebook.com → tu app → WhatsApp → Configuration → **Webhook**:
- **Callback URL:** `https://TU-DOMINIO.ngrok-free.app/api/webhooks/whatsapp`
- **Verify token:** el valor de `META_WEBHOOK_VERIFY_TOKEN` de tu `.env`.
- Suscríbete al campo **messages**.

Con la app local + ngrok corriendo (Paso 4), Meta hará el GET de verificación y quedará
verde. Guarda la URL vieja de inmox-dev
(`https://inmox-dev.kevinbelier.cloud/api/webhooks/whatsapp`) para restaurarla al terminar.

---

## Paso 4 — Correr el loop local

Terminal 1 — la app (con la BD dev):
```
pnpm install
node --env-file=.env.tunnel node_modules/next/dist/bin/next dev -p 3000
```
Terminal 2 — el túnel (dominio estático):
```
ngrok http --url=https://TU-DOMINIO.ngrok-free.app 3000
```
(En versiones de ngrok previas el flag es `--domain=TU-DOMINIO.ngrok-free.app` sin el
`https://`.)

Ahora manda mensajes desde el número de prueba. Verás los logs del webhook y del agente
**en tu terminal local** (incluido el `raw=` del LLM si algo falla), e iteras editando
código y reiniciando la app — **sin desplegar**. El resultado se ve en la UI de inmox-dev
(misma BD) o en `http://localhost:3000`. El inspector de ngrok en
`http://localhost:4040` te muestra cada request que entra de Meta.

> Gotcha ngrok free: la "interstitial page" solo afecta a navegadores; los POST del webhook
> de Meta no la disparan. Si el GET de verificación fallara por eso, añade el header de
> bypass o usa el dominio estático (ya lo evita en la mayoría de casos).

---

## Paso 5 — Cerrar la sesión
1. Corta `ngrok` (Ctrl+C) y la app.
2. En el panel de Meta, **regresa** la Callback URL a inmox-dev.
3. Pídeme **quitar el Public Port** del Postgres en Coolify (no dejar la BD expuesta).
4. Despliega a Coolify **solo** la versión final ya verificada.

---

## Niveles de prueba (disciplina de costo)
- **Nivel 1 — local sin WhatsApp:** para bugs de lógica/LLM/matching (como los no-JSON /
  respuesta vacía de hoy) basta simular el entrante: un POST firmado al webhook local.
  Corre en segundos, sin tocar Meta ni ngrok. (Puedo construir este simulador.)
- **Nivel 2 — túnel + WhatsApp real (este runbook):** para validar lo que solo se ve en
  WhatsApp de verdad (la tarjeta-ficha con foto, los botones `button_reply`). Una vez por
  feature, no por fix.
- **Deploy a Coolify:** paso de *release* de la versión final, no de prueba.
```
