# Phase 1 — Data Model

**Feature**: CRM Inmobiliario con WhatsApp · **Branch**: `001-realestate-whatsapp-crm`
· **Date**: 2026-06-07 · **ORM**: Drizzle (PostgreSQL)

Convenciones:

- **PK** `text` generada con nanoid + prefijo por entidad (D6 en research).
- **Tenant**: toda tabla de dominio incluye `organization_id text NOT NULL` con
  índice y FK → `organization.id`. Ninguna consulta de dominio se ejecuta sin filtro
  por `organization_id` (Principio III, vía helper `withTenant`).
- Timestamps `created_at`/`updated_at` (`timestamptz`, default `now()`).
- FKs con `ON DELETE CASCADE` salvo nota en contrario.

## Enums (pgEnum)

```text
operation_type   = renta | venta
property_type    = casa | departamento | local | terreno
property_status  = disponible | apartada | cerrada
candidacy_stage  = nuevo | contactado | calificado | visita_agendada
                 | documentacion | en_negociacion | ganado | perdido
contract_status  = borrador | enviado | en_negociacion | firmado
message_direction= inbound | outbound
message_status   = sent | delivered | read | failed         # solo outbound
connection_status= connected | disconnected | expired
showing_status   = agendada | realizada | cancelada | no_show
document_type    = identificacion | comprobante_ingresos | otro
member_role      = owner | agent                            # Better Auth
```

## Tablas de identidad / tenancy (Better Auth)

Gestionadas por Better Auth (+ plugin `organization`); se listan para contexto, no se
modelan a mano:

- **user**, **session**, **account**, **verification** — autenticación base.
- **organization** — la **agencia** (tenant). Raíz de aislamiento.
- **member** — usuario ∈ organización, con `role` ∈ {owner, agent} (FR-008).
- **invitation** — invitación de un owner a un agente (FR-009).

## Tablas de dominio

### property  (`prop_`) — P2
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `prop_…` |
| organization_id | text NOT NULL | FK org, **idx** |
| operation_type | operation_type NOT NULL | renta/venta (FR-011) |
| property_type | property_type NOT NULL | casa/departamento/local/terreno |
| title | text | título corto opcional |
| price | numeric(14,2) NOT NULL | monto |
| currency | text NOT NULL | p. ej. MXN, USD |
| address | text | dirección |
| neighborhood | text | colonia |
| city | text | ciudad |
| bedrooms | integer | recámaras |
| bathrooms | numeric(3,1) | admite medios baños |
| built_area_m2 | numeric(10,2) | m² construidos |
| lot_area_m2 | numeric(10,2) | m² de terreno |
| parking_spaces | integer | estacionamientos |
| status | property_status NOT NULL default 'disponible' | |
| description | text | descripción libre |
| created_by | text | FK user (member) |
| created_at / updated_at | timestamptz | |

Índices: `(organization_id)`, `(organization_id, operation_type)`,
`(organization_id, status)`.

### property_photo  (`photo_`) — P2
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `photo_…` |
| organization_id | text NOT NULL | idx |
| property_id | text NOT NULL | FK property (cascade) |
| storage_key | text NOT NULL | clave en S3 (no el binario) |
| content_type | text NOT NULL | image/jpeg\|png\|webp (FR-013) |
| size_bytes | integer NOT NULL | ≤ 10·1024·1024 (validado en upload) |
| sort_order | integer NOT NULL default 0 | orden en la ficha |
| created_at | timestamptz | |

Regla de negocio: **máx. 20 fotos por property** (FR-013), validada en la capa de
aplicación antes de confirmar el upload.

### client  (`cli_`) — P2
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `cli_…` |
| organization_id | text NOT NULL | idx |
| name | text | nombre del contacto |
| phone | text NOT NULL | E.164 (número de WhatsApp) |
| email | text | opcional |
| notes | text | |
| created_at / updated_at | timestamptz | |

Único: `(organization_id, phone)` — un contacto por número dentro de la agencia.

### candidacy  (`cand_`) — P2/P4
Par **(cliente, propiedad)** con su propio pipeline (FR-015, clarificación 5).
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `cand_…` |
| organization_id | text NOT NULL | idx |
| client_id | text NOT NULL | FK client |
| property_id | text NOT NULL | FK property |
| stage | candidacy_stage NOT NULL default 'nuevo' | pipeline de 8 estados |
| assigned_agent_id | text | FK user (member) |
| created_at / updated_at | timestamptz | |

