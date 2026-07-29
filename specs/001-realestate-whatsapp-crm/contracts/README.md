# Contracts — Convenciones

**Feature**: CRM Inmobiliario con WhatsApp · **Date**: 2026-06-07

Estos contratos describen las interfaces que el sistema expone. Son agnósticos de
implementación (no fijan el código, sí el comportamiento observable).

## Convenciones generales

- **Transporte**: HTTP/JSON. Route Handlers en `app/api/**`; las mutaciones de UI
  también pueden exponerse como **Server Actions** equivalentes (mismo contrato de
  validación y autorización).
- **Autenticación**: sesión de Better Auth (cookie). Sin sesión → `401`.
- **Tenant (Principio III)**: toda operación de dominio se ejecuta en el contexto de
  la **organización activa** del usuario. El `organization_id` se deriva de la sesión,
  **nunca** del input del cliente. Un recurso de otra organización → `404` (no `403`,
  para no filtrar existencia).
- **Autorización (FR-008)**: acciones de cuenta/equipo y conexión de WhatsApp →
  rol `owner`. Operación diaria (bandeja, catálogo, candidaturas, muestras) → `owner`
  y `agent`.
- **Validación (Zod)**: todo input externo se valida con Zod; error de validación →
  `422` con detalle de campos.
- **IDs**: `text` con prefijo (`prop_`, `conv_`, `cand_`, …).
- **Forma de error**:
  ```json
  { "error": { "code": "string", "message": "string", "fields": { "campo": "motivo" } } }
  ```
- **Paginación**: `?cursor=<id>&limit=<n>` (default 50, máx 100); respuesta incluye
  `nextCursor`.
- **Secretos (Principio I)**: ninguna respuesta incluye tokens/credenciales; el token
  de Meta nunca se devuelve.

## Índice

- [whatsapp-webhook.md](./whatsapp-webhook.md) — webhook entrante de Meta (externo).
- [internal-api.md](./internal-api.md) — API interna por historia (P1–P4).
