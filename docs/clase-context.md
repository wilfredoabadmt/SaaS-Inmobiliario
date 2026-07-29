# Contexto de clase — Construir un SaaS multi-tenant con SDD (caso real: Inmox)

> **Propósito**: material base para una clase comunitaria sobre cómo construir un
> **SaaS multi-tenant** real —un CRM inmobiliario con WhatsApp como canal— usando la
> metodología **Spec-Driven Development (SDD)** y una **arquitectura semi-monolítica**
> (un VPS + almacenamiento de objetos S3-compatible en R2), con la **integración
> oficial de Meta WhatsApp Cloud API**.
>
> Documento descriptivo y teórico. **No contiene secretos** (tokens, claves, llaves):
> esos viven solo en variables de entorno fuera del control de versiones.
>
> Producto de ejemplo: **Inmox** (`inmox-dev.kevinbelier.cloud`).

---

## 0. Mapa mental: ¿qué estamos construyendo y por qué así?

Un **SaaS multi-tenant** = una sola instancia lógica de software que sirve a muchas
organizaciones independientes (los *tenants*), con sus datos aislados entre sí. En
nuestro caso cada tenant es una **agencia inmobiliaria**.

Tres pilares que vamos a desarrollar en clase:

1. **Metodología — SDD (Spec-Driven Development)**: especificar el comportamiento
   antes de codificar, en ciclos incrementales gobernados por una *constitución*.
2. **Arquitectura — semi-monolítica**: una app monolítica desplegable (Next.js) +
   Postgres self-hosted en un VPS, con el almacenamiento de archivos delegado a un
   servicio S3-compatible (Cloudflare R2). Ni microservicios, ni serverless puro.
3. **Integración oficial — Meta WhatsApp Cloud API**: onboarding multi-tenant vía
   *Embedded Signup*, webhooks idempotentes y activación de números.

---

## 1. Metodología: Spec-Driven Development (SDD)

### 1.1. La idea central

SDD invierte el hábito de "codear primero, documentar después". El flujo es:

```
constitución  →  specify  →  plan  →  tasks  →  implement
   (reglas)      (qué/por     (cómo   (lista     (código que
                  qué, sin     técnico)  accionable) pasa el gate)
                  implementar)
```

- **Specify** describe **comportamiento observable por el usuario** (qué y por qué),
  **no** la implementación (nada de frameworks, APIs ni estructura de código).
- **Plan** traduce el spec a decisiones técnicas (stack, modelo de datos, contratos).
- **Tasks** descompone el plan en tareas accionables y ordenadas por dependencias.
- **Implement** ejecuta las tareas; nada se considera "hecho" sin pasar la puerta de
  calidad.

Herramienta usada: **Spec Kit** (skills `/speckit-specify`, `/speckit-plan`,
`/speckit-tasks`, `/speckit-implement`, más `/speckit-clarify`, `/speckit-analyze`,
`/speckit-constitution`, `/speckit-checklist`).

### 1.2. La constitución: la capa estable

Antes de cualquier feature se redacta una **constitución** (`/speckit-constitution`):
las reglas **no negociables** del producto. Gobierna todas las fases; ante conflicto,
gana la constitución. Tiene su propio *semantic versioning* (MAJOR/MINOR/PATCH) y un
*Sync Impact Report* cuando se enmienda.

Nuestros **8 principios** (constitución v1.2.0):

