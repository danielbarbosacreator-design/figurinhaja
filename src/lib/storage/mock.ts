/**
 * Storage mock — não persiste nada de verdade.
 * Uploads são tratados no cliente (data URL) na Fase 1; aqui só devolvemos
 * chaves fictícias para manter as assinaturas de função estáveis.
 */
import type { Storage } from "./index";

export const mockStorage: Storage = {
  name: "mock",
  async putUpload() {
    return `mock/uploads/${crypto.randomUUID()}`;
  },
  async putOriginal() {
    return `mock/originals/${crypto.randomUUID()}`;
  },
  async signedDownloadUrl(key: string) {
    // No mock, a "chave" já é um caminho servível (/api/mock-image?...).
    return key;
  },
};
