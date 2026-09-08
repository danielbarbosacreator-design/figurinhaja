"use client";

import { useEffect, useRef } from "react";

/**
 * Executa `fn` repetidamente até que ela retorne `true` (condição de parada)
 * ou o componente desmonte. Sem recursão de callback — o loop vive no efeito.
 *
 * `fn` é guardada em ref, então pode fechar sobre estado atual sem reiniciar
 * o loop a cada render.
 */
export function usePoll(
  fn: () => Promise<boolean>,
  { intervalMs, enabled }: { intervalMs: number; enabled: boolean },
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      let done = false;
      try {
        done = await fnRef.current();
      } catch {
        done = false;
      }
      if (stopped || done) return;
      timer = setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled, intervalMs]);
}