| # | Principio | Esencia |
|---|---|---|
| I | **Seguridad de Datos Primero** (no negociable) | Secretos nunca al cliente ni a logs; cifrado en reposo; aislamiento de tenant por defecto. |
| II | **Soberanía / Self-Hosted** | Core (auth + BD) self-hosted obligatorio; almacenamiento de objetos puede ser externo **solo vía interfaz S3 estándar** (portable a MinIO sin cambiar código). |
| III | **Multi-Tenancy Real** | Una instancia, muchas organizaciones; `tenant_id` es ciudadano de primera clase del modelo de datos. |
| IV | **Idempotencia en Integraciones Externas** | Recibir el mismo webhook N veces no duplica efectos; cada evento se identifica y se deduplica. |
| V | **Calidad Verificable Antes de "Hecho"** (no negociable) | "Hecho" = typecheck + lint + build (+ tests donde apliquen); lo no verificable se marca pendiente de verificación humana. |
| VI | **Specs Antes de Código** | Ninguna feature se implementa sin spec previa. |
| VII | **Trazabilidad de Decisiones** | Decisiones bajo incertidumbre se documentan visibles (no enterradas en el código). |
| VIII | **Foco Vertical Inmobiliario** | Es un CRM inmobiliario, no mensajería genérica; toda feature debe servir a una agencia gestionando propiedades y clientes. |

**Lección de clase**: la constitución es lo que hace que un agente (o un equipo)
pueda construir de forma autónoma sin desviarse. Es el contrato que no cambia entre
features.

### 1.3. SDD es incremental, no waterfall

Error común: pensar que SDD exige escribir **todas** las specs por adelantado. **No.**
Cada capacidad nueva es una **carpeta numerada** (`specs/001-…`, `specs/002-…`) con su
propio ciclo specify→plan→tasks→implement y, opcionalmente, su rama git
(`001-…`, `002-…`). Especificas el *slice* que vas a construir, lo construyes, y luego
especificas el siguiente.

**Cómo SDD maneja iteraciones y adiciones (clave de la clase):**

| Situación | Cómo se maneja en SDD |
|---|---|
| Función nueva (billing, reportes…) | Nuevo feature numerado: `/speckit-specify` → plan → tasks → implement. |
| Cambiar comportamiento ya implementado | Actualizas el `spec.md` de ese feature y re-corres plan/tasks del *delta*; o un spec nuevo que lo *supersede*. |
| Refinar un spec ambiguo | `/speckit-clarify` (preguntas dirigidas que se incrustan en el spec). |
| Verificar coherencia spec↔plan↔tasks | `/speckit-analyze` (chequeo cruzado no destructivo). |
| Regla transversal innegociable | Va a la **constitución** (`/speckit-constitution`). |

### 1.4. Cimientos vs. features: la distinción que decide qué especificar temprano

No todo cuesta lo mismo cambiarlo después:

- **Cimientos** (caros de revertir): modelo multi-tenant, modelo de auth/roles,
  columna vertebral del data-model, idempotencia, cifrado. → **Definir temprano y
  dejar estables.** Cambiarlos tras construir encima implica reescritura.
- **Features verticales** (aditivas): billing, landing de conversión, integraciones
  extra. → **Just-in-time.** Se montan encima de cimientos estables; agregarlas tarde
  es barato **si los cimientos ya las anticipan**.

**La excepción quirúrgica**: si una feature futura *forzaría* un cambio de cimientos
(p. ej. billing *por asiento* toca el modelo de membresías), especifica **solo esa
restricción** en la base —no la feature entera—. Pensar adelante = proteger el *seam*,
no construir la feature.

**Por qué front-loadear todas las specs sale mal en la práctica:**
1. Las specs muy adelantadas a la implementación **se pudren** (lo que aprendes
   construyendo invalida supuestos).
2. Es **waterfall disfrazado**; pierde la ventaja iterativa de SDD.
3. El cuello de botella real es **implementar + verificar**, no la cantidad de specs.
4. Genera **scope especulativo** (planes de billing para algo aún no validado).

---

## 2. Arquitectura: semi-monolítica (VPS + R2)

### 2.1. Qué significa "semi-monolítica" aquí

- **Una app desplegable** (Next.js App Router) que contiene UI, rutas de API,
  webhooks y lógica de servidor. No hay microservicios.
- **Postgres self-hosted** en el mismo VPS (contenedor aparte), no un Postgres
  gestionado de un tercero.
- **Almacenamiento de objetos delegado** a un servicio S3-compatible (Cloudflare R2),
  accedido **solo por la interfaz S3 estándar** → portable a MinIO self-hosted sin
  tocar código.

