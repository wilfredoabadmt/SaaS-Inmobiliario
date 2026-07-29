// @ts-check
/**
 * Cliente de pruebas de Evolution API para tu WhatsApp PERSONAL (tester).
 *
 * ⚠️ SEGURIDAD PRIMERO:
 *  - Solo se permite ENVIAR a destinos de una lista blanca configurada por TI en .env:
 *      · TESTER_WHATSAPP_NUMBER — tu WhatsApp personal (el que hace de "cliente" en las pruebas).
 *      · PLATFORM_TEST_NUMBER   — el número de PRUEBA que registraste en tu app de Meta;
 *        destino para generar entrantes hacia la bandeja en el loop de pruebas.
 *    Cualquier otro destino lanza error ANTES de tocar la red. Si NO configuras estas dos
 *    variables, la lista queda vacía y CUALQUIER envío se bloquea (fail-safe por diseño:
 *    nunca hay un número real hardcodeado en el código fuente).
 *  - Sin ráfagas: gap mínimo entre envíos + tope por corrida + jitter humano.
 *    El gap se persiste en disco para que también aplique entre ejecuciones.
 *  - Esto existe para que las pruebas automáticas NO disparen el antispam de
 *    WhatsApp ni bloqueen tu línea personal.
 *
 * Credenciales: SOLO desde .env (gitignored). NUNCA pegar en chat/logs.
 *   EVOLUTION_API_URL       p.ej. https://evo.midominio.com
 *   EVOLUTION_API_KEY       apikey de la instancia
 *   EVOLUTION_INSTANCE      nombre de la instancia
 *   TESTER_WHATSAPP_NUMBER  tu WhatsApp personal, con código de país (p.ej. 5215512345678)
 *   PLATFORM_TEST_NUMBER    número de prueba de tu app de Meta, con código de país
 *
 * NOTA (release comunidad): a la fecha de este release, la instancia de Evolution API de
 * referencia está fuera de servicio (en reparación) — este cliente y los scripts de
 * scripts/selftest/ y scripts/wa-tester/ que lo usan NO podrán correr hasta que apuntes
 * EVOLUTION_API_URL a tu propia instancia funcionando. El resto del SaaS (bandeja, agente,
 * WhatsApp Cloud API real) no depende de Evolution — Evolution es solo el "cliente de
 * pruebas" que simula ser tu cliente para el self-test automático.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Últimos 10 dígitos de un número, o null si no hay suficientes dígitos. */
function last10(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

// ---- Lista blanca (SOLO desde tu .env; vacía = todo bloqueado) -----------
const ALLOWED_LAST10 = [last10(process.env.TESTER_WHATSAPP_NUMBER), last10(process.env.PLATFORM_TEST_NUMBER)].filter(
  Boolean,
);

// Número de PRUEBA de la plataforma — destino para GENERAR entrantes hacia la bandeja.
// ⚠️ Debe incluir el código de país completo tal como lo registraste en Meta. Si tu número
// mexicano lleva el "1" de trunk (521...) y Evolution lo rechaza con `exists:false`, prueba
// sin el "1" (52...) — es un gotcha conocido de normalización MX, no de este código.
export const PLATFORM_NUMBER = process.env.PLATFORM_TEST_NUMBER || "";

// ---- Política anti-ráfaga -------------------------------------------------
const MIN_GAP_MS = 15_000; // mínimo 15 s entre mensajes salientes
const MAX_PER_RUN = 8; // tope de mensajes por ejecución del proceso
const JITTER_MS = 4_000; // hasta +4 s aleatorio para que no sea robótico
const STATE_FILE = join(tmpdir(), "inmox-wa-tester-state.json");

let sentThisRun = 0;

/** Solo dígitos. */
function digits(s) {
  return String(s).replace(/\D/g, "");
}

/** Permite cualquier formato (52…, 521…, +52…) cuyos últimos 10 dígitos sean los del tester. */
function isAllowed(number) {
  const d = digits(number);
  return d.length >= 10 && ALLOWED_LAST10.includes(d.slice(-10));
}

function readState() {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    /* corrupto → arrancar limpio */
  }
  return { lastSendAt: 0 };
}

