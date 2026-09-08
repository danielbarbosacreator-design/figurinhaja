/**
 * "Banco de dados" em memória para a Fase 1.
 *
 * Persiste entre requisições enquanto o processo Node do `next dev` estiver vivo.
 * Some ao reiniciar o servidor — aceitável para o fluxo com mocks.
 *
 * Fase 2: substituir por Prisma + Postgres/Supabase mantendo a mesma API
 * (getGeneration, saveGeneration, ...). As rotas em src/app/api não devem mudar.
 */
import type { Asset, Generation, Order, Payment } from "@/types";

/** Bitmap gerado (Gemini) guardado em memória enquanto não há Storage real (Fase 2). */
export type Blob = { mime: string; bytes: Buffer; createdAt: number };

type Store = {
  generations: Map<string, Generation>;
  assets: Map<string, Asset>;
  orders: Map<string, Order>;
  payments: Map<string, Payment>;
  blobs: Map<string, Blob>;
};

// Guardado no globalThis para sobreviver ao hot-reload do Next em dev.
const g = globalThis as unknown as { __figurinhasDb?: Store };

export const db: Store =
  g.__figurinhasDb ??
  (g.__figurinhasDb = {
    generations: new Map(),
    assets: new Map(),
    orders: new Map(),
    payments: new Map(),
    blobs: new Map(),
  });

export function assetsForGeneration(generationId: string): Asset[] {
  return [...db.assets.values()].filter((a) => a.generationId === generationId);
}

export function orderForGeneration(generationId: string): Order | undefined {
  return [...db.orders.values()].find((o) => o.generationId === generationId);
}

export function paymentForOrder(orderId: string): Payment | undefined {
  return [...db.payments.values()].find((p) => p.orderId === orderId);
}