Es "semi" porque el **core** (cómputo + auth + BD relacional) vive en infraestructura
propia (soberanía, Principio II), pero el **almacenamiento de archivos** se externaliza
para no sobrecargar un VPS de bajos recursos ni sus backups.

```
                    ┌───────────────────────────── VPS (Coolify) ─────────────┐
   Navegador  ─────▶│  App Next.js (monolito)                                  │
   WhatsApp   ─────▶│   - UI (App Router, SSR/CSR)                             │
   (webhooks)       │   - API routes + webhooks                               │
                    │   - lógica de servidor (multi-tenant)                   │
                    │        │                                                 │
                    │        ▼                                                 │
                    │  Postgres (contenedor self-hosted)                       │
                    └────────┼────────────────────────────────────────────────┘
                             │ (interfaz S3 estándar)
                             ▼
                   Cloudflare R2  (fotos de propiedades, documentos de candidatos)

   Meta Graph API  ◀────────────  llamadas salientes (Cloud API)
```

### 2.2. Por qué esta arquitectura para un MVP

- **Costo y simplicidad**: un VPS + un bucket. Sin orquestadores, sin colas, sin
  serverless fragmentado.
- **Soberanía reversible**: el core es portátil; el storage es desacoplable.
- **Suficiente para escalar el MVP**: un monolito bien hecho aguanta mucho antes de
  necesitar dividirse. La multi-tenancy se resuelve a nivel de datos, no de
  infraestructura.

---

## 3. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 15** (App Router, React 19) | SSR + API routes en un solo proyecto. |
| Lenguaje | **TypeScript estricto** | `strict` + `noUncheckedIndexedAccess`. |
| UI | **Tailwind CSS v3** + **shadcn/ui** | Modo claro; tokens de diseño propios. |
| Tipografía/Marca | **Geist**; acento **teal (venta)** / **ámbar (renta)** | Ver `design-tokens.md`. |
| ORM / BD | **Drizzle ORM** + **PostgreSQL** | Migraciones con `drizzle-kit`. |
| Auth | **Better Auth** (self-hosted) + plugin **organization** | Email+contraseña; roles owner/agent; multi-tenancy. |
| Validación | **Zod** | Todo input externo + validación de variables de entorno. |
| IDs | `text` con prefijo (**nanoid**) | IDs legibles y tipados por entidad. |
| Almacenamiento | **AWS SDK S3** → **Cloudflare R2** | URLs prefirmadas (PUT/GET); portable a MinIO. |
| WhatsApp | **Meta WhatsApp Cloud API** | Aislada en `src/lib/meta` (frontera, Principio II). |
| Gestor de paquetes | **pnpm** | `pnpm-workspace.yaml` con allowlist de build scripts. |
| Deploy | **Coolify** sobre VPS | App + Postgres como recursos separados; healthcheck `/api/health`. |

### 3.1. Patrones de implementación que enseñan los principios

- **Cifrado en reposo (Principio I)**: el token de Meta de cada tenant se guarda
  cifrado **AES-256-GCM** (`encryptedToken` + `tokenIv` + `authTag`), nunca en claro,
  nunca devuelto al cliente.
- **Frontera de tenant (Principio III)**: `organization_id` indexado en **toda** tabla
  de dominio; las consultas siempre llevan scope de tenant. El rol se deriva de la
  membresía en la **organización activa** de la sesión.
- **Validación de entorno (Zod, lazy)**: un esquema valida **todas** las variables de
  entorno en el primer acceso en runtime (no al importar, para no romper el build). Si
  falta una, la app falla rápido y el healthcheck responde 503.
- **Idempotencia (Principio IV)**: los mensajes entrantes se deduplican por
  `wa_message_id` con índice **UNIQUE**; la firma `X-Hub-Signature-256` se verifica con
  HMAC-SHA256 en tiempo constante.

---

## 4. Multi-tenancy: arquitectura ≠ modelo de negocio

