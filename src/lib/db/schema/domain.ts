import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/** Enums de dominio (data-model.md). */
export const operationType = pgEnum("operation_type", ["renta", "venta"]);
export const propertyType = pgEnum("property_type", [
  "casa",
  "departamento",
  "local",
  "terreno",
]);
export const propertyStatus = pgEnum("property_status", [
  "disponible",
  "apartada",
  "cerrada",
]);
// El enum global `candidacy_stage` se retiró en la feature 010: las etapas pasaron a ser
// configurables por organización (tabla `pipeline_stage`) y `candidacy.stage_id` es ahora una
// FK. Ver specs/010-sales-pipeline/data-model.md (DV-SP-1).
export const contractStatus = pgEnum("contract_status", [
  "borrador",
  "enviado",
  "en_negociacion",
  "firmado",
]);
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageStatus = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
  "failed",
]);
export const connectionStatus = pgEnum("connection_status", [
  "connected",
  "disconnected",
  "expired",
]);
/**
 * Estado de la conexión de Instagram (feature 008). Separado del enum de WhatsApp para
 * no mutarlo y para añadir `reconnect_required` (token inválido / refresh fallido).
 */
export const igConnectionStatus = pgEnum("ig_connection_status", [
  "connected",
  "disconnected",
  "expired",
  "reconnect_required",
]);
export const showingStatus = pgEnum("showing_status", [
  "agendada",
  "realizada",
  "cancelada",
  "no_show",
]);
/**
 * Estado de la conexión de Google Calendar de un asesor (feature 011). Por-usuario.
 * `reconnect_required` = token inválido/revocado → la disponibilidad degrada a local.
 */
export const googleCalendarStatus = pgEnum("google_calendar_status", [
  "connected",
  "reconnect_required",
  "disconnected",
]);
export const documentType = pgEnum("document_type", [
  "identificacion",
  "comprobante_ingresos",
  "otro",
]);
/**
 * Motivo por el que una conversación requiere atención humana (feature 005).
 * `null` cuando `needs_human=false`. Lo fija quien hace el handoff/cesión.
 */
export const needsHumanReason = pgEnum("needs_human_reason", [
  "requested", // el cliente pidió un humano o el modelo decidió handoff (004)
  "out_of_window", // mensaje fuera de la ventana de 24 h (no se puede texto libre)
  "uninterpretable", // el cliente insiste con mensajes no textuales
  "ai_error", // el proveedor de IA falló o agotó timeout
]);

const orgFk = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

export const property = pgTable(
  "property",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    operationType: operationType("operation_type").notNull(),
    propertyType: propertyType("property_type").notNull(),
    title: text("title"),
    price: numeric("price", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    address: text("address"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1 }),
    builtAreaM2: numeric("built_area_m2", { precision: 10, scale: 2 }),
    lotAreaM2: numeric("lot_area_m2", { precision: 10, scale: 2 }),
    parkingSpaces: integer("parking_spaces"),
    status: propertyStatus("status").notNull().default("disponible"),
    description: text("description"),
    // Soft-delete (feature 007): null = activa; not null = archivada. Conserva el `status`
    // previo y todo el historial relacionado (conversación/visita/candidatura/mensajes).
    archivedAt: timestamp("archived_at"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("property_org_idx").on(t.organizationId),
    index("property_org_op_idx").on(t.organizationId, t.operationType),
    index("property_org_status_idx").on(t.organizationId, t.status),
    index("property_org_archived_idx").on(t.organizationId, t.archivedAt),
  ],
);

export const propertyPhoto = pgTable(
  "property_photo",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("property_photo_property_idx").on(t.propertyId)],
);

export const client = pgTable(
  "client",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    name: text("name"),
    phone: text("phone").notNull(),
    email: text("email"),
    notes: text("notes"),
    // Canal de origen del contacto (feature 009). `text` (no enum) para extensibilidad
    // WhatsApp→Instagram/Messenger sin ALTER TYPE; "manual" para altas a mano. El
    // DEFAULT 'whatsapp' backfilea a los existentes (todos vinieron de un inbound de
    // WhatsApp). Ver specs/009-client-management/data-model.md (DV-CM-1).
    channel: text("channel").notNull().default("whatsapp"),
    // Archivado (feature 009, soft-delete reversible como propiedades 007): null = activo;
    // not null = archivado (oculto de la lista, conserva conversación/historial/contratos).
    // Un inbound nuevo lo reactiva (archived_at→null) en ingest.ts.
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_org_phone_uq").on(t.organizationId, t.phone),
    index("client_org_archived_idx").on(t.organizationId, t.archivedAt),
  ],
);

/**
 * Requisitos de búsqueda del cliente (feature 004). 1:1 por cliente (upsert por
 * org+cliente). Origen `ai` (extraído por el agente) o `manual` (asesor). `version`
 * sube en cada cambio e invalida la caché de matches.
 */
