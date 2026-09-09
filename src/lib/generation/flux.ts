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
// Qualidade máxima por padrão: flux-kontext-max adere melhor ao prompt e ao
// rosto da referência. FLUX_MODEL=flux-kontext-pro volta pro mais barato/rápido.
const MODEL = process.env.FLUX_MODEL || "flux-kontext-max";
const GEN = `${BASE}/api/v1/flux/kontext/generate`;
const INFO = `${BASE}/api/v1/flux/kontext/record-info`;
const POLL_TIMEOUT_MS = 120_000;

// Passo de upscale (Recraft Crisp Upscale via Kie "market"): 1024 -> 2048/4096,
// remove ruído e limpa os contornos. Liga por padrão; FLUX_UPSCALE=0 desliga.
// FLUX_UPSCALE_MODEL troca o upscaler; se o passo falhar, cai na imagem base.
const UPSCALE_ON = process.env.FLUX_UPSCALE !== "0";
const UPSCALE_MODEL = process.env.FLUX_UPSCALE_MODEL || "recraft/crisp-upscale";
const JOBS_CREATE = `${BASE}/api/v1/jobs/createTask`;
const JOBS_INFO = `${BASE}/api/v1/jobs/recordInfo`;
const UPSCALE_TIMEOUT_MS = 90_000;

function apiKey(): string {
  const k = process.env.KIE_API_KEY || process.env.BFL_API_KEY;
  if (!k || /^COLE/.test(k)) {
    throw new Error(
      "KIE_API_KEY ausente. Preencha no .env.local para usar GENERATION_PROVIDER=flux.",
    );
  }
  return k;
}

/**
 * Sobe a referência num host temporário e devolve URL pública que serve os
 * bytes crus da imagem (a Kie baixa essa URL como `inputImage`).
 *
 * Usa catbox.moe: o tmpfiles.org passou a responder com uma página HTML no
 * lugar do arquivo, e a Kie ficava presa em "processing" até o timeout.
 * catbox NÃO expira sozinho — aceitável só enquanto isto é andaime da Fase 3;
 * na Fase 2 a referência vira URL assinada do Supabase Storage (privada).
 */
async function uploadTemp(ref: ImageRef): Promise<string> {
  const ext = ref.mimeType.includes("png") ? "png" : ref.mimeType.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append(
    "fileToUpload",
    new Blob([Buffer.from(ref.data, "base64")], { type: ref.mimeType }),
    `ref.${ext}`,
  );
  const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: form });
  const url = (await res.text()).trim();
  if (!res.ok || !/^https?:\/\/\S+$/.test(url)) {
    throw new Error(`upload ${res.status} ${url.slice(0, 120)}`);
  }
  return url;
}

// Termos de qualidade colados em todo prompt (PT; Kie traduz com enableTranslation).
const QUALITY =
  "altíssima qualidade, altíssima resolução, ultra detalhado, foco nítido, " +
  "traços limpos, iluminação de estúdio, cores vivas e saturadas, sem borrões, " +
  "sem artefatos, sem texto extra, sem marca d'água";

/** Prompt PT rico. FLUX aceita prompts longos — sem corte agressivo de 125. */
function promptFor(req: GenerationRequest, caption: string | null): string {
  const name = req.candidate.name;
  const t = caption
    ? ` Balão/faixa com o texto "${caption}" em letras grandes, legível, bem posicionado.`
    : "";
  let base: string;
  if (req.flowType === "user_photo") {
    base =
      `Foto ultrarrealista em alta resolução: esta pessoa ao lado de ${name}, ` +
      `selfie sorrindo, luz natural suave, pele com textura real, olhos nítidos, ` +
      `preservar fielmente o rosto das duas pessoas, enquadramento de retrato.${t}`;
  } else if (req.flowType === "user_candidate_pack") {
    base =
      `Figurinha sticker premium: esta pessoa e ${name} lado a lado sorrindo, ` +
      `estilo ilustração vetorial limpa, contorno branco grosso de adesivo, ` +
      `fundo simples e chapado, preservar fielmente os dois rostos.${t}`;
  } else {
    base =
      `Figurinha sticker premium de ${name}, retrato do peito para cima, ` +
      `sorrindo, estilo ilustração vetorial limpa e moderna, contorno branco ` +
      `grosso de adesivo, fundo simples e chapado, preservar fielmente o rosto.${t}`;
  }
  return `${base} ${QUALITY}`.slice(0, 800);
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
    // Enriquece o prompt no lado do FLUX antes de gerar — mais detalhe e nitidez.
    promptUpsampling: true,
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

/**
 * Passo de upscale via Kie "market" (createTask + recordInfo). Best-effort:
 * qualquer erro/timeout devolve `null` e o chamador fica com a imagem base.
 */
async function upscale(key: string, imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(JOBS_CREATE, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: UPSCALE_MODEL, input: { image: imageUrl } }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      code?: number;
      data?: { taskId?: string };
    };
    const taskId = j.data?.taskId;
    if (!res.ok || j.code !== 200 || !taskId) return null;

    const deadline = Date.now() + UPSCALE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const p = await fetch(`${JOBS_INFO}?taskId=${encodeURIComponent(taskId)}`, {
        headers: { authorization: `Bearer ${key}` },
      });
      const pj = (await p.json().catch(() => ({}))) as {
        data?: { state?: string; resultJson?: string };
      };
      const state = pj.data?.state;
      if (state === "success") {
        const parsed = JSON.parse(pj.data?.resultJson || "{}") as {
          resultUrls?: string[];
        };
        return parsed.resultUrls?.[0] ?? null;
      }
      if (state === "fail") return null;
    }
    return null;
  } catch {
    return null;
  }
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
  const baseUrl = await poll(key, taskId);

  // Sobe a resolução e limpa os contornos; se falhar, segue com a base.
  const resultUrl = (UPSCALE_ON && (await upscale(key, baseUrl))) || baseUrl;

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