Distinción crítica para la clase (y fuente de confusión habitual):

- **Multi-tenancy (arquitectura)**: una instancia sirve a muchas organizaciones con
  datos aislados. Inmox **es** multi-tenant desde el día 1 (tabla `organization`,
  membresías con rol, `organization_id` en todo, organización activa por sesión).
- **Monetización (modelo de negocio)**: suscripciones, planes y cobro recurrente del
  SaaS **hacia** los tenants. Esto es una **capa de plataforma ortogonal** al dominio.

**Conclusión**: un sistema puede ser un SaaS multi-tenant completo **sin** capa de
billing. Inmox v1 = SaaS multi-tenant funcional **sin** monetización in-product
todavía. Hoy podrías onboardear varias agencias, pero el cobro sería *out-of-band*
(facturación manual / pilotos). Agregar billing después es limpio **porque los
cimientos multi-tenant ya existen** (los tenants ya están modelados).

> Matiz importante (autocorrección honesta): el billing **no** viola el Principio VIII
> (foco inmobiliario). VIII habla del *dominio funcional*; billing es *plataforma*. La
> razón real de que esté fuera de v1 es una **decisión explícita de alcance** (Out of
> Scope), no un conflicto constitucional.

---

## 5. Integración oficial con Meta WhatsApp Cloud API

### 5.1. Por qué la API oficial (y no librerías no oficiales)

- Cumplimiento de términos de Meta, estabilidad y soporte de plantillas/estados.
- Modelo multi-tenant real: cada agencia conecta **su propio** WhatsApp Business
  Account (WABA) y número.

### 5.2. Embedded Signup (onboarding multi-tenant)

El dueño de una agencia conecta su WhatsApp desde el panel, sin compartir contraseñas:

1. El frontend lanza `FB.login()` con un **`config_id`** (la configuración de Embedded
   Signup creada en el panel de Meta) y `response_type: "code"`.
2. Meta devuelve un **`code`** + el **WABA ID** + el **phone_number_id** vía callback
   JS (no hay redirect tradicional de navegador).
3. El servidor intercambia el `code` por un **token del tenant**
   (`oauth/access_token` con `client_id`/`client_secret`), server-side.
4. El token se **cifra y se guarda** asociado a esa organización.

### 5.3. Activar el número: el paso que casi todos olvidan

Cuando un número entra por Cloud API queda **PENDIENTE** hasta que se hacen **dos**
llamadas que mucha gente desconoce:

1. **`POST /{waba_id}/subscribed_apps`** — suscribe **tu app** a los webhooks de **ese
   WABA**. La suscripción `messages` que activas en el panel de Meta solo cubre tu
   número de prueba propio; los WABA que entran por Embedded Signup necesitan esta
   llamada **por cada tenant**.
2. **`POST /{phone_number_id}/register`** — registra el número con un **PIN de 6
   dígitos** (verificación en dos pasos) y lo pasa de **PENDIENTE → activo**, listo
   para enviar/recibir.

Sin estos dos pasos, el número parece conectado pero **no recibe mensajes**.

### 5.4. Webhooks idempotentes (Principio IV en acción)

- **Verificación de firma**: cada webhook trae `X-Hub-Signature-256`; se recomputa el
  HMAC-SHA256 del *raw body* con el `app_secret` y se compara en tiempo constante.
- **Deduplicación**: cada mensaje se inserta con `wa_message_id` **UNIQUE**; un
  reintento de Meta con el mismo ID no crea un mensaje duplicado.
- **Ruteo multi-tenant**: el `phone_number_id` del payload resuelve a qué organización
  pertenece el mensaje.

### 5.5. Páginas públicas que Meta exige para aprobar la app

Para configurar y aprobar la app en Meta Developers se necesitan URLs públicas con
HTTPS válido **antes** de validar nada: **landing**, **política de privacidad**,
**términos y condiciones** y **eliminación de datos**, además de configurar
**OAuth Redirect URIs** y **Dominios admitidos del SDK de JavaScript**. (En este
proyecto se construyeron con un subagente dedicado para no contaminar el contexto
principal — ver §8.)

