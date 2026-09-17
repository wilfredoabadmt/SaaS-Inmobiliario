# Plan Técnico: Expedientes de Candidatos y Seguimiento de Contratos (015-candidate-documents-contracts)

## 1. Constitution Check

- **Principio I (Seguridad de datos)**: Storage keys privadas (`candidate-docs/{orgId}/...` y `contracts/{orgId}/...`). Acceso exclusivo vía URLs prefirmadas temporales con firma HMAC S3. Validación estricta de tenant en cada endpoint.
- **Principio II (Soberanía / Self-Hosted)**: Uso exclusivo de la interfaz S3 estándar a través de `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner` (Cloudflare R2 portable a MinIO).
- **Principio III (Multi-Tenancy)**: `organization_id` como parámetro mandatorio en toda inserción, consulta y eliminación.
- **Principio VIII (Foco Inmobiliario)**: Gestión de expedientes de renta/venta y contratos. Cumplimiento de que **el software NO genera contratos** (solo almacena y rastrea estado).

---

## 2. Modelo de Datos Existente

Reutiliza las tablas ya migradas en `src/lib/db/schema/domain.ts`:
- `candidateDocument`: `id`, `organizationId`, `candidacyId`, `type` (`identificacion` | `comprobante_ingresos` | `otro`), `storageKey`, `fileName`, `contentType`, `sizeBytes`, `uploadedByUserId`, `createdAt`.
- `contract`: `id`, `organizationId`, `candidacyId`, `status` (`borrador` | `enviado` | `en_negociacion` | `firmado`), `storageKey`, `fileName`, `contentType`, `sizeBytes`, `uploadedByUserId`, `createdAt`, `updatedAt`.

---

## 3. Endpoints de API

- `GET /api/candidacies/[id]/documents`: Lista documentos con URLs de descarga prefirmadas (`GET`).
- `POST /api/candidacies/[id]/documents/sign`: Genera URL prefirmada PUT para subida directa.
- `POST /api/candidacies/[id]/documents/confirm`: Registra el documento en la base de datos tras subida exitosa.
- `DELETE /api/candidacies/[id]/documents/[docId]`: Elimina el documento.
- `GET /api/candidacies/[id]/contracts`: Lista contratos de la candidatura.
- `POST /api/candidacies/[id]/contracts/sign`: Genera URL prefirmada PUT para subida de contrato.
- `POST /api/candidacies/[id]/contracts/confirm`: Registra el contrato en la base de datos tras subida.
- `PATCH /api/candidacies/[id]/contracts/[contractId]`: Actualiza el estado (`status`).
- `DELETE /api/candidacies/[id]/contracts/[contractId]`: Elimina el contrato.