Único: `(organization_id, client_id, property_id)` — una candidatura por par.
Un mismo `client` puede tener varias candidacies (una por propiedad), cada una con su
`stage` independiente.

### conversation  (`conv_`) — P1
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `conv_…` |
| organization_id | text NOT NULL | idx |
| client_id | text NOT NULL | FK client (contacto de WhatsApp) |
| wa_contact_phone | text NOT NULL | E.164 (denormalizado) |
| assigned_agent_id | text | FK user (member) |
| last_message_at | timestamptz | orden en la bandeja |
| created_at | timestamptz | |

Índices: `(organization_id, last_message_at desc)` para la lista de la bandeja.

**Cardinalidad (DV-4, modelo rico confirmado)**: `client` 1:N `conversation` — un mismo
cliente PUEDE tener varias conversaciones (no se fuerza una sola por cliente). Cada
conversación se asocia a varias propiedades vía `conversation_property` (M:N) con una
`is_primary`. No se simplifica.

### conversation_property  (`cp_`) — P2
Relación **muchos-a-muchos** conversación↔propiedad con flag principal (FR-014,
clarificación 3).
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `cp_…` |
| organization_id | text NOT NULL | idx |
| conversation_id | text NOT NULL | FK conversation (cascade) |
| property_id | text NOT NULL | FK property (cascade) |
| is_primary | boolean NOT NULL default false | la "principal" en la bandeja |
| created_at | timestamptz | |

Único: `(conversation_id, property_id)`. Índice único **parcial**:
`UNIQUE (conversation_id) WHERE is_primary` — a lo sumo una principal por conversación.

### message  (`msg_`) — P1
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `msg_…` |
| organization_id | text NOT NULL | idx |
| conversation_id | text NOT NULL | FK conversation (cascade) |
| wa_message_id | text | id de WhatsApp (inbound) |
| direction | message_direction NOT NULL | inbound/outbound |
| sender_user_id | text | FK user (outbound); null en inbound |
| body | text | texto del mensaje |
| template_id | text | FK template (outbound por plantilla) |
| status | message_status | solo outbound |
| wa_timestamp | timestamptz | marca de tiempo de WhatsApp |
| created_at | timestamptz | |

**Idempotencia (Principio IV / FR-005)**: índice **UNIQUE** `(wa_message_id)` (donde
no nulo); el insert de webhooks usa `ON CONFLICT DO NOTHING`.
Índice: `(organization_id, conversation_id, created_at)`.

### template  (`tmpl_`) — P1
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `tmpl_…` |
| organization_id | text NOT NULL | idx |
| name | text NOT NULL | nombre interno |
| wa_template_name | text NOT NULL | nombre aprobado en Meta |
| language | text NOT NULL | p. ej. es_MX |
| category | text | confirmacion_cita \| ficha_propiedad \| … |
| body | text NOT NULL | cuerpo con placeholders |
| created_at / updated_at | timestamptz | |

(Asunción: plantillas previamente aprobadas en Meta — Assumptions del spec.)

### showing  (`show_`) — P3
Muestra/visita de una propiedad (FR-016/FR-017).
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `show_…` |
| organization_id | text NOT NULL | idx |
| property_id | text NOT NULL | FK property |
| candidacy_id | text | FK candidacy (opcional) |
| agent_id | text NOT NULL | FK user (responsable) |
| scheduled_at | timestamptz NOT NULL | fecha/hora de la cita |
| remind_at | timestamptz | momento del recordatorio (default 24 h / 1 h antes) |
| status | showing_status NOT NULL default 'agendada' | |
| notes | text | |
| created_at / updated_at | timestamptz | |

Índice: `(organization_id, scheduled_at)`, `(remind_at) WHERE status = 'agendada'`
para el barrido de recordatorios.