---

## 6. Plataformas y operación (DevOps del MVP)

| Plataforma | Rol |
|---|---|
| **VPS** | Servidor donde corre todo el core (vía Coolify). |
| **Coolify** | PaaS self-hosted sobre el VPS: despliega la app y Postgres como recursos separados, gestiona dominios + TLS (Let's Encrypt), variables de entorno y deploys. |
| **GitHub** (App de Coolify) | Repo fuente; Coolify despliega desde una rama vía GitHub App. |
| **Cloudflare R2** | Bucket S3-compatible para fotos de propiedades y documentos. |
| **Cloudflare DNS** | Registro A del subdominio → IP del VPS. |
| **Meta Developers** | App de WhatsApp: config básica, Embedded Signup, webhook, páginas legales. |

**Flujo de deploy**: push a la rama → Coolify hace build (Dockerfile multi-stage) →
arranca el contenedor → healthcheck `/api/health` (consulta `select 1` a Postgres) →
verde. Migraciones: en este MVP, al no incluir `drizzle-kit` en la imagen *standalone*,
se aplican exponiendo temporalmente Postgres, corriendo `pnpm db:migrate`, y cerrando
el puerto (alternativa: un *Pre-Deployment Command* o un migrador empacado).

---

## 7. Estado actual del sistema (Inmox)

### 7.1. Lo que está hecho y vivo

- **Infra**: app + Postgres desplegados en Coolify (`inmox-dev.kevinbelier.cloud`),
  HTTPS/TLS OK, healthcheck verde.
- **Base de datos**: migrada, **19 tablas** (auth + dominio).
- **Páginas públicas/legales**: landing, privacidad, términos, eliminación de datos
  (200, sin auth).
- **Almacenamiento R2**: bucket creado y verificado con round-trip real
  (PutObject/GetObject/DeleteObject OK).
- **Credenciales reales en producción**: `META_APP_ID`, `META_APP_SECRET`,
  `META_CONFIG_ID` y las de R2 inyectadas; webhook verify token configurado.
- **WhatsApp onboarding (backend)**: Embedded Signup + intercambio de token + cifrado
  + **`subscribed_apps`** + **`register`** (activación con PIN) implementados.
- **Webhook de WhatsApp**: verificación de firma + dedup por `wa_message_id`.

### 7.2. Entidades de dominio (multi-tenant, todas con `organization_id`)

`organization`, `member`, `invitation`, `user`, `session`, `account`, `verification`
(auth) · `property`, `property_photo`, `client`, `conversation`,
`conversation_property`, `message`, `template`, `candidacy`, `candidate_document`,
`showing`, `contract`, `meta_credentials` (dominio).

Modelo rico (decisión DV-4): cliente 1:N conversaciones; conversación M:N propiedades
con una principal.

### 7.3. Lo que está pendiente / en curso

- **UI de autenticación (`002-auth-ui`)**: el login era un *stub*; se especificó como
  feature propia (registro self-serve del dueño + login + organización activa). En
  fase de spec, lista para `/speckit-plan`.
- **Historias P2–P4** del CRM (propiedades, muestras/equipo, candidatos/contratos):
  especificadas en `001`, pendientes de implementar.
- **Billing/monetización**: **fuera de alcance v1** por decisión explícita; sería un
  feature futuro (`003-billing`) que la base multi-tenant ya soporta.
- **Verificación E2E con navegador (Playwright)**: aún no instalada (`test:e2e` es un
  stub) — lección de §8.

### 7.4. Las 4 historias del CRM (feature 001), priorizadas

- **US1 (P1)** Bandeja única de WhatsApp.
- **US2 (P2)** Catálogo de propiedades + vincular conversaciones.
- **US3 (P3)** Muestras y equipo.
- **US4 (P4)** Expediente de candidatos y contratos.

Orden de entrega (constitución): **P1 comunicación → P2 dominio → P3 operación → P4
documentos**.

---

## 8. Lecciones reales (war stories para la clase)

Errores concretos que cometimos y cómo se resolvieron — oro puro para enseñar:

1. **El build de pnpm falla con `ERR_PNPM_IGNORED_BUILDS`**: el `Dockerfile` debe
   copiar `pnpm-workspace.yaml` (que lleva la allowlist de build scripts de
   esbuild/sharp/etc.) **antes** de `pnpm install`. Lección: el orden de COPY en
   Docker importa.

2. **La landing daba 500 en SSR**: usar el hook `authClient.useSession()` de Better
   Auth en un client component se ejecuta durante el SSR y rompe el render
   (`Cannot read properties of null (reading 'useRef')`). Solución: usar
   `getSession()` dentro de un `useEffect` (solo cliente). Lección: cuidado con hooks
   de librerías cliente en el borde SSR.

3. **Variables de entorno en Coolify**: usar `is_literal:true` envuelve el valor en
   comillas y **rompe URLs** (p. ej. el `DATABASE_URL`); además un PATCH en bulk creó
   **duplicados** (cada clave ×2). Solución: crear/actualizar **una por una** con
   `{key,value}` y deduplicar. Lección: conoce el comportamiento exacto de tu PaaS.

4. **Migraciones en imagen standalone**: la imagen no trae `drizzle-kit`. Solución:
   exponer Postgres temporalmente, migrar, cerrar el puerto. Lección: planea *cómo*
   migras en producción desde el diseño, no como improvisación.

5. **Reportar "verde" sin abrir la pantalla**: verificamos códigos HTTP (200/401) y
   asumimos que la app funcionaba; pero `/login` era un placeholder. Un `200` solo
   dice "la ruta renderiza algo", no "la UI funciona". **Lección central**: la
   verificación a nivel HTTP no sustituye la verificación de comportamiento real
   (navegador / Playwright). El Principio V exige verificación, y para UI eso es E2E.

6. **El gap de activación de WhatsApp**: tener token + credenciales no basta; sin
   `subscribed_apps` + `register` el número queda PENDIENTE y no recibe mensajes
   (ver §5.3).

7. **Aislar trabajo "sucio" en subagentes**: la construcción de las páginas públicas y
   la config de Meta se delegó a un **subagente dedicado**, para no contaminar el
   contexto principal de implementación. Lección de productividad con agentes: separá
   responsabilidades.

---

## 9. Guion sugerido para enseñar a construir un SaaS multi-tenant así

1. **Redacta la constitución primero** (las reglas caras de revertir). Sin esto, la
   construcción autónoma se desvía.
2. **Escribe UN spec del dominio core** con historias priorizadas (P1→Pn). No
   especifiques billing ni features verticales todavía; solo asegura que el modelo de
   datos las **anticipe** (tenants, membresías, roles).
3. **Plan → tasks → implement de P1 + auth** (auth es el prerequisito que desbloquea
   todo). Verifica de verdad (typecheck+lint+build **y** navegador).
4. **Integración externa aislada tras una frontera** (`lib/meta`) con idempotencia y
   firma desde el inicio.
5. **Despliega temprano** (VPS + Coolify + R2 + dominio HTTPS) para tener URLs públicas
   reales — necesarias para Meta y para probar de verdad.
6. **Itera**: siguiente historia → … → **billing cuando vayas a monetizar** →
   **landing de conversión cuando tengas producto y mensaje**.

**Idea final**: la metodología (SDD) te da disciplina, la arquitectura
(semi-monolítica) te da simplicidad y soberanía, y la integración oficial (Meta Cloud
API) te da legitimidad. Un MVP no necesita microservicios ni billing para ser un SaaS
multi-tenant real; necesita cimientos correctos y entrega incremental verificada.

---

*Documento generado como material de clase a partir del estado real del proyecto
Inmox. Las credenciales y secretos se gestionan exclusivamente por variables de
entorno fuera del control de versiones (Principio I).*
