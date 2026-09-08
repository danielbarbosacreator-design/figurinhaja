/**
 * Interface desacoplada de armazenamento de imagens (blocos 15 e 21).
 *
 * Fase 1: implementação `mock` (sem storage real; usa os caminhos que o
 *         gerador mock já devolve).
 * Fase 2: implementação `supabase` (bucket PRIVADO + URLs assinadas/temporárias
 *         para download; originais nunca acessíveis por URL pública previsível).
 */
import { mockStorage } from "./mock";
import { memoryStorage } from "./memory";

export interface Storage {
  name: string;
  /** Guarda um arquivo enviado pelo usuário (foto). Retorna uma chave interna. */
  putUpload: (bytes: ArrayBuffer, contentType: string) => Promise<string>;
  /** Guarda um arquivo final gerado. Retorna a chave interna. */
  putOriginal: (bytes: ArrayBuffer, contentType: string) => Promise<string>;
  /** URL temporária e assinada para download do arquivo final (após pagamento). */
  signedDownloadUrl: (key: string, expiresInSeconds?: number) => Promise<string>;
}

function selectStorage(): Storage {
  const provider = process.env.STORAGE_PROVIDER ?? "mock";
  switch (provider) {
    case "supabase":
      throw new Error(
        "STORAGE_PROVIDER=supabase ainda não implementado (Fase 2).",
      );
    case "memory":
      // Ponte p/ geração real antes do Supabase: bytes em memória + URL assinada.
      return memoryStorage;
    case "mock":
    default:
      return mockStorage;
  }
}

export const storage: Storage = selectStorage();
