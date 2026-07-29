/**
 * Fixtures de muestra — feature 003-design-system (decisión D3).
 *
 * Datos FICTICIOS para fidelidad visual de las vistas cuyo backend aún no existe
 * (Dashboard, Propiedades, Pipeline, Visitas, Clientes) y del panel de matching.
 * NINGUNA feature de producción depende de esto. Cada feature funcional posterior
 * reemplaza el fixture correspondiente por queries con scope de tenant.
 */
import type {
  ClientRequirements,
  ConversationListItem,
  Match,
  MessageItem,
  PropertyView,
  TemplateItem,
} from "@/lib/inbox/types";
import type { PipelineStage, VisitStatus } from "@/lib/design/status";

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

// ---------- Inventario ----------
export const SAMPLE_PROPERTIES: PropertyView[] = [
  {
    id: "p1",
    title: "Depto en Polanco, 2 rec",
    operation: "renta",
    zone: "Polanco, CDMX",
    type: "Departamento",
    priceLabel: "$28,000",
    specs: "2 rec · 2 baños · 95 m²",
    status: "disponible",
    photoSeed: "polanco",
  },
  {
    id: "p2",
    title: "Casa en Valle Oriente",
    operation: "venta",
    zone: "Valle Oriente, MTY",
    type: "Casa",
    priceLabel: "$8,900,000",
    specs: "4 rec · 4.5 baños · 320 m²",
    status: "disponible",
    photoSeed: "valle",
  },
  {
    id: "p3",
    title: "Loft en Roma Norte",
    operation: "renta",
    zone: "Roma Norte, CDMX",
    type: "Loft",
    priceLabel: "$19,500",
    specs: "1 rec · 1 baño · 58 m²",
    status: "apartada",
    photoSeed: "roma",
  },
  {
    id: "p4",
    title: "PH en Puerta de Hierro",
    operation: "venta",
    zone: "Puerta de Hierro, GDL",
    type: "Penthouse",
    priceLabel: "$12,500,000",
    specs: "3 rec · 3.5 baños · 240 m²",
    status: "disponible",
    photoSeed: "hierro",
  },
  {
    id: "p5",
    title: "Depto en Del Valle",
    operation: "renta",
    zone: "Del Valle, CDMX",
    type: "Departamento",
    priceLabel: "$22,000",
    specs: "2 rec · 2 baños · 82 m²",
    status: "disponible",
    photoSeed: "delvalle",
  },
  {
    id: "p6",
    title: "Casa en Cumbres",
    operation: "venta",
    zone: "Cumbres, MTY",
    type: "Casa",
    priceLabel: "$5,400,000",
    specs: "3 rec · 2.5 baños · 210 m²",
    status: "cerrada",
    photoSeed: "cumbres",
  },
  {
    id: "p7",
    title: "Depto en Condesa",
    operation: "renta",
    zone: "Condesa, CDMX",
    type: "Departamento",
    priceLabel: "$24,000",
    specs: "2 rec · 1.5 baños · 76 m²",
    status: "disponible",
    photoSeed: "condesa",
  },
  {
    id: "p8",
    title: "Terreno en San Pedro",
    operation: "venta",
    zone: "San Pedro, MTY",
    type: "Terreno",
    priceLabel: "$6,200,000",
    specs: "420 m² · uso mixto",
    status: "disponible",
    photoSeed: "sanpedro",
  },
];

const byId = (id: string): PropertyView =>
  SAMPLE_PROPERTIES.find((p) => p.id === id) ?? SAMPLE_PROPERTIES[0]!;

// ---------- Plantillas ----------
export const SAMPLE_TEMPLATES: TemplateItem[] = [
  {
    id: "t1",
    name: "recordatorio_visita",
    category: "UTILITY",
    body: "Hola {{1}}, te recordamos tu visita a {{2}} el {{3}}. ¡Te esperamos!",
    variables: 3,
  },
  {
    id: "t2",
    name: "seguimiento_lead",
    category: "MARKETING",
    body: "Hola {{1}}, ¿seguimos con tu búsqueda? Tengo opciones nuevas para ti.",
    variables: 1,
  },
];

