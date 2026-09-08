"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizard } from "./store";
import { getFlow } from "./config";

/** true depois que o componente montou no cliente (evita mismatch de hidratação). */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

type Requirement =
  | "flowType"
  | "candidate"
  | "userPhoto"
  | "product"
  | "generationId"
  | "orderId";

/**
 * Garante que o usuário tem o estado necessário para ver esta tela.
 * Se faltar algo (ex.: atualizou a página numa etapa avançada), manda de volta
 * para o começo do fluxo. Retorna `ready` quando pode renderizar.
 */
export function useFlowGuard(reqs: Requirement[]): { ready: boolean } {
  const mounted = useMounted();
  const router = useRouter();
  const s = useWizard();

  useEffect(() => {
    if (!mounted) return;
    const needsUserPhoto = s.flowType ? getFlow(s.flowType).needsUserPhoto : false;

    for (const r of reqs) {
      if (r === "flowType" && !s.flowType) return void router.replace("/criar/produto");
      if (r === "candidate" && !s.candidate) return void router.replace("/criar/candidato");
      if (r === "userPhoto" && needsUserPhoto && !s.userPhoto)
        return void router.replace("/criar/fotos");
      if (r === "product" && !s.productId) return void router.replace("/criar/quantidade");
      if (r === "generationId" && !s.generationId) return void router.replace("/criar/produto");
      if (r === "orderId" && !s.orderId) return void router.replace("/criar/preview");
    }
  }, [mounted, reqs, router, s]);

  return { ready: mounted };
}