### candidate_document  (`doc_`) — P4
Expediente documental (FR-019). **Decisión de diseño**: se ancla al **client**
(persona), no a la candidatura, para que identificación/comprobante se reutilicen
entre las distintas candidaturas del mismo cliente (ver DV-… N/A; nota de diseño).
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `doc_…` |
| organization_id | text NOT NULL | idx |
| client_id | text NOT NULL | FK client (cascade) |
| document_type | document_type NOT NULL | identificacion/comprobante_ingresos/otro |
| storage_key | text NOT NULL | clave en S3 |
| file_name | text NOT NULL | nombre original |
| content_type | text NOT NULL | |
| size_bytes | integer NOT NULL | |
| uploaded_by | text NOT NULL | FK user |
| created_at | timestamptz | |

### contract  (`ctr_`) — P4
Contrato **subido externamente** (FR-020/FR-021); el sistema **no lo genera**
(FR-022).
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `ctr_…` |
| organization_id | text NOT NULL | idx |
| candidacy_id | text NOT NULL | FK candidacy (la operación) |
| operation_type | operation_type NOT NULL | renta/venta |
| status | contract_status NOT NULL default 'borrador' | borrador→enviado→en_negociacion→firmado |
| storage_key | text NOT NULL | archivo subido (S3) |
| file_name | text NOT NULL | |
| content_type | text NOT NULL | |
| size_bytes | integer NOT NULL | |
| uploaded_by | text NOT NULL | FK user |
| created_at / updated_at | timestamptz | |

### meta_credentials  (`wamc_`) — P1
Credenciales de la conexión de WhatsApp; **token cifrado en reposo** (D4 / FR-006).
| Campo | Tipo | Notas |
|------|------|------|
| id | text PK | `wamc_…` |
| organization_id | text NOT NULL | **UNIQUE** (un número por agencia, v1) |
| waba_id | text NOT NULL | WhatsApp Business Account id |
| phone_number_id | text NOT NULL | id del número en Cloud API |
| display_phone_number | text | número legible |
| encrypted_token | text NOT NULL | AES-256-GCM (base64) |
| token_iv | text NOT NULL | nonce 12 bytes (base64) |
| auth_tag | text NOT NULL | tag GCM (base64) |
| status | connection_status NOT NULL default 'connected' | |
| connected_at / updated_at | timestamptz | |

El token jamás se serializa al cliente ni se registra (Principio I).

## Relaciones (resumen)

```text
organization 1─┬─* member ─ user
               ├─* property ─* property_photo
               ├─* client ─* candidate_document
               ├─* client ─* candidacy *─ property
               ├─* conversation *─(conversation_property)─* property   [M:N, is_primary]
               ├─* conversation ─* message ─?─ template
               ├─* candidacy ─* contract
               ├─* candidacy ─* showing ─ property / agent
               └─1 meta_credentials   (1 por agencia en v1)
```

## Transiciones de estado

**candidacy.stage** (pipeline de 8, FR-015):
```text
nuevo → contactado → calificado → visita_agendada → documentacion
      → en_negociacion → ganado
cualquier estado activo → perdido    (cierre negativo)
```
`ganado` y `perdido` son terminales. Se permite retroceder un paso con registro del
cambio (no se entierra; Principio VII). El estado **`documentacion` es manual**
(DV-5): lo marca el agente cuando solicita documentos al candidato; **no** es un
cambio automático al subir archivos al expediente.

**contract.status** (FR-021):
```text
borrador → enviado → en_negociacion → firmado
```
`firmado` es terminal. El sistema **solo** registra el estado del archivo subido; no
genera el documento (FR-022).

**showing.status**:
```text
agendada → realizada
agendada → cancelada
agendada → no_show     (pasó la fecha sin realizarse)
```

## Reglas de validación (Zod, en todo input externo)

- `property`: `price > 0`, `currency` ∈ catálogo, enums válidos, `bedrooms/bathrooms/parking ≥ 0`.
- `property_photo`: `content_type` ∈ {jpeg,png,webp}, `size_bytes ≤ 10MB`, ≤20 por property.
- `client.phone`: formato E.164.
- `candidacy`: unicidad (client, property); `stage` ∈ enum.
- `message` inbound: firma de webhook válida + `wa_message_id` presente (idempotencia).
- `contract`/`candidate_document`: tipo MIME permitido; tamaño dentro de límite.
- Toda mutación valida que las FKs referenciadas pertenezcan al **mismo**
  `organization_id` (defensa de tenant, Principio III).