export const clientRequirements = pgTable(
  "client_requirements",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    operation: operationType("operation"),
    budgetMin: numeric("budget_min", { precision: 14, scale: 2 }),
    budgetMax: numeric("budget_max", { precision: 14, scale: 2 }),
    zone: text("zone"),
    propertyType: propertyType("property_type"),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1 }),
    notes: text("notes"),
    source: text("source").notNull().default("ai"),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_requirements_org_client_uq").on(t.organizationId, t.clientId),
    index("client_requirements_org_idx").on(t.organizationId),
  ],
);

/**
 * Etapas del embudo de ventas, **configurables por organización** (feature 010, DV-SP-1).
 * Reemplaza el enum global `candidacy_stage`. `kind` fija el rol semántico: `normal` (editable
 * y eliminable) o un ancla `won`/`lost`/`visit` (siempre existe, no se elimina; su `label` es
 * editable). El embudo por defecto (8 etapas) se siembra por org desde `lib/design/status.ts`.
 */
export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    kind: text("kind").notNull().default("normal"),
    color: text("color"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("pipeline_stage_org_order_idx").on(t.organizationId, t.sortOrder),
    // Una sola ancla won/lost/visit por organización (las 'normal' pueden ser muchas).
    uniqueIndex("pipeline_stage_org_kind_anchor_uq")
      .on(t.organizationId, t.kind)
      .where(sql`${t.kind} <> 'normal'`),
  ],
);

export const candidacy = pgTable(
  "candidacy",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    // Propiedad opcional (feature 010, DV-SP-2): un lead temprano puede no tener propiedad aún.
    // ON DELETE set null: el trato sobrevive si la propiedad se borra (con 007 se archiva).
    propertyId: text("property_id").references(() => property.id, { onDelete: "set null" }),
    // Etapa configurable por org (feature 010): FK que reemplaza al enum global.
    stageId: text("stage_id")
      .notNull()
      .references(() => pipelineStage.id, { onDelete: "restrict" }),
    assignedAgentId: text("assigned_agent_id").references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Un trato por cliente×propiedad concreta.
    uniqueIndex("candidacy_org_client_property_uq").on(
      t.organizationId,
      t.clientId,
      t.propertyId,
    ),
    // A lo sumo un trato SIN propiedad por cliente (feature 010, DV-SP-2).
    uniqueIndex("candidacy_org_client_noprop_uq")
      .on(t.organizationId, t.clientId)
      .where(sql`${t.propertyId} is null`),
    index("candidacy_org_stage_idx").on(t.organizationId, t.stageId),
  ],
);

export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    waContactPhone: text("wa_contact_phone").notNull(),
    assignedAgentId: text("assigned_agent_id").references(() => user.id),
    lastMessageAt: timestamp("last_message_at"),
    // Agente de IA (feature 004): opt-in por conversación + handoff a humano.
    aiEnabled: boolean("ai_enabled").notNull().default(false),
    needsHuman: boolean("needs_human").notNull().default(false),
    // Robustez (feature 005): por qué requiere atención humana (null si needs_human=false).
    needsHumanReason: needsHumanReason("needs_human_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("conversation_org_last_msg_idx").on(t.organizationId, t.lastMessageAt)],
);

export const conversationProperty = pgTable(
  "conversation_property",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conv_prop_uq").on(t.conversationId, t.propertyId),
    // Una sola propiedad principal por conversación (índice único parcial).
    uniqueIndex("conv_prop_primary_uq")
      .on(t.conversationId)
      .where(sql`${t.isPrimary}`),
  ],
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    waMessageId: text("wa_message_id"),
    direction: messageDirection("direction").notNull(),
    senderUserId: text("sender_user_id").references(() => user.id),
    // Mensaje saliente generado por el agente de IA (feature 004) vs un humano.
    aiGenerated: boolean("ai_generated").notNull().default(false),
    // Tipo del mensaje entrante de WhatsApp (feature 005): text/audio/image/video/
    // document/location/sticker/contacts. `null` para salientes/históricos.
    waType: text("wa_type"),
    body: text("body"),
    templateId: text("template_id"),
    // Ficha-tarjeta de propiedad enviada (feature 006): enlaza el mensaje a su propiedad
    // para renderizar la burbuja de ficha en el hilo.
    propertyId: text("property_id").references(() => property.id, { onDelete: "set null" }),
    status: messageStatus("status"),
    waTimestamp: timestamp("wa_timestamp"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Idempotencia (Principio IV / FR-005): permite múltiples NULL (outbound).
    uniqueIndex("message_wa_message_id_uq").on(t.waMessageId),
    index("message_org_conv_created_idx").on(
      t.organizationId,
      t.conversationId,
      t.createdAt,
    ),
  ],
);

