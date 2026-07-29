import { getEnv } from "@/lib/env";
import { runAgentForInboundMessage } from "@/server/ai/agent";

/**
 * Coalescencia de ráfaga del agente (feature 005, RB-3). Estado **en memoria** por
 * conversación (supuesto: instancia única en Coolify). Agrupa mensajes consecutivos
 * del cliente con un *debounce* corto y serializa con un *lock* por conversación, de
 * modo que una ráfaga produce **una** corrida del agente —que relee el historial de la
 * BD (coalescencia natural)—.
 *
 * No persiste nada: si el proceso se reinicia se pierde un debounce en vuelo (el
 * próximo mensaje vuelve a disparar). La idempotencia del INSERT del entrante
 * (UNIQUE `wa_message_id`) es independiente de esto. Escalar a varias instancias
 * requeriría un lock compartido (BD/Redis) — ver Complexity Tracking del plan.
 */

interface ConvState {
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  pending: boolean;
  organizationId: string;
}

const states = new Map<string, ConvState>();

/** Programa (o reprograma con debounce) una corrida del agente para la conversación. */
export function scheduleAgentRun(organizationId: string, conversationId: string): void {
  const delay = getEnv().AGENT_COALESCE_MS;
  let st = states.get(conversationId);
  if (!st) {
    st = { timer: null, running: false, pending: false, organizationId };
    states.set(conversationId, st);
  }
  st.organizationId = organizationId;

  // Si hay una corrida en vuelo, marca para re-correr al terminar (coalesce).
  if (st.running) {
    st.pending = true;
    return;
  }
  // Cada mensaje nuevo reinicia el temporizador: la respuesta espera el final de la ráfaga.
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(() => void fire(conversationId), delay);
}

async function fire(conversationId: string): Promise<void> {
  const st = states.get(conversationId);
  if (!st) return;
  st.timer = null;
  if (st.running) {
    st.pending = true;
    return;
  }
  st.running = true;
  st.pending = false;
  try {
    await runAgentForInboundMessage({ organizationId: st.organizationId, conversationId });
  } finally {
    st.running = false;
    if (st.pending) {
      st.pending = false;
      // Re-corre una vez con lo acumulado durante la corrida anterior.
      scheduleAgentRun(st.organizationId, conversationId);
    } else if (!st.timer) {
      states.delete(conversationId);
    }
  }
}