// ---------- Requisitos + matches por cliente ----------
const reqAna: ClientRequirements = {
  operation: "renta",
  budgetLabel: "$25–30k/mes",
  zone: "Polanco / Anzures",
  propertyType: "Departamento",
  bedrooms: 2,
  bathrooms: 2,
};

const matchesAna: Match[] = [
  {
    property: byId("p1"),
    pct: 96,
    reasons: [
      { ok: true, label: "Zona: Polanco" },
      { ok: true, label: "2 recámaras" },
      { ok: true, label: "Dentro de presupuesto" },
    ],
    why: "Coincide en zona, recámaras y presupuesto; es la mejor opción para Ana.",
  },
  {
    property: byId("p7"),
    pct: 81,
    reasons: [
      { ok: true, label: "2 recámaras" },
      { ok: true, label: "Dentro de presupuesto" },
      { ok: false, label: "Zona: Condesa (no Polanco)" },
    ],
    why: "Cumple recámaras y precio, pero está en Condesa, no en la zona pedida.",
  },
  {
    property: byId("p5"),
    pct: 74,
    reasons: [
      { ok: true, label: "2 recámaras" },
      { ok: true, label: "Dentro de presupuesto" },
      { ok: false, label: "Zona: Del Valle" },
    ],
    why: "Buena relación precio/espacio, fuera de la zona principal.",
  },
];

const reqLuis: ClientRequirements = {
  operation: "venta",
  budgetLabel: "$8–10M",
  zone: "Valle Oriente / San Pedro",
  propertyType: "Casa",
  bedrooms: 4,
  bathrooms: 4,
};

const matchesLuis: Match[] = [
  {
    property: byId("p2"),
    pct: 92,
    reasons: [
      { ok: true, label: "Zona: Valle Oriente" },
      { ok: true, label: "4 recámaras" },
      { ok: true, label: "Dentro de presupuesto" },
    ],
    why: "Encaja en zona, recámaras y presupuesto para compra.",
  },
  {
    property: byId("p8"),
    pct: 63,
    reasons: [
      { ok: true, label: "Zona: San Pedro" },
      { ok: false, label: "Es terreno, no casa" },
    ],
    why: "Ubicación premium pero es terreno; solo si considera construir.",
  },
];

