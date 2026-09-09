/**
 * Storage em memória — ponte da Fase 1 para geração real (Gemini) enquanto
 * o bucket privado do Supabase (Fase 2) não existe.
 *
 * Os bytes vivem em `db.blobs` (some ao reiniciar o `dev`). O download do
 * arquivo final continua passando por /api/download/[assetId], que só chama
 * `signedDownloadUrl` depois de confirmar o pedido PAID. A URL assinada aqui
 * é curta e validada por HMAC — mexer no parâmetro não abre nada.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db/memory";
import type { Storage } from "./index";

const SECRET =
  process.env.BLOB_SIGNING_SECRET ||
  process.env.MOCK_WEBHOOK_SECRET ||
  "dev-blob-secret";

const PREFIX = "mem:";

function sign(id: string, exp: number): string {
  return createHmac("sha256", SECRET).update(`${id}.${exp}`).digest("hex");
}

/** Usada pela rota /api/blob/[id] para validar a assinatura. */
export function verifyBlobSignature(id: string, exp: string, sig: string): boolean {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  const expected = sign(id, expNum);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

function put(bytes: ArrayBuffer, contentType: string): string {
  const id = crypto.randomUUID();
  db.blobs.set(id, {
    mime: contentType || "application/octet-stream",
    bytes: Buffer.from(bytes),
    createdAt: Date.now(),
  });
  return `${PREFIX}${id}`;
}

export const memoryStorage: Storage = {
  name: "memory",
  async putUpload(bytes, contentType) {
    return put(bytes, contentType);
  },
  async putOriginal(bytes, contentType) {
    return put(bytes, contentType);
  },
  async signedDownloadUrl(key, expiresInSeconds = 300) {
    // Se não for uma chave de blob em memória (`mem:<uuid>`), não há bytes p/
    // assinar. Acontece quando GENERATION_PROVIDER=mock: o "original" já é uma
    // URL servível (/api/mock-image?...). Devolve como está em vez de montar
    // um /api/blob/... inválido.
    if (!key.startsWith(PREFIX)) return key;
    const id = key.slice(PREFIX.length);
    const exp = Date.now() + expiresInSeconds * 1000;
    const sig = sign(id, exp);
    return `/api/blob/${id}?exp=${exp}&sig=${sig}`;
  },
};
