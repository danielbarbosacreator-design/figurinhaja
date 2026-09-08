"use client";

/**
 * Estado do fluxo de criação (wizard).
 *
 * Persistido em sessionStorage: se o usuário atualizar a página no meio do
 * processo, ele não recomeça do zero (bloco 20). O que é do servidor
 * (status de geração e de pagamento) NÃO fica aqui — é sempre re-consultado
 * pela API pelo generationId / orderId.
 *
 * As fotos são guardadas já reduzidas (<= ~700px, JPEG) pelo PhotoPicker,
 * então cabem no sessionStorage sem estourar a cota.
 */
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { CandidateRef, FlowType } from "@/types";

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface WizardState {
  sessionId: string | null;

  flowType: FlowType | null;
  candidate: CandidateRef | null;

  /** data URLs reduzidas (mock de upload) */
  userPhoto: string | null;
  candidatePhoto: string | null;

  wantsCustomText: boolean | null;
  customText: string | null;

  productId: string | null;

  /** ids retornados pelo servidor */
  generationId: string | null;
  orderId: string | null;

  setSessionId: (id: string) => void;
  setFlowType: (f: FlowType) => void;
  setCandidate: (c: CandidateRef | null) => void;
  setUserPhoto: (d: string | null) => void;
  setCandidatePhoto: (d: string | null) => void;
  setCustomText: (wants: boolean, text: string | null) => void;
  setProductId: (id: string | null) => void;
  setGenerationId: (id: string | null) => void;
  setOrderId: (id: string | null) => void;
  resetFlow: () => void;
}

const initial = {
  flowType: null,
  candidate: null,
  userPhoto: null,
  candidatePhoto: null,
  wantsCustomText: null,
  customText: null,
  productId: null,
  generationId: null,
  orderId: null,
};

export const useWizard = create<WizardState>()(
  persist(
    (set) => ({
      sessionId: null,
      ...initial,

      setSessionId: (id) => set({ sessionId: id }),
      setFlowType: (f) => set({ flowType: f }),
      setCandidate: (c) => set({ candidate: c }),
      setUserPhoto: (d) => set({ userPhoto: d }),
      setCandidatePhoto: (d) => set({ candidatePhoto: d }),
      setCustomText: (wants, text) =>
        set({ wantsCustomText: wants, customText: wants ? text : null }),
      setProductId: (id) => set({ productId: id }),
      setGenerationId: (id) => set({ generationId: id }),
      setOrderId: (id) => set({ orderId: id }),
      resetFlow: () => set({ ...initial }),
    }),
    {
      name: "figurinhas-wizard",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.sessionStorage : noopStorage,
      ),
    },
  ),
);