// ---------- Conversaciones (bandeja) ----------
export const SAMPLE_CONVERSATIONS: ConversationListItem[] = [
  {
    id: "conv1",
    clientName: "Ana Martínez",
    clientPhone: "+52 1 55 1234 5678",
    clientEmail: "ana.martinez@gmail.com",
    lastMessageAt: iso(5),
    lastMessagePreview: "Me encantaría. ¿El jueves por la tarde se puede?",
    unread: 2,
    assignee: "Carlos R.",
    stage: "calificado",
    notes: "Busca mudarse antes de fin de mes. Mascota pequeña.",
    primaryProperty: { id: "p1", title: "Depto en Polanco, 2 rec", operationType: "renta" },
    requirements: reqAna,
    matches: matchesAna,
  },
  {
    id: "conv2",
    clientName: "Luis Gómez",
    clientPhone: "+52 1 81 1222 3344",
    clientEmail: "luisgomez@outlook.com",
    lastMessageAt: iso(70),
    lastMessagePreview: "¿Manejan crédito hipotecario?",
    unread: 0,
    assignee: "Carlos R.",
    stage: "contactado",
    notes: "Vende su casa actual; busca algo más grande.",
    primaryProperty: { id: "p2", title: "Casa en Valle Oriente", operationType: "venta" },
    requirements: reqLuis,
    matches: matchesLuis,
  },
  {
    id: "conv3",
    clientName: "Marta Ruiz",
    clientPhone: "+52 1 33 1888 9900",
    clientEmail: null,
    lastMessageAt: iso(12),
    lastMessagePreview: "¿Sigue disponible el PH?",
    unread: 1,
    assignee: "Sin asignar",
    stage: "nuevo",
    notes: "",
    primaryProperty: { id: "p4", title: "PH en Puerta de Hierro", operationType: "venta" },
    requirements: {
      operation: "venta",
      budgetLabel: "$10–13M",
      zone: "Puerta de Hierro",
      propertyType: "Penthouse",
      bedrooms: 3,
    },
    matches: [
      {
        property: byId("p4"),
        pct: 88,
        reasons: [
          { ok: true, label: "Zona: Puerta de Hierro" },
          { ok: true, label: "3 recámaras" },
          { ok: true, label: "Dentro de presupuesto" },
        ],
        why: "Coincide en zona, recámaras y presupuesto.",
      },
    ],
  },
  {
    id: "conv4",
    clientName: "Carlos Vega",
    clientPhone: "+52 1 55 9988 7766",
    clientEmail: "cvega@gmail.com",
    lastMessageAt: iso(1440),
    lastMessagePreview: "Gracias, lo pienso y te aviso.",
    unread: 0,
    assignee: "Lucía M.",
    stage: "visita_agendada",
    notes: "Visita agendada para el sábado.",
    primaryProperty: { id: "p3", title: "Loft en Roma Norte", operationType: "renta" },
    requirements: {
      operation: "renta",
      budgetLabel: "$18–22k/mes",
      zone: "Roma / Condesa",
      propertyType: "Loft",
      bedrooms: 1,
    },
    matches: [
      {
        property: byId("p3"),
        pct: 90,
        reasons: [
          { ok: true, label: "Zona: Roma Norte" },
          { ok: true, label: "Dentro de presupuesto" },
        ],
        why: "Ubicación y precio ideales para lo que busca.",
      },
      {
        property: byId("p7"),
        pct: 70,
        reasons: [
          { ok: true, label: "Zona: Condesa" },
          { ok: false, label: "2 rec (pidió 1)" },
        ],
        why: "Cerca de su zona; algo más grande de lo necesario.",
      },
    ],
  },
];

// ---------- Mensajes por conversación ----------
export const SAMPLE_MESSAGES: Record<string, MessageItem[]> = {
  conv1: [
    {
      id: "m1",
      direction: "inbound",
      body: "Hola, vi el depto de Polanco que publicaron, ¿sigue disponible?",
      status: null,
      createdAt: iso(40),
    },
    {
      id: "m2",
      direction: "outbound",
      body: "¡Hola Ana! Sí, sigue disponible. ¿Te gustaría agendar una visita esta semana?",
      status: "read",
      createdAt: iso(36),
    },
    {
      id: "m3",
      direction: "outbound",
      body: "Te comparto la ficha por si quieres revisar los detalles 👇",
      status: "read",
      createdAt: iso(35),
    },
    {
      id: "m4",
      direction: "outbound",
      body: null,
      status: "read",
      createdAt: iso(35),
      kind: "property",
      property: byId("p1"),
    },
    {
      id: "m5",
      direction: "inbound",
      body: "Me encantaría. ¿El jueves por la tarde se puede?",
      status: null,
      createdAt: iso(5),
    },
  ],
  conv2: [
    {
      id: "m6",
      direction: "inbound",
      body: "Buenas, me interesa la casa de Valle Oriente. ¿Manejan crédito hipotecario?",
      status: null,
      createdAt: iso(200),
    },
    {
      id: "m7",
      direction: "outbound",
      body: "Hola Luis, claro. Trabajamos con varios bancos. ¿Cuál es tu presupuesto aproximado?",
      status: "delivered",
      createdAt: iso(190),
    },
  ],
  conv3: [
    {
      id: "m8",
      direction: "inbound",
      body: "¿Sigue disponible el PH de Puerta de Hierro?",
      status: null,
      createdAt: iso(12),
    },
  ],
  conv4: [
    {
      id: "m9",
      direction: "inbound",
      body: "Me gustó el loft de Roma. ¿Cuándo lo puedo ver?",
      status: null,
      createdAt: iso(1500),
    },
    {
      id: "m10",
      direction: "outbound",
      body: "Te agendo el sábado a las 12. ¿Te funciona?",
      status: "read",
      createdAt: iso(1480),
    },
    {
      id: "m11",
      direction: "inbound",
      body: "Gracias, lo pienso y te aviso.",
      status: null,
      createdAt: iso(1440),
    },
  ],
};

