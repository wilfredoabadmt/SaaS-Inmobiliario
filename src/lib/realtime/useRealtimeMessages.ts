"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Abstracción de transporte en vivo (DV-1). El resto de la app consume este hook
 * sin saber si por dentro es polling o websocket. En el MVP usa **polling**;
 * migrar a websocket en v1.1 solo cambia la implementación interna de este módulo.
 */
export interface RealtimeOptions {
  /** Intervalo de polling en ms (MVP). */
  intervalMs?: number;
  enabled?: boolean;
}

export interface RealtimeState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

export function useRealtimeMessages<T>(
  fetcher: () => Promise<T>,
  options: RealtimeOptions = {},
): RealtimeState<T> {
  const { intervalMs = 4000, enabled = true } = options;
  const [state, setState] = useState<RealtimeState<T>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const tick = async () => {
      try {
        const data = await fetcherRef.current();
        if (active) setState({ data, error: null, isLoading: false });
      } catch (err) {
        if (active) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err : new Error(String(err)),
            isLoading: false,
          }));
        }
      }
    };

    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, intervalMs]);

  return state;
}
