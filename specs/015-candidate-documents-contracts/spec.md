# Feature Specification: Expedientes de Candidatos y Seguimiento de Contratos (015-candidate-documents-contracts)

**Feature Branch**: `015-candidate-documents-contracts`  
**Created**: 2026-09-17  
**Status**: In Progress  

**Input**: Cumplimiento de la Historia de Usuario 4 (P4) de la constitución del CRM: Expediente documental de candidatos (subida y gestión de identificaciones, comprobantes de ingresos y otros documentos) y seguimiento del ciclo de vida de contratos PDF generados externamente, integrados en el panel de tratos del pipeline.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Expediente Documental del Prospecto (Priority: P1)

El asesor comercial abre el panel lateral de un trato en el pipeline o el perfil del cliente y puede subir documentos necesarios para la operación inmobiliaria (renta o venta):
- Tipos de documento: `identificacion` (INE/Pasaporte), `comprobante_ingresos` (nómina/estados de cuenta), `otro` (comprobante de domicilio, aval, RFC).
- Subida directa segura a Cloudflare R2 vía URL prefirmada PUT.
- Lista de documentos del expediente con nombre de archivo, tipo, tamaño en KB/MB, fecha de subida y botón de descarga directa (vía URL prefirmada GET de 15 min).
- Opción para eliminar documentos si hubo un error.

**Why this priority**: En el proceso inmobiliario mexicano y latinoamericano, la recolección de documentación es obligatoria para perfilar al prospecto antes de cerrar un contrato de renta o venta.

**Independent Test**: Abrir una candidatura en `/pipeline`, subir un PDF de identificación de 1 MB, verificar que aparece en el listado, hacer clic en "Descargar" y comprobar que se abre el archivo subido.

---

### User Story 2 - Carga y Seguimiento de Contratos (Priority: P1)

El asesor comercial sube el contrato PDF generado externamente (elaborado por la notaría o área jurídica) y rastrea su avance:
- Estados posibles: `borrador` (redacción preliminar), `enviado` (entregado al cliente para revisión), `en_negociacion` (revisión de cláusulas/ajustes) y `firmado` (formalizado).
- El asesor puede cambiar el estado en cualquier momento con un clic en el selector visual de estados.
- Al cambiar de estado, se actualiza la fecha de modificación y queda visible para todo el equipo.
- Descarga segura del archivo de contrato actual.

**Why this priority**: Cierra el ciclo de la venta/renta inmobiliaria conectando la etapa comercial de negociación con la firma final.

**Independent Test**: Subir un contrato en estado `borrador`, cambiarlo a `enviado`, recargar la página y verificar que el estado persiste como `enviado`.

---

## Edge Cases

1. **Archivo inválido o excede tamaño**:
   - Si se intenta subir un archivo no soportado (ej. ejecutable .exe) o mayor a 15 MB para documentos / 25 MB para contratos, el sistema rechaza la firma en el endpoint y muestra error legible.
2. **Aislamiento de Tenant**:
   - Una agencia no puede acceder a las URLs de descarga ni a los endpoints de documentos o contratos de otra agencia (404/403).
3. **Candidatura eliminada**:
   - La eliminación en cascada en la base de datos elimina las filas asociadas en `candidate_document` y `contract`.