export const template = pgTable(
  "template",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    name: text("name").notNull(),
    waTemplateName: text("wa_template_name").notNull(),
    language: text("language").notNull(),
    // Categoría de Meta (MARKETING/UTILITY/AUTHENTICATION). text (no enum) por vocabulario externo
    // evolutivo (feature 012, DV-WT-2; espejo de la decisión `client.channel`).
    category: text("category"),
    body: text("body").notNull(),
    // --- Gestión real contra Meta (feature 012, aditivo). ---
    // ID de la plantilla en Meta (HSM id). Null hasta crear/sincronizar.
    waTemplateId: text("wa_template_id"),
    // Estatus de revisión de Meta (PENDING/APPROVED/REJECTED/PAUSED/DISABLED/…). text, no enum
    // (DV-WT-2). Null = "no sincronizada" (filas previas a 012).
    status: text("status"),
    // Razón de rechazo provista por Meta cuando status=REJECTED.
    rejectedReason: text("rejected_reason"),
    // Indicador de calidad de Meta (GREEN/YELLOW/RED/UNKNOWN).
    qualityRating: text("quality_rating"),
    // Modelo canónico de componentes (header/body/footer/buttons + variables/ejemplos). Fuente para
    // render/preview/envío. Ver lib/meta/templates.ts y data-model §3.
    components: jsonb("components"),
    // Última reconciliación con Meta (webhook o pull).
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("template_org_idx").on(t.organizationId),
    // Meta exige unicidad de name+language por WABA; lo reflejamos localmente (feature 012).
    uniqueIndex("template_org_name_lang_uq").on(
      t.organizationId,
      t.waTemplateName,
      t.language,
    ),
  ],
);

/**
 * Caché diaria de analítica de plantillas (feature 012, DV-WT-7). Métricas de uso + costo real
 * provistas por la Template Analytics API de Meta, cacheadas por (plantilla, día) para servir
 * cualquier rango sumando filas, sin re-pegarle a Meta en cada visita.
 */
export const templateAnalytics = pgTable(
  "template_analytics",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    sent: integer("sent").notNull().default(0),
    delivered: integer("delivered").notNull().default(0),
    read: integer("read").notNull().default(0),
    clicked: integer("clicked").notNull().default(0),
    // Costo real del día (null = "no disponible": Meta aún no lo expone para el rango/cuenta).
    cost: numeric("cost"),
    currency: text("currency"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("template_analytics_tpl_day_uq").on(t.templateId, t.day),
    index("template_analytics_org_idx").on(t.organizationId),
  ],
);

export const showing = pgTable(
  "showing",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    candidacyId: text("candidacy_id").references(() => candidacy.id, {
      onDelete: "set null",
    }),
    agentId: text("agent_id")
      .notNull()
      .references(() => user.id),
    scheduledAt: timestamp("scheduled_at").notNull(),
    // Duración efectiva (min) capturada de calendar_settings al crear (feature 011, DV-VS-12).
    durationMinutes: integer("duration_minutes"),
    remindAt: timestamp("remind_at"),
    // Evento espejo en el Google Calendar del asesor (feature 011, DV-VS-11). Null si no conectado.
    googleEventId: text("google_event_id"),
    // Idempotencia del recordatorio 1 h por email (feature 011, DV-VS-10).
    reminderEmailSentAt: timestamp("reminder_email_sent_at"),
    status: showingStatus("status").notNull().default("agendada"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("showing_org_scheduled_idx").on(t.organizationId, t.scheduledAt),
    index("showing_remind_idx").on(t.remindAt),
  ],
);

/**
 * Configuración de calendario por ASESOR (feature 011). 1:1 por (organization_id, user_id):
 * el producto opera como SaaS de agentes independientes (DV-VS-1). `weeklyHours` es jsonb con
 * intervalos wall-clock por día en la `timezone` del asesor; define la disponibilidad base.
 * Ver specs/011-visit-scheduling/data-model.md.
 */
export const calendarSettings = pgTable(
  "calendar_settings",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weeklyHours: jsonb("weekly_hours").notNull(),
    slotMinutes: integer("slot_minutes").notNull().default(60),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    timezone: text("timezone").notNull().default("America/Mexico_City"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("calendar_settings_org_user_uq").on(t.organizationId, t.userId)],
);

/**
 * Credenciales de Google Calendar por ASESOR (feature 011). 1:1 por (organization_id, user_id).
 * Access y refresh tokens cifrados AES-256-GCM por separado (DV-VS-7); NUNCA al cliente ni a
 * logs (Principio I). `status='reconnect_required'` cuando el token es inválido/revocado.
 */
