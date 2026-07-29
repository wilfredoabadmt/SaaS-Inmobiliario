# Quickstart — Integración de Instagram (Fase 1)

Cómo configurar, desplegar y **verificar** la feature. El self-test E2E lo conduce Claude (Definición
de Hecho REFORZADA); los pasos del App Dashboard de Meta son manuales (pendientes de verificación
humana).

## 1. Variables de entorno (Coolify + `.env.tunnel` local)

Añadir a `src/lib/env.ts` (Zod) y a Coolify. Todas server-side; nunca al cliente.

| Variable | Ejemplo / Notas |
|---|---|
| `IG_APP_ID` | `1019173904302571` (Instagram App ID, ≠ Meta App ID) |
| `IG_APP_SECRET` | secreto del **producto Instagram** (≠ `META_APP_SECRET`). Firma webhooks + exchange |
| `IG_REDIRECT_URI` | `https://inmox-dev.kevinbelier.cloud/api/instagram/callback` (HTTPS, EXACTO) |
| `IG_WEBHOOK_VERIFY_TOKEN` | cadena aleatoria; igual a la registrada en el panel |
| `IG_GRAPH_VERSION` | `v25.0` |
| `MEDIA_PROXY_SIGNING_SECRET` | aleatoria; firma el token del proxy de media (y el `state` OAuth) |
| `CRON_SECRET` | aleatoria; protege `/api/cron/instagram-refresh` |

> Gotcha conocido: una env faltante no debe tumbar el arranque. Las nuevas se añaden de forma que, si
> faltan, la feature de IG **degrada** (se desactiva la tarjeta/acciones) en vez de crashear el server
> (mismo criterio que el resto de envs opcionales de Coolify).

## 2. Pasos manuales en Meta App Dashboard (App **Live**)

1. **Producto Instagram → "inicio de sesión empresarial" (sección 4)**: registrar el `IG_REDIRECT_URI`
   EXACTO. Debe coincidir carácter por carácter con el de la URL de authorize.
2. **Producto Instagram → Webhooks (sección 3)**: Callback URL
   `https://inmox-dev.kevinbelier.cloud/api/instagram/webhook` + Verify Token =
   `IG_WEBHOOK_VERIFY_TOKEN`; suscribir fields `messages` y `comments`.
3. Confirmar scopes Fase 1: `instagram_business_basic`, `instagram_business_content_publish`,
   `instagram_business_manage_comments`, `instagram_business_manage_messages`.
4. La app debe estar **Live** para recibir webhooks de producción.

## 3. Migración

Migración **aditiva** (enum `ig_connection_status` + tablas `instagram_credentials`, `instagram_post`).
Se aplica en el arranque del contenedor / Pre-Deployment (patrón actual del proyecto). Verificar que
las tablas existen tras el deploy.

## 4. Gate técnico

```
pnpm typecheck && pnpm lint && pnpm build
```

## 5. Self-test E2E en vivo (lo conduce Claude)

Requisito: cuenta IG Business/Creator de prueba del dueño + app Live + webhook alcanzable.

**Camino feliz**
1. **Conectar**: en `/settings/instagram` pulsar Conectar → login IG → autorizar. Verificar tarjeta
   "@usuario — conectado" y fila en `instagram_credentials` (token cifrado, `token_expires_at` ~60 d).
2. **Publicar (genérico)**: subir una imagen + caption → Publicar. Verificar el post en el perfil real
   de IG y `instagram_post` con `ig_media_id`. *(juicio visual del render → pendiente humano)*.
3. **Publicar (desde propiedad)**: elegir una propiedad con foto → verificar caption pre-rellenado y
   foto principal; publicar y ver el post.
4. **Comentar**: sobre el post, listar comentarios, responder uno (aparece en IG), ocultar otro (deja
   de verse).
5. **DM**: enviar un DM real desde otra cuenta IG → verificar que llega a Inmox enrutado al tenant
   correcto; responder dentro de 24 h y confirmar entrega.

**Camino infeliz** (provocar y comprobar degradación sin colgarse)
- Webhook con **firma inválida** → **401**, no procesa.
- Webhook de **cuenta no mapeada** → **200** descarta con log.
- **Evento repetido** → no duplica efecto observable.
- **Propiedad sin foto** en "Publicar propiedad" → **422** `property_without_photo`.
- **Ventana 24 h vencida** al responder DM → **422** `outside_24h_window`.
- **Token expirado/inválido** → operación responde **409** `reconnect_required` y la tarjeta invita a
  Reconectar; otras agencias no se ven afectadas.
- **Límite diario** de publicación → **429** `rate_limited` con mensaje claro.

**Aislamiento multi-tenant**
- Con dos agencias conectadas, verificar que una no puede listar/publicar/mensajear sobre la cuenta de
  la otra (todas las queries con `organization_id`; webhook enruta solo por `ig_user_id`).

## 6. Cron de refresh

- Configurar scheduled task diaria en Coolify → `POST /api/cron/instagram-refresh` con
  `X-Cron-Secret: $CRON_SECRET`.
- Verificación: con un `token_expires_at` simulado a <7 d, correr el endpoint y comprobar que
  `token_expires_at` se extiende; con un token inválido, que la fila queda `reconnect_required`.

## 7. Marca de pendientes humanos

- Render visual del post/tarjeta en Instagram (juicio humano).
- Aprobaciones / revisión de permisos de Meta.
- Registro real del `IG_REDIRECT_URI` y webhook en el App Dashboard.
