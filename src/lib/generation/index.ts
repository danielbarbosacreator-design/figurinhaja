/**
 * Interface desacoplada de geração de imagem.
 *
 * Fase 1: implementação `mock` (retorna figurinhas de exemplo).
 * Fase 3: implementação `gemini` (Google Gemini 2.5 Flash Image / "nano-banana").
 *
 * A UI e as rotas de API só falam com esta interface. Trocar de provedor
 * não deve exigir mudança fora de src/lib/generation.
 */
import type { CandidateRef, FlowType } from "@/types";
import { mockGenerator } from "./mock";
import { geminiGenerator } from "./gemini";
import { kieGenerator } from "./flux";
import { pollinationsGenerator } from "./pollinations";

export interface GenerationRequest {
  generationId: string;
  flowType: FlowType;
  candidate: CandidateRef;
  quantity: number;
  customText: string | null;
  /** URLs/caminhos das fotos enviadas (no mock são data URLs). */
  userPhoto?: string | null;
  candidatePhoto?: string | null;
}

export interface GeneratedItem {
  /** Prévia protegida: baixa resolução + marca d'água. */
  previewPath: string;
  /** Arquivo final em alta qualidade (armazenamento privado). */
  originalPath: string;
  meta?: { variant: number; caption: string | null };
}

export interface GenerationResult {
  items: GeneratedItem[];
}

export interface ImageGenerator {
  name: string;
  generate: (req: GenerationRequest) => Promise<GenerationResult>;
}

function selectGenerator(): ImageGenerator {
  const provider = process.env.GENERATION_PROVIDER ?? "mock";
  switch (provider) {
    case "gemini":
      return geminiGenerator;
    case "kie":
    case "flux": // alias legado — hoje aponta para o gerador Kie multi-modelo
      return kieGenerator;
    case "pollinations":
      // Grátis, sem chave — só para testar o pipeline (não preserva rosto).
      return pollinationsGenerator;
    case "mock":
    default:
      return mockGenerator;
  }
}

export const imageGenerator: ImageGenerator = selectGenerator();
