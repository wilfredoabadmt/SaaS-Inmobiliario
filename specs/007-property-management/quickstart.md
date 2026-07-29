# Quickstart — Administración de propiedades (007)

Cómo construir, aplicar la migración y **verificar el comportamiento** (Definición de Hecho
reforzada). El cierre exige typecheck+lint+build **+ self-test E2E** corrido por mí (Claude), no
delegado al dueño.

## 1. Migración (aditiva)

```bash
pnpm drizzle-kit generate   # genera ALTER TABLE property ADD COLUMN archived_at timestamp; + índice
# revisar el SQL generado en drizzle/ (debe ser SOLO aditivo)
pnpm drizzle-kit migrate    # local; en Coolify corre por Pre-Deployment Command
```

Gotcha conocido (memoria Coolify): si el Pre-Deployment Command está vacío, la migración **no** corre
en el deploy y aparecerá `column "archived_at" does not exist`. Confirmar que está configurado.

## 1.5. CORS del bucket R2 (U1 — requisito para subir fotos)

La subida de fotos hace un `PUT` directo navegador→R2 con URL prefirmada. R2 lo **rechaza por CORS**
si el bucket no permite el origen de la app. Configurar en Cloudflare R2 → bucket → Settings → CORS
Policy (no se hace desde código):

```json
[{ "AllowedOrigins": ["http://localhost:3000", "https://inmox-dev.kevinbelier.cloud"],
   "AllowedMethods": ["PUT", "GET"],
   "AllowedHeaders": ["*"],
   "MaxAgeSeconds": 3600 }]
```

Síntoma si falta: el `PUT` falla con error CORS en consola del navegador aunque la URL prefirmada sea
válida y el `sign` haya devuelto 200. Solo lo aplica el dueño del bucket (acción de dashboard).

## 2. Gate técnico

```bash
pnpm typecheck && pnpm lint && pnpm build
```

## 3. Self-test de comportamiento (E2E) — camino feliz

Desde `/properties` autenticado como miembro de un tenant con datos:

1. **Crear**: "Nueva propiedad" → llenar (venta, departamento, precio, zona "Del Valle") → guardar.
   ✅ Aparece en el inventario; recargar y sigue ahí (no es de muestra).
2. **Editar**: abrir, cambiar precio → guardar. ✅ Persiste tras recargar; solo cambió ese campo.
3. **Detalle + fotos**: desplegar la tarjeta → subir 2 fotos → marcar una principal → eliminar una.
   ✅ La galería refleja orden; la principal es `sortOrder=0`.
4. **Estatus**: marcar "apartada" desde la tarjeta. ✅ Se refleja en tarjeta/filtros sin abrir el form.
5. **Archivar**: archivar la propiedad. ✅ Desaparece del inventario activo; filtro "archivadas" la
   muestra; desarchivar la regresa con su estatus previo.
6. **Match inverso**: en una propiedad, abrir "clientes que matchean". ✅ Lista clientes compatibles
   con % y razones (tras crear requisitos manuales en el paso 7 si hace falta).
7. **Requisitos manuales**: en un cliente sin requisitos, crearlos (presupuesto/zona/tipo) → volver a
   la propiedad compatible. ✅ Ese cliente ahora aparece en el match inverso.
8. **Ficha 006 con foto real**: enviar la ficha de la propiedad con foto a la conversación de prueba.
   ✅ Llega como tarjeta con **la foto que subí** (no la del seed). *(Reusa el self-test de WhatsApp.)*

## 4. Camino infeliz (obligatorio)

- **Input inválido**: crear con `price = -1` o tipo fuera del enum → **422**, no se guarda, mensaje claro.
- **Cross-tenant**: pedir `GET /api/properties/{id_de_otra_org}` → **404** (no filtra datos).
- **Foto inválida**: firmar subida con `contentType=application/pdf` o `sizeBytes` enorme → **422**.
- **Propiedad sin foto**: enviar su ficha → degrada a texto (006), sin error.
- **Cero matches**: match inverso de una propiedad sin clientes compatibles → lista vacía, **no** error.
- **Archivada fuera del matching**: archivar una propiedad disponible y confirmar que ya no aparece en
  el matching directo de un cliente compatible.
- **Eliminar principal**: borrar la foto `sortOrder=0` → la siguiente pasa a principal; galería sin huecos.

## 5. Verificación de aislamiento (Principio I/III)

Con dos tenants A y B: ninguna propiedad/foto/requisito/match de A es visible o mutable desde B.
Probar al menos: listado, detalle, PATCH, archive, photos y matching-clients con un id de B estando
en A → 404 en todos.

## 6. Qué se marca "pendiente de verificación humana"

- Juicio visual del layout del detalle/galería y del formulario (estética del design system).
- Aprobaciones de Meta o cualquier cosa fuera de mis herramientas. Todo lo demás lo verifico yo.
