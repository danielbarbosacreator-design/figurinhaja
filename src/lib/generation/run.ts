/**
 * Orquestra uma geração: cria o registro, chama o provedor (mock ou real),
 * persiste os assets. Usado pela rota POST /api/generate.
 *
 * Fase 1: a parte pesada roda como promise solta e o cliente acompanha por
 * polling em GET /api/generation/[id] (deixa a tela "Estamos criando..." honesta
 * e cobre o caso de atualizar a página no meio — bloco 20).
 * Fase 2/3: mover para uma fila/worker; a assinatura pública não muda.
 */
import type { Generation, Asset, CandidateRef, FlowType } from "@/types";
import { db } from "@/lib/db/memory";
import { imageGenerator, type GeneratedItem } from "./index";

export interface StartGenerationInput {
  sessionId: string;
  flowType: FlowType;
  productId: string | null;
  candidate: CandidateRef;
  customText: string | null;
  quantity: number;
  userPhoto?: string | null;
  candidatePhoto?: string | null;
}

export function startGeneration(input: StartGenerationInput): Generation {
  const id = crypto.randomUUID();
  const generation: Generation = {
    id,
    sessionId: input.sessionId,
    productType: input.flowType,
    productId: input.productId,
    candidate: input.candidate,
    customText: input.customText,
    quantity: input.quantity,
    status: "processing",
    createdAt: new Date().toISOString(),
  };
  db.generations.set(id, generation);

  void runToCompletion(generation, input).catch((err) => {
    const g = db.generations.get(id);
    if (g) {
      g.status = "failed";
      g.error = err instanceof Error ? err.message : "erro desconhecido";
    }
    // Limpa assets parciais de uma geração que acabou falhando.
    for (const [aid, a] of db.assets) {
      if (a.generationId === id) db.assets.delete(aid);
    }
  });

  return generation;
}

async function runToCompletion(
  generation: Generation,
  input: StartGenerationInput,
): Promise<void> {
  const persist = (item: GeneratedItem): void => {
    const asset: Asset = {
      id: crypto.randomUUID(),
      generationId: generation.id,
      type: input.flowType === "user_photo" ? "photo" : "sticker",
      previewPath: item.previewPath,
      originalPath: item.originalPath,
      isUnlocked: false,
      meta: item.meta,
    };
    db.assets.set(asset.id, asset);
  };

  // Persiste cada figurinha assim que fica pronta (a tela de progresso lê
  // `assets.length` e anda de verdade). O `generate` ainda devolve tudo no
  // fim — se um provedor não chamar o callback, o fallback abaixo cobre.
  const streamed = new Set<GeneratedItem>();
  const result = await imageGenerator.generate(
    {
      generationId: generation.id,
      flowType: input.flowType,
      candidate: input.candidate,
      quantity: input.quantity,
      customText: input.customText,
      userPhoto: input.userPhoto,
      candidatePhoto: input.candidatePhoto,
    },
    (item) => {
      streamed.add(item);
      persist(item);
    },
  );

  for (const item of result.items) {
    if (!streamed.has(item)) persist(item);
  }

  const g = db.generations.get(generation.id);
  if (g) {
    g.status = "completed";
    g.completedAt = new Date().toISOString();
  }
}