export const googleCalendarCredentials = pgTable(
  "google_calendar_credentials",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    googleSub: text("google_sub").notNull(),
    email: text("email"),
    // Calendario destino donde se CREAN las visitas (feature 011, US4).
    calendarId: text("calendar_id").notNull().default("primary"),
    // Calendarios que CUENTAN para conflictos en freeBusy (jsonb array de ids). Null → [calendarId].
    conflictCalendarIds: jsonb("conflict_calendar_ids"),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    accessIv: text("access_iv").notNull(),
    accessAuthTag: text("access_auth_tag").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    refreshIv: text("refresh_iv"),
    refreshAuthTag: text("refresh_auth_tag"),
    scope: text("scope"),
    status: googleCalendarStatus("status").notNull().default("connected"),
    connectedAt: timestamp("connected_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("google_calendar_credentials_org_user_uq").on(t.organizationId, t.userId)],
);

export const candidateDocument = pgTable(
  "candidate_document",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    documentType: documentType("document_type").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("candidate_document_client_idx").on(t.clientId)],
);

export const contract = pgTable(
  "contract",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    candidacyId: text("candidacy_id")
      .notNull()
      .references(() => candidacy.id, { onDelete: "cascade" }),
    operationType: operationType("operation_type").notNull(),
    status: contractStatus("status").notNull().default("borrador"),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("contract_org_candidacy_idx").on(t.organizationId, t.candidacyId)],
);

export const metaCredentials = pgTable(
  "meta_credentials",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    wabaId: text("waba_id").notNull(),
    phoneNumberId: text("phone_number_id").notNull(),
    displayPhoneNumber: text("display_phone_number"),
    encryptedToken: text("encrypted_token").notNull(),
    tokenIv: text("token_iv").notNull(),
    authTag: text("auth_tag").notNull(),
    status: connectionStatus("status").notNull().default("connected"),
    connectedAt: timestamp("connected_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("meta_credentials_org_uq").on(t.organizationId),
    uniqueIndex("meta_credentials_phone_number_uq").on(t.phoneNumberId),
  ],
);

/**
 * Credenciales de Instagram (feature 008). 1:1 por agencia. Token largo (60 d) cifrado
 * AES-256-GCM; NUNCA se devuelve al cliente. `igUserId` UNIQUE = llave de enrutado de
 * webhooks (espejo de `phoneNumberId` en WhatsApp). Tabla nueva e independiente de
 * `metaCredentials` (que es WhatsApp-only). Ver data-model.md.
 */
export const instagramCredentials = pgTable(
  "instagram_credentials",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    igUserId: text("ig_user_id").notNull(),
    username: text("username").notNull(),
    encryptedToken: text("encrypted_token").notNull(),
    tokenIv: text("token_iv").notNull(),
    authTag: text("auth_tag").notNull(),
    tokenExpiresAt: timestamp("token_expires_at").notNull(),
    status: igConnectionStatus("status").notNull().default("connected"),
    connectedAt: timestamp("connected_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("instagram_credentials_org_uq").on(t.organizationId),
    uniqueIndex("instagram_credentials_ig_user_uq").on(t.igUserId),
  ],
);

/**
 * Registro local de publicaciones creadas desde Inmox (feature 008). Traza qué propiedad
 * se publicó y permite listar comentarios por `igMediaId`. `propertyId` set null si la
 * propiedad se borra (el post de IG sobrevive). Ver data-model.md.
 */
export const instagramPost = pgTable(
  "instagram_post",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    igMediaId: text("ig_media_id").notNull(),
    propertyId: text("property_id").references(() => property.id, { onDelete: "set null" }),
    caption: text("caption"),
    mediaType: text("media_type").notNull().default("IMAGE"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("instagram_post_media_uq").on(t.igMediaId),
    index("instagram_post_org_idx").on(t.organizationId),
  ],
);

/**
 * Log mínimo de DMs de Instagram (feature 008, US4). Resuelve F1 del analyze: da efecto
 * observable al DM entrante (FR-018), permite calcular la **ventana de 24 h** (FR-020) por
 * `counterpartyIgsid` y garantiza **idempotencia** (FR-023) con `igMessageId` UNIQUE. NO es
 * la bandeja unificada (sigue aislada de WhatsApp); es un registro propio del módulo IG.
 */
export const instagramDm = pgTable(
  "instagram_dm",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    counterpartyIgsid: text("counterparty_igsid").notNull(),
    direction: messageDirection("direction").notNull(),
    text: text("text"),
    /** `mid` del mensaje de IG; UNIQUE para deduplicar reintentos del webhook. */
    igMessageId: text("ig_message_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("instagram_dm_message_uq").on(t.igMessageId),
    index("instagram_dm_org_counterparty_idx").on(t.organizationId, t.counterpartyIgsid),
  ],
);
