/**
 * Gerador real — FLUX.1 Kontext via Kie.ai (api.kie.ai).
 *
 * Liga com GENERATION_PROVIDER=flux + KIE_API_KEY (ou BFL_API_KEY) no .env.local,
 * junto de STORAGE_PROVIDER=memory até o Supabase (Fase 2). Roda SÓ no servidor.
 *
 * Kie.ai edita a partir de UMA imagem de referência por URL pública. Como as
 * fotos vêm do cliente (data URL) ou do /public local, subimos primeiro num
 * host temporário (tmpfiles.org, expira sozinho) e passamos a URL como inputImage.
 *  - candidate_pack:  referência = foto do candidato  → preserva o rosto dele
 *  - user_*:          referência = foto do usuário    → preserva o rosto do usuário
 *    (o candidato entra pelo texto; Kontext aceita só 1 imagem)
 */
import type {
  ImageGenerator,
  GenerationRequest,
  GenerationResult,
  GeneratedItem,
} from "./index";
import { storage } from "@/lib/storage";
import { dataUrlToRef, candidatePhotoRef, type ImageRef } from "./refs";

const BASE = process.env.KIE_BASE_URL || "https://api.kie.ai";
const MODEL = process.env.FLUX_MODEL || "flux-kontext-pro"; // ou flux-kontext-max
const GEN = `${BASE}/api/v1/flux/kontext/generate`;
const INFO = `${BASE}/api/v1/flux/kontext/record-info`;
const POLL_TIMEOUT_MS = 120_000;

function apiKey(): string {
  const k = process.env.KIE_API_KEY || process.env.BFL_API_KEY;
  if (!k || /^COLE/.test(k)) {
    throw new Error(
      "KIE_API_KEY ausente. Preencha no .env.local para usar GENERATION_PROVIDER=flux.",
    );
  }
  return k;
}

/** Sobe a referência num host temporário e devolve URL pública direta. */
async function uploadTemp(ref: ImageRef): Promise<string> {
  const ext = ref.mimeType.includes("png") ? "png" : ref.mimeType.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from(ref.data, "base64")], { type: ref.mimeType }),
    `ref.${ext}`,
  );
  const res = await fetch("https://tmpfiles.org/api/v1/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  const j = (await res.json()) as { data?: { url?: string } };
  const page = j.data?.url;
  if (!page) throw new Error("upload sem URL");
  return page.replace("tmpfiles.org/", "tmpfiles.org/dl/"); // link direto
}

/** ≤125 chars, PT (Kie traduz com enableTranslation). */
function promptFor(req: GenerationRequest, caption: string | null): string {
  const name = req.candidate.name;
  const t = caption ? ` texto "${caption}"` : "";
  if (req.flowType === "user_photo") {
    return `Foto realista: esta pessoa ao lado de ${name}, selfie sorrindo, luz natural, mesmo rosto.${t}`.slice(0, 125);
  }
  if (req.flowType === "user_candidate_pack") {
    return `Figurinha sticker: esta pessoa e ${name} lado a lado sorrindo, contorno branco, mesmo rosto.${t}`.slice(0, 125);
  }
  return `Figurinha sticker de ${name}, contorno branco grosso, fundo simples, mesmo rosto, sorrindo.${t}`.slice(0, 125);
}

async function submit(
  key: string,
  prompt: string,
  inputImage: string | null,
  aspectRatio: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    prompt,
    model: MODEL,
    aspectRatio,
    outputFormat: "png",
    enableTranslation: true,
    safetyTolerance: inputImage ? 2 : 2,
  };
  if (inputImage) body.inputImage = inputImage;

  const res = await fetch(GEN, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as {
    code?: number;
    msg?: string;
    data?: { taskId?: string };
  };
  if (!res.ok || j.code !== 200 || !j.data?.taskId) {
    throw new Error(`Kie generate: ${res.status} ${j.msg ?? JSON.stringify(j).slice(0, 200)}`);
  }
  return j.data.taskId;
}

async function poll(key: string, taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${INFO}?taskId=${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    const j = (await res.json().catch(() => ({}))) as {
      data?: { successFlag?: number; response?: { resultImageUrl?: string } };
    };
    const flag = j.data?.successFlag;
    if (flag === 1 && j.data?.response?.resultImageUrl) return j.data.response.resultImageUrl;
    if (flag === 2 || flag === 3) throw new Error("Kie: geração falhou.");
  }
  throw new Error("Kie: tempo esgotado.");
}

async function generateOne(
  key: string,
  req: GenerationRequest,
  caption: string | null,
  inputImage: string | null,
  variant: number,
): Promise<GeneratedItem> {
  const aspect = req.flowType === "user_photo" ? "3:4" : "1:1";
  const taskId = await submit(key, promptFor(req, caption), inputImage, aspect);
  const resultUrl = await poll(key, taskId);

  const img = await fetch(resultUrl);
  if (!img.ok) throw new Error(`Kie download ${img.status}`);
  const buf = await img.arrayBuffer();
  const mime = img.headers.get("content-type")?.split(";")[0] || "image/png";

  const storeKey = await storage.putOriginal(buf, mime);
  const previewPath = storeKey.startsWith("mem:")
    ? `/api/blob/${storeKey.slice(4)}?preview=1`
    : storeKey;
  return { previewPath, originalPath: storeKey, meta: { variant, caption } };
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

export const fluxGenerator: ImageGenerator = {
  name: "flux",
  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const key = apiKey();

    // referência: candidato (pack só dele) ou usuário (fluxos com foto)
    let ref: ImageRef | null = null;
    if (req.flowType === "candidate_pack") {
      ref = req.candidatePhoto
        ? dataUrlToRef(req.candidatePhoto)
        : req.candidate.isCustom
          ? null
          : await candidatePhotoRef(req.candidate.id);
    } else {
      ref = req.userPhoto ? dataUrlToRef(req.userPhoto) : null;
    }

    let inputImage: string | null = null;
    if (ref) {
      try {
        inputImage = await uploadTemp(ref);
      } catch {
        inputImage = null; // segue em modo texto→imagem
      }
    }

    const caps = captionPlan(req.quantity, req.customText);
    const items: GeneratedItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < req.quantity; i += 3) {
      const batch = Array.from(
        { length: Math.min(3, req.quantity - i) },
        (_, k) => i + k,
      );
      const settled = await Promise.allSettled(
        batch.map((idx) => generateOne(key, req, caps[idx], inputImage, (idx % 6) + 1)),
      );
      for (const r of settled) {
        if (r.status === "fulfilled") items.push(r.value);
        else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    }

    if (items.length === 0) throw new Error(errors[0] ?? "Falha na geração (FLUX Kontext / Kie).");
    return { items };
  },
};
