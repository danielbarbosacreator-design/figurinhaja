/**
 * Utilitários compartilhados pelos provedores reais (Gemini, FLUX):
 * transformar as fotos enviadas / do config em base64 para mandar como referência.
 * Roda só no servidor.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getFeaturedCandidates } from "@/lib/config";

export type ImageRef = { mimeType: string; data: string };

/** data:URL (foto enviada pelo cliente) → { mimeType, base64 }. */
export function dataUrlToRef(dataUrl: string): ImageRef | null {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const mimeType = m[1] || "image/jpeg";
  const isB64 = Boolean(m[2]);
  const data = isB64
    ? m[3]
    : Buffer.from(decodeURIComponent(m[3])).toString("base64");
  return { mimeType, data };
}

/** Foto de um candidato "featured" mora em /public — lê do disco no servidor. */
export async function candidatePhotoRef(candidateId: string): Promise<ImageRef | null> {
  const found = getFeaturedCandidates().find((c) => c.id === candidateId);
  if (!found?.photo) return null;
  try {
    const rel = decodeURIComponent(found.photo).replace(/^\/+/, "");
    const bytes = await readFile(join(process.cwd(), "public", rel));
    const lower = rel.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return { mimeType, data: bytes.toString("base64") };
  } catch {
    return null;
  }
}
