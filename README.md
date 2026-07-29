# Inmox — CRM inmobiliario multi-tenant con WhatsApp

Inmox es un CRM para agencias inmobiliarias (multi-tenant: cada agencia es una
organización aislada) con **WhatsApp como canal principal** de atención: bandeja
unificada, agente de IA con matching propiedad↔cliente, catálogo de propiedades,
pipeline de ventas, agendado de visitas con Google Calendar, plantillas de WhatsApp,
Instagram como canal adicional, y un panel de configuración de cuenta/equipo.

Este repositorio es el **código fuente completo**, liberado para que la comunidad lo
despliegue en su propio servidor. No es una plantilla en blanco: es la app terminada,
tal como quedó construida.

> **Metodología**: todo el proyecto se construyó con **Spec-Driven Development (SDD)**
> usando [Spec Kit](https://github.com/github/spec-kit) + Claude Code. La carpeta
> `specs/` conserva la especificación, plan técnico y research de cada feature (13 en
> total) — es la mejor forma de entender **por qué** el código es como es, y también
> sirve como caso de estudio si quieres aplicar el mismo método a tu propio SaaS. Un
> resumen narrado de la metodología está en `docs/clase-context.md`, y un "helper" para
> pegar en una sesión de claude.ai (chat, no Claude Code) que te ayuda a planear tu
> propio SaaS está en `docs/helper-spec-kit.md`.

---

## Stack

Next.js 15 (App Router) + TypeScript estricto · Tailwind + shadcn/ui · Drizzle ORM +
PostgreSQL · Better Auth (plugin `organization` = multi-tenancy) · Zod · IDs con prefijo
(nanoid) · almacenamiento S3-compatible vía AWS SDK (R2 en el original, portable a MinIO)
· WhatsApp Cloud API (`src/lib/meta`) · Instagram API con Instagram Login
(`src/lib/instagram`) · Google Calendar OAuth (`src/lib/google`) · nodemailer
(`src/lib/mail`) · pnpm · deploy en Coolify.

---

## 1. Qué necesitas antes de empezar

Cuentas/servicios (todos tienen capa gratuita o de bajo costo):

- **Un VPS** con Docker/Coolify (o cualquier PaaS que corra un Dockerfile + Postgres).
  El original se desplegó con [Coolify](https://coolify.io) self-hosted sobre un VPS
  de Hostinger.
- **Un dominio** con HTTPS apuntando a tu VPS (Meta exige HTTPS válido para el webhook
  y las páginas legales).
- **Cloudflare R2** (o cualquier bucket S3-compatible) para fotos/documentos.
- **Meta for Developers** — app de WhatsApp Cloud API en modo *Tech Provider* +
  **Embedded Signup** configurado (`config_id`), para que cada agencia conecte su
  propio número sin compartir contraseñas. Ver `docs/meta-app-config.md`.
- **(Opcional) Google Cloud** — OAuth para Google Calendar (feature de visitas).
- **(Opcional) Cuenta Gmail con App Password** (o cualquier SMTP) — para el envío de
  emails de invitación/recordatorio.
- **(Opcional) Instagram** — app de Meta con Instagram Login, si vas a usar el canal
  de Instagram.

## 2. Levantarlo en local

```bash
pnpm install
cp .env.example .env   # rellena los valores (ver la lista completa abajo)
pnpm db:generate        # solo si vas a tocar el esquema; las migraciones ya existen en drizzle/
pnpm db:migrate          # aplica el esquema a tu Postgres
pnpm dev                 # http://localhost:3000
```

Variables de entorno (`.env.example` trae todas vacías, con comentarios):

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | conexión a tu Postgres |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_BASE_URL` | auth + URL pública de la app |
| `ENCRYPTION_KEY` | AES-256-GCM (32 bytes en base64) — cifra en reposo los tokens de Meta/Google/Instagram. Genera uno con `openssl rand -base64 32` |
| `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, `META_SYSTEM_USER_TOKEN`, `META_SOLUTION_PARTNER_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_API_VERSION` | app de WhatsApp Cloud API (Tech Provider) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | tu bucket S3-compatible (R2/MinIO/S3) |

Features opcionales (visitas/Google Calendar, email, Instagram) añaden sus propias
variables — revisa `specs/011-visit-scheduling/`, `specs/008-instagram-integration/` y
el research de cada una para el detalle exacto, o simplemente arranca sin ellas: cada
integración está diseñada para **degradar** (no romper la app) si sus credenciales
faltan.

## 3. Desplegar en tu propio VPS (Coolify) — vía el agente + MCP, no a mano

Este proyecto **no se despliega clickeando el panel de Coolify**: el repo trae el
agente `.claude/agents/coolify-deploy-ops.md`, que opera Coolify a través de su **MCP**
(`@masonator/coolify-mcp`). Tú le delegas la operación; el agente crea la Application,
el Postgres, carga las variables y dispara el deploy por ti.

1. **Instala Coolify** en tu VPS (self-hosted): `curl -fsSL
   https://cdn.coollabs.io/coolify/install.sh | sudo bash`, abre `http://TU_IP:8000` y
   crea tu usuario admin.
2. **Conecta GitHub ↔ Coolify** (el único paso que sí es manual, en el navegador):
   Coolify → **Sources → GitHub App** → dale acceso a tu fork/copia de este repo. Esto
   es una conexión OAuth que Coolify exige hacer una vez desde su panel.
3. **Genera un API token de Coolify** (Coolify → Keys & Tokens) y conecta el MCP en tu
   sesión de Claude Code:
   ```bash
   claude mcp add coolify -e COOLIFY_BASE_URL="http://TU_IP:8000" -e COOLIFY_ACCESS_TOKEN="tu-api-token" -- npx @masonator/coolify-mcp@latest
   claude mcp list   # confirma que quedó conectado
   ```
4. **Delega el resto al agente**: pídele a Claude Code algo como *"despliega este
   proyecto a Coolify: crea la Application desde mi GitHub App conectada, un recurso
   Postgres aparte, configura el Pre-Deployment Command `pnpm db:migrate`, carga estas
   variables de entorno (una por una — cargarlas en bloque puede crear duplicados o
   romper URLs con `is_literal`, lección real documentada en `docs/clase-context.md`
   §8), pon mi dominio con HTTPS, y despliega"*. El agente usa las herramientas MCP
   (`mcp__coolify-*__*`) para hacerlo, y al final verifica por sí mismo el healthcheck.
5. Verifica `https://tu-dominio/api/health` → `{"status":"ok"}` (el propio agente ya lo
   hace, pero puedes confirmarlo tú también).
6. En Meta Developers: configura el webhook (`/api/webhooks/whatsapp`), el verify
   token, y sigue `docs/meta-app-config.md` para los valores exactos de redirect
   URIs/dominios del SDK. **No olvides el "gap de activación"**: un número que entra
   por Cloud API queda `PENDING` hasta hacer `POST /{waba_id}/subscribed_apps` +
   `POST /{phone_number_id}/register` — sin esto, el número se ve conectado pero no
   recibe mensajes (detalle en `docs/clase-context.md` §5.3).

Para iterar sin desplegar en cada cambio, `docs/local-tunnel-runbook.md` explica cómo
probar el webhook de WhatsApp contra tu app corriendo en `localhost` vía un túnel
(ngrok o similar).

## 4. Herramientas de auto-prueba (`scripts/`)

- `scripts/wa-tester/` y `scripts/selftest/` son clientes de **Evolution API**
  (un WhatsApp no oficial) que simulan ser "el cliente" escribiéndole a tu número de
  WhatsApp de la plataforma, para probar el agente de IA/la bandeja de punta a punta
  sin depender de un humano escribiendo a mano. Traen un guardrail duro: solo envían a
  los números que tú configures en `.env` (`TESTER_WHATSAPP_NUMBER` = tu WhatsApp
  personal de prueba, `PLATFORM_TEST_NUMBER` = el número de prueba de tu app de Meta),
  con anti-ráfaga incorporado — **si no configuras esas dos variables, los scripts
  bloquean cualquier envío por diseño** (no hay ningún número hardcodeado en el
  código).
- Necesitan además `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` de
  **tu propia instancia** de Evolution API.
- **Nota honesta**: a la fecha de este release, la instancia de Evolution API que se
  usó para construir y probar Inmox está fuera de servicio (en reparación) — estoy
  trabajando en una solución. Mientras tanto estos scripts de auto-prueba de la bandeja
  no van a poder correr contra esa instancia (podrías montar la tuya propia si quieres
  usarlos ya). Esto **no afecta** el resto del SaaS: la bandeja y el agente funcionan
  con WhatsApp Cloud API real (la integración oficial), que es independiente de
  Evolution — Evolution es solo la herramienta que simula al cliente para las pruebas
  automáticas.

## 5. Construyendo con Claude Code (opcional)

Si vas a seguir extendiendo Inmox (o adaptarlo a otro nicho) con Claude Code, el repo
ya trae:

- **`CLAUDE.md`** — contexto del proyecto + reglas de comportamiento del agente
  (definición de "hecho" reforzada, manejo de secretos, verificación de comportamiento
  en vivo antes de dar por terminada una feature).
- **`.specify/` + `.claude/skills/speckit-*`** — Spec Kit instalado: `/speckit-specify`
  → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- **`.claude/agents/coolify-deploy-ops.md`** — agente para operar tu propio Coolify
  (crear la Application/Postgres, deploy, logs, healthcheck) vía el MCP
  `@masonator/coolify-mcp` (ver §3, paso 3).
- **`.claude/agents/public-site-builder.md`** — agente para landing/privacidad/
  términos/eliminación de datos y la configuración exacta de Meta — útil si vas a
  adaptar el producto a tu propia marca.
- **`.claude/skills/loop-sdd/`** — modo de trabajo por objetivos (loop autónomo
  Discover→Plan→Execute→Verify→Iterate) en vez de prompts paso a paso.

## 6. Estructura de carpetas (mapa rápido)

```
src/app/api/**        rutas de API (Next.js App Router)
src/server/**         lógica de dominio por área (inbox, pipeline, properties, team...)
src/lib/meta/**       frontera WhatsApp Cloud API (tokens cifrados, firma de webhook)
src/lib/instagram/**  frontera Instagram API con Instagram Login
src/lib/google/**     frontera Google Calendar OAuth
src/lib/mail/**       envío de email (nodemailer)
src/lib/storage/**    interfaz S3 estándar (R2/MinIO)
src/lib/db/schema/**  esquema de Drizzle (tablas + relaciones)
drizzle/              migraciones SQL generadas
specs/                spec + plan + research de cada una de las 13 features
docs/                 config de Meta, runbook de túnel local, material de clase SDD
```

## 7. Advisory de dependencias conocido

`pnpm audit` reporta un *high* en `drizzle-orm@0.38.x` (inyección SQL vía
identificadores mal escapados, parcheado en `>=0.45.2`). El código de este repo no
construye identificadores dinámicos desde input de usuario, así que no es explotable
tal cual está, pero se recomienda actualizar la dependencia antes de depender de esto
en un entorno de alto riesgo.

## Licencia

MIT — ver [LICENSE](LICENSE). Úsalo, modifícalo, despliégalo, cóbralo si quieres: es
tuyo.