// ---------- Dashboard ----------
export interface KpiData {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "warn";
}

export const SAMPLE_KPIS: KpiData[] = [
  { label: "Leads nuevos", value: "12", delta: "▲ 3 hoy" },
  { label: "Conversaciones activas", value: "28" },
  { label: "Visitas esta semana", value: "7" },
  { label: "Cierres del mes", value: "3", delta: "$14.2M" },
  { label: "Sin responder", value: "4", tone: "warn" },
];

export interface ActivityItem {
  actor: string;
  text: string;
  time: string;
}

export const SAMPLE_ACTIVITY: ActivityItem[] = [
  { actor: "Carlos R.", text: "agendó una visita con Ana Martínez (Polanco)", time: "hace 8 min" },
  { actor: "Lucía M.", text: "movió a Carlos Vega a «Visita agendada»", time: "hace 32 min" },
  { actor: "Carlos R.", text: "envió la ficha de Valle Oriente a Luis Gómez", time: "hace 1 h" },
  { actor: "Sistema", text: "marcó 4 leads sin responder (> 30 min)", time: "hace 1 h" },
];

export interface UpcomingVisit {
  month: string;
  day: string;
  client: string;
  property: string;
  time: string;
  agent: string;
  operation: "renta" | "venta";
}

export const SAMPLE_UPCOMING_VISITS: UpcomingVisit[] = [
  {
    month: "JUN",
    day: "20",
    client: "Carlos Vega",
    property: "Loft en Roma Norte",
    time: "12:00",
    agent: "Lucía M.",
    operation: "renta",
  },
  {
    month: "JUN",
    day: "21",
    client: "Ana Martínez",
    property: "Depto en Polanco",
    time: "17:30",
    agent: "Carlos R.",
    operation: "renta",
  },
  {
    month: "JUN",
    day: "22",
    client: "Luis Gómez",
    property: "Casa en Valle Oriente",
    time: "11:00",
    agent: "Carlos R.",
    operation: "venta",
  },
];

// ---------- Visitas (showings) ----------
export interface VisitRow {
  id: string;
  client: string;
  operation: "renta" | "venta";
  property: string;
  dateLabel: string;
  month: string;
  day: string;
  time: string;
  agent: string;
  status: VisitStatus;
}

export const SAMPLE_VISITS: VisitRow[] = [
  {
    id: "v1",
    client: "Carlos Vega",
    operation: "renta",
    property: "Loft en Roma Norte",
    dateLabel: "Sáb 20 jun",
    month: "JUN",
    day: "20",
    time: "12:00",
    agent: "Lucía M.",
    status: "agendada",
  },
  {
    id: "v2",
    client: "Ana Martínez",
    operation: "renta",
    property: "Depto en Polanco",
    dateLabel: "Dom 21 jun",
    month: "JUN",
    day: "21",
    time: "17:30",
    agent: "Carlos R.",
    status: "agendada",
  },
  {
    id: "v3",
    client: "Luis Gómez",
    operation: "venta",
    property: "Casa en Valle Oriente",
    dateLabel: "Lun 22 jun",
    month: "JUN",
    day: "22",
    time: "11:00",
    agent: "Carlos R.",
    status: "agendada",
  },
  {
    id: "v4",
    client: "Marta Ruiz",
    operation: "venta",
    property: "PH en Puerta de Hierro",
    dateLabel: "Mié 17 jun",
    month: "JUN",
    day: "17",
    time: "16:00",
    agent: "Lucía M.",
    status: "realizada",
  },
  {
    id: "v5",
    client: "Jorge Díaz",
    operation: "renta",
    property: "Depto en Del Valle",
    dateLabel: "Mar 16 jun",
    month: "JUN",
    day: "16",
    time: "10:00",
    agent: "Carlos R.",
    status: "no_show",
  },
  {
    id: "v6",
    client: "Sofía Lara",
    operation: "venta",
    property: "Casa en Cumbres",
    dateLabel: "Lun 15 jun",
    month: "JUN",
    day: "15",
    time: "13:00",
    agent: "Lucía M.",
    status: "cancelada",
  },
];

