// @ts-check
/**
 * Siembra datos de dominio de DEMO en la organización del usuario demo@inmox.test.
 * SQL directo (postgres-js) para no depender de los alias del app. Idempotente:
 * borra y reinserta los datos demo de ESA organización. NO toca otras orgs.
 *
 * Uso: node --env-file=.env scripts/seed/demo-tenant.mjs
 */

import postgres from "postgres";
import { nanoid } from "nanoid";

const DEMO_EMAIL = "demo@inmox.test";
const id = (p) => `${p}_${nanoid()}`;

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

function minsAgo(m) {
  return new Date(Date.now() - m * 60_000);
}

async function main() {
  const [org] = await sql`
    SELECT o.id FROM "organization" o
    JOIN "member" m ON m.organization_id = o.id
    JOIN "user" u ON u.id = m.user_id
    WHERE u.email = ${DEMO_EMAIL}
    LIMIT 1`;
  if (!org) {
    throw new Error(`No existe la org demo (${DEMO_EMAIL}). Corre primero el registro (capture.mjs).`);
  }
  const orgId = org.id;
  console.log("Org demo:", orgId);

  // Limpieza de datos demo previos de ESTA org (orden por FKs).
  await sql`DELETE FROM "message" WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM "conversation_property" WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM "conversation" WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM "candidacy" WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM "client" WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM "property" WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM "template" WHERE organization_id = ${orgId}`;

  // Propiedades
  const props = [
    { op: "renta", type: "departamento", title: "Depto en Polanco, 2 rec", price: 28500, cur: "MXN", nb: "Polanco", city: "CDMX", bd: 2, ba: 2, area: 95 },
    { op: "venta", type: "casa", title: "Casa en Valle Oriente", price: 6200000, cur: "MXN", nb: "Valle Oriente", city: "Monterrey", bd: 3, ba: 2.5, area: 210 },
    { op: "renta", type: "departamento", title: "Loft Roma Norte", price: 19000, cur: "MXN", nb: "Roma Norte", city: "CDMX", bd: 1, ba: 1, area: 58 },
    { op: "venta", type: "departamento", title: "PH Puerta de Hierro", price: 9800000, cur: "MXN", nb: "Puerta de Hierro", city: "Guadalajara", bd: 3, ba: 3, area: 240 },
  ].map((p) => ({ ...p, id: id("prop") }));

  for (const p of props) {
    await sql`
      INSERT INTO "property" (id, organization_id, operation_type, property_type, title, price, currency, neighborhood, city, bedrooms, bathrooms, built_area_m2, status)
      VALUES (${p.id}, ${orgId}, ${p.op}, ${p.type}, ${p.title}, ${p.price}, ${p.cur}, ${p.nb}, ${p.city}, ${p.bd}, ${p.ba}, ${p.area}, 'disponible')`;
  }

  // Clientes + conversaciones + mensajes
  const convos = [
    { name: "Ana Martínez", phone: "5215512345678", prop: 0, mins: 4, msgs: [
      ["inbound", "Hola, vi el depto de Polanco que publicaron, ¿sigue disponible?", 40],
      ["outbound", "¡Hola Ana! Sí, sigue disponible. ¿Te gustaría agendar una visita esta semana?", 36],
      ["inbound", "Me encantaría. ¿El jueves por la tarde se puede?", 5],
    ] },
    { name: "Luis Gómez", phone: "5218112223344", prop: 1, mins: 70, msgs: [
      ["inbound", "Buenas, me interesa la casa de Valle Oriente. ¿Manejan crédito?", 200],
      ["outbound", "Hola Luis, claro. Trabajamos con varios bancos. ¿Cuál es tu presupuesto aproximado?", 190],
    ] },
    { name: "Marta Ruiz", phone: "5213318889900", prop: 3, mins: 12, msgs: [
      ["inbound", "Hola, ¿el PH de Puerta de Hierro tiene lugar para 2 autos?", 15],
    ] },
    { name: "Carlos Vega", phone: "5215599887766", prop: 2, mins: 1440, msgs: [
      ["inbound", "¿Sigue disponible el loft de la Roma?", 1500],
      ["outbound", "¡Hola Carlos! Sí. Te comparto fotos y disponibilidad.", 1495],
    ] },
  ];

  for (const c of convos) {
    const clientId = id("cli");
    await sql`
      INSERT INTO "client" (id, organization_id, name, phone)
      VALUES (${clientId}, ${orgId}, ${c.name}, ${c.phone})`;

    const convId = id("conv");
    await sql`
      INSERT INTO "conversation" (id, organization_id, client_id, wa_contact_phone, last_message_at)
      VALUES (${convId}, ${orgId}, ${clientId}, ${c.phone}, ${minsAgo(c.mins)})`;

    const prop = props[c.prop];
    await sql`
      INSERT INTO "conversation_property" (id, organization_id, conversation_id, property_id, is_primary)
      VALUES (${id("cp")}, ${orgId}, ${convId}, ${prop.id}, true)`;

    for (const [dir, body, mins] of c.msgs) {
      const waId = dir === "inbound" ? id("wamid") : null;
      const status = dir === "outbound" ? "read" : null;
      await sql`
        INSERT INTO "message" (id, organization_id, conversation_id, wa_message_id, direction, body, status, created_at)
        VALUES (${id("msg")}, ${orgId}, ${convId}, ${waId}, ${dir}, ${body}, ${status}, ${minsAgo(mins)})`;
    }
  }

  // Plantilla aprobada de ejemplo
  await sql`
    INSERT INTO "template" (id, organization_id, name, wa_template_name, language, category, body)
    VALUES (${id("tmpl")}, ${orgId}, 'Recordatorio de visita', 'visit_reminder', 'es_MX', 'UTILITY',
      'Hola {{1}}, te recordamos tu visita a {{2}} el {{3}}. ¡Te esperamos!')`;

  console.log(`Sembrado: ${props.length} propiedades, ${convos.length} conversaciones.`);
  await sql.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  try { await sql.end(); } catch {}
  process.exit(1);
});
