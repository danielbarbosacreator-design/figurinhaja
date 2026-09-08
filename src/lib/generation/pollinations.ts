/**
 * Gerador GRATUITO de teste — Pollinations.ai (sem chave, sem cadastro).
 *
 * Serve para ver o pipeline rodando com imagens reais sem custo. NÃO é para
 * produção: qualidade irregular, pode ficar lento ou falhar, e é texto→imagem
 * (NÃO usa as fotos enviadas, então não preserva o rosto do usuário).
 *
 * Liga com GENERATION_PROVIDER=pollinations + STORAGE_PROVIDER=memory.
 */
import type {
  ImageGenerator,
  GenerationRequest,
  GenerationResult,
  GeneratedItem,
} from "./index";
import { storage } from "@/lib/storage";

const ENDPOINT = "https://image.pollinations.ai/prompt/";

function buildPrompt(req: GenerationRequest, caption: string | null): string {
  const name = req.candidate.name;
  const legenda = caption ? ` com o texto "${caption}" em letras grandes` : "";

  if (req.flowType === "user_photo") {
    return `foto realista de duas pessoas sorrindo juntas, uma delas parecida com ${name}, selfie amigável, luz natural${legenda}`;
  }
  if (req.flowType === "user_candidate_pack") {
    return `figurinha estilo adesivo de duas pessoas sorrindo lado a lado, uma parecida com ${name}, contorno branco grosso, fundo simples${legenda}`;
  }
  return `figurinha estilo adesivo, retrato divertido e carismático de ${name}, contorno branco grosso, fundo simples${legenda}`;
}

function captionPlan(quantity: number, customText: string | null): (string | null)[] {
  const base = ["TAMO JUNTO", "É NÓIS", "PRA CIMA", "CONFIA", "FORÇA", "VAMO"];
  const out: (string | null)[] = [];
  for (let i = 0; i < quantity; i++) {
    if (customText && i % 3 === 0) out.push(customText.toUpperCase());
    else if (i % 4 === 3) out.push(null);
    else out.push(base[i % base.length]);
  }
  return out;
}

async function generateOne(
  prompt: string,
  seed: number,
  caption: string | null,
  variant: number,
): Promise<GeneratedItem> {
  const url =
    ENDPOINT +
    encodeURIComponent(prompt) +
    `?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1024) throw new Error("Pollinations devolveu imagem vazia.");
  const mime = res.headers.get("content-type") || "image/jpeg";

  const key = await storage.putOriginal(buf, mime.split(";")[0]);
  const previewPath = key.startsWith("mem:")
    ? `/api/blob/${key.slice(4)}?preview=1`
    : key;

  return { previewPath, originalPath: key, meta: { variant, caption } };
}

export const pollinationsGenerator: ImageGenerator = {
  name: "pollinations",
  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const caps = captionPlan(req.quantity, req.customText);
    const items: GeneratedItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < req.quantity; i++) {
      try {
        items.push(
          await generateOne(buildPrompt(req, caps[i]), 1000 + i, caps[i], (i % 6) + 1),
        );
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (items.length === 0) {
      throw new Error(errors[0] ?? "Falha na geração (Pollinations).");
    }
    return { items };
  },
};