function writeState(state) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state), "utf8");
  } catch {
    /* no es fatal para la prueba */
  }
}

function requireEnv() {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!url || !key || !instance) {
    throw new Error(
      "Faltan credenciales de Evolution en .env (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE). " +
        "NO las pegues en el chat: ponlas en .env (gitignored).",
    );
  }
  return { url: url.replace(/\/+$/, ""), key, instance };
}

async function evo(path, init = {}) {
  const { url, key } = requireEnv();
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(`Evolution ${res.status} en ${path}: ${JSON.stringify(body)?.slice(0, 300)}`);
  }
  return body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * READ-ONLY: confirma que la instancia está conectada al teléfono del tester.
 * No envía nada. Úsalo para "confirmar acceso" sin riesgo.
 */
export async function confirmAccess() {
  const { instance } = requireEnv();
  const state = await evo(`/instance/connectionState/${encodeURIComponent(instance)}`);
  return state;
}

/**
 * Envía un texto SOLO al tester, respetando el ritmo anti-ráfaga.
 * Lanza si el destino no es el permitido o si se excede el tope/gap.
 */
export async function sendText(number, text) {
  if (!isAllowed(number)) {
    throw new Error(
      `BLOQUEADO: destino no permitido (${digits(number).slice(-10)}). Solo se permite ${ALLOWED_LAST10.join(", ")}.`,
    );
  }
  if (sentThisRun >= MAX_PER_RUN) {
    throw new Error(`BLOQUEADO: tope de ${MAX_PER_RUN} mensajes por corrida alcanzado.`);
  }

  const st = readState();
  const since = Date.now() - (st.lastSendAt ?? 0);
  if (since < MIN_GAP_MS) {
    const wait = MIN_GAP_MS - since + Math.floor(Math.random() * JITTER_MS);
    await sleep(wait);
  } else {
    await sleep(Math.floor(Math.random() * JITTER_MS));
  }

  const { instance } = requireEnv();
  const result = await evo(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({ number: digits(number), text }),
  });

  sentThisRun += 1;
  writeState({ lastSendAt: Date.now() });
  return result;
}

/**
 * Envía una UBICACIÓN (mensaje NO textual) SOLO al tester, con el mismo guardrail
 * anti-ráfaga/allowlist que sendText. Útil para probar el manejo de no-texto del
 * agente (feature 005) sin necesidad de un archivo de audio/imagen.
 */
export async function sendLocation(number, { latitude = 19.4326, longitude = -99.1332, name = "CDMX", address = "Ciudad de México" } = {}) {
  if (!isAllowed(number)) {
    throw new Error(
      `BLOQUEADO: destino no permitido (${digits(number).slice(-10)}). Solo se permite ${ALLOWED_LAST10.join(", ")}.`,
    );
  }
  if (sentThisRun >= MAX_PER_RUN) {
    throw new Error(`BLOQUEADO: tope de ${MAX_PER_RUN} mensajes por corrida alcanzado.`);
  }
  const st = readState();
  const since = Date.now() - (st.lastSendAt ?? 0);
  await sleep(since < MIN_GAP_MS ? MIN_GAP_MS - since + Math.floor(Math.random() * JITTER_MS) : Math.floor(Math.random() * JITTER_MS));

  const { instance } = requireEnv();
  const result = await evo(`/message/sendLocation/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({ number: digits(number), name, address, latitude, longitude }),
  });
  sentThisRun += 1;
  writeState({ lastSendAt: Date.now() });
  return result;
}

export const _internal = { isAllowed, digits, ALLOWED_LAST10, MIN_GAP_MS, MAX_PER_RUN };