// ---------- Clientes ----------
export interface ClientRow {
  id: string;
  name: string;
  phone: string;
  interest: string;
  operation: "renta" | "venta";
  stage: PipelineStage;
  lastContact: string;
}

export const SAMPLE_CLIENTS: ClientRow[] = [
  {
    id: "c1",
    name: "Ana Martínez",
    phone: "+52 55 1234 5678",
    interest: "Depto en Polanco",
    operation: "renta",
    stage: "calificado",
    lastContact: "hace 5 min",
  },
  {
    id: "c2",
    name: "Luis Gómez",
    phone: "+52 81 1222 3344",
    interest: "Casa en Valle Oriente",
    operation: "venta",
    stage: "contactado",
    lastContact: "hace 1 h",
  },
  {
    id: "c3",
    name: "Marta Ruiz",
    phone: "+52 33 1888 9900",
    interest: "PH en Puerta de Hierro",
    operation: "venta",
    stage: "nuevo",
    lastContact: "hace 12 min",
  },
  {
    id: "c4",
    name: "Carlos Vega",
    phone: "+52 55 9988 7766",
    interest: "Loft en Roma Norte",
    operation: "renta",
    stage: "visita_agendada",
    lastContact: "ayer",
  },
  {
    id: "c5",
    name: "Sofía Lara",
    phone: "+52 81 4040 1212",
    interest: "Casa en Cumbres",
    operation: "venta",
    stage: "en_negociacion",
    lastContact: "hace 2 días",
  },
  {
    id: "c6",
    name: "Jorge Díaz",
    phone: "+52 55 7070 3030",
    interest: "Depto en Del Valle",
    operation: "renta",
    stage: "documentacion",
    lastContact: "hace 3 días",
  },
];

// ---------- Pipeline (leads) ----------
export interface Lead {
  id: string;
  client: string;
  property: string;
  operation: "renta" | "venta";
  agent: string;
  stage: PipelineStage;
}

export const SAMPLE_LEADS: Lead[] = [
  { id: "l1", client: "Marta Ruiz", property: "PH en Puerta de Hierro", operation: "venta", agent: "Sin asignar", stage: "nuevo" },
  { id: "l2", client: "Pedro Sánchez", property: "Depto en Condesa", operation: "renta", agent: "Lucía M.", stage: "nuevo" },
  { id: "l3", client: "Luis Gómez", property: "Casa en Valle Oriente", operation: "venta", agent: "Carlos R.", stage: "contactado" },
  { id: "l4", client: "Ana Martínez", property: "Depto en Polanco", operation: "renta", agent: "Carlos R.", stage: "calificado" },
  { id: "l5", client: "Carlos Vega", property: "Loft en Roma Norte", operation: "renta", agent: "Lucía M.", stage: "visita_agendada" },
  { id: "l6", client: "Jorge Díaz", property: "Depto en Del Valle", operation: "renta", agent: "Carlos R.", stage: "documentacion" },
  { id: "l7", client: "Sofía Lara", property: "Casa en Cumbres", operation: "venta", agent: "Lucía M.", stage: "en_negociacion" },
  { id: "l8", client: "Roberto Fox", property: "Terreno en San Pedro", operation: "venta", agent: "Carlos R.", stage: "ganado" },
];
