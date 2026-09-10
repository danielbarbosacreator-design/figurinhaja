/**
 * Gerador real — Kie.ai (api.kie.ai), plataforma multi-modelo.
 *
 * Liga com GENERATION_PROVIDER=kie (ou o alias legado `flux`) + KIE_API_KEY no
 * .env.local, junto de STORAGE_PROVIDER=memory até o Supabase (Fase 2). Roda SÓ
 * no servidor — a chave nunca vai ao cliente.
 *
 * A mesma KIE_API_KEY dá acesso a vários modelos. Escolha por KIE_MODEL:
 *  - google/nano-banana-edit  (PADRÃO) — Gemini 2.5 Flash Image ("nano-banana").
 *      Aceita VÁRIAS imagens de referência → dá para mandar o rosto do usuário
 *      E o do candidato no mesmo pedido. Rápido (~10-20s) e ótima fidelidade.
 *  - google/nano-banana       — mesma família, sem referência (texto→imagem).
 *      Usado automaticamente quando não há nenhuma foto de referência.
 *  - flux-kontext-max / flux-kontext-pro — FLUX.1 Kontext. Aceita só 1 imagem.
 *
 * As fotos chegam como data URL (cliente) ou de /public (candidato "featured").
 * Subimos cada uma para o próprio storage da Kie (file-base64-upload) e passamos
 * as URLs resultantes ao modelo — sem depender de host de terceiros (catbox/
 * tmpfiles, que quebravam e deixavam a geração "cega", sem ler a imagem).
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

// Modelo principal. KIE_MODEL troca sem mexer no código. Mantém FLUX_MODEL como
// alias legado para não quebrar .env.local antigos.
const MODEL =
  process.env.KIE_MODEL || process.env.FLUX_MODEL || "google/nano-banana-edit";
// Quando não há referência nenhuma, nano-banana-edit não serve (exige imagem):
// cai no modelo texto→imagem da mesma família.
const TEXT_MODEL = process.env.KIE_TEXT_MODEL || "google/nano-banana";

const isFlux = /^flux-kontext/.test(MODEL);

// Endpoints FLUX Kontext (usados só quando KIE_MODEL=flux-kontext-*).
const FLUX_GEN = `${BASE}/api/v1/flux/kontext/generate`;
const FLUX_INFO = `${BASE}/api/v1/flux/kontext/record-info`;

// Endpoints "jobs" — genéricos, servem nano-banana, upscale e a maioria dos
// modelos do marketplace da Kie.
const JOBS_CREATE = `${BASE}/api/v1/jobs/createTask`;
const JOBS_INFO = `${BASE}/api/v1/jobs/recordInfo`;

// Upload de referência para o storage da própria Kie (devolve URL pública).
const UPLOAD_URL =
  process.env.KIE_UPLOAD_URL ||
  "https://kieai.redpandaai.co/api/file-base64-upload";

const POLL_TIMEOUT_MS = 180_000;
const UPSCALE_TIMEOUT_MS = 90_000;

// Passo de upscale (Recraft Crisp Upscale via Kie "jobs"): 1024 -> 2048/4096,
// remove ruído e limpa contornos. Liga por padrão; FLUX_UPSCALE=0 desliga.
const UPSCALE_ON = process.env.FLUX_UPSCALE !== "0";
const UPSCALE_MODEL = process.env.FLUX_UPSCALE_MODEL || "recraft/crisp-upscale";

function apiKey(): string {
  const k = process.env.KIE_API_KEY || process.env.BFL_API_KEY;
  if (!k || /^COLE/.test(k)) {
    throw new Error(
      "KIE_API_KEY ausente. Preencha no .env.local para usar GENERATION_PROVIDER=kie.",
    );
  }
  return k;
}

/**
 * Sobe uma referência (base64) para o storage da Kie e devolve a URL pública
 * que o modelo vai baixar. Sem hosts de terceiros no caminho.
 */
async function uploadRef(key: string, ref: ImageRef): Promise<string> {
  const ext = ref.mimeType.includes("png")
    ? "png"
    : ref.mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      base64Data: `data:${ref.mimeType};base64,${ref.data}`,
      uploadPath: "images/figurinhaja",
      fileName: `ref-${crypto.randomUUID()}.${ext}`,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    code?: number;
    data?: { downloadUrl?: string };
  };
  const url = j.data?.downloadUrl;
  if (!res.ok || !url || !/^https?:\/\//.test(url)) {
    throw new Error(
      `Kie upload: ${res.status} ${JSON.stringify(j).slice(0, 200)}`,
    );
  }
  return url;
}

// Termos de qualidade colados em todo prompt (PT; a Kie traduz internamente).
const QUALITY =
  "altíssima qualidade, altíssima resolução, ultra detalhado, foco nítido, " +
  "traços limpos, iluminação de estúdio, cores vivas e saturadas, sem borrões, " +
  "sem artefatos, sem texto extra indevido, sem marca d'água";

/**
 * Monta o prompt. `refSlots` descreve, em ordem, o que cada imagem de
 * referência contém — o modelo multi-imagem usa essa ordem.
 */
function promptFor(
  req: GenerationRequest,
  caption: string | null,
  refSlots: string[],
): string {
  const name = req.candidate.name;
  const t = caption
    ? ` Inclua um balão/faixa com o texto "${caption}" em letras grandes, ` +
      `legível e bem posicionado.`
    : "";
  const refNote = refSlots.length
    ? ` Referências, nesta ordem: ${refSlots
        .map((s, i) => `${i + 1}) ${s}`)
        .join("; ")}. Preserve fielmente cada rosto indicado.${
        refSlots.length >= 2
          ? " São pessoas DIFERENTES: não misture nem repita os rostos; " +
            "cada figura mantém o rosto da sua própria referência."
          : ""
      }`
    : "";

  let base: string;
  if (req.flowType === "user_photo") {
    base =
      `Foto ultrarrealista em alta resolução: a pessoa da referência ao lado ` +
      `de ${name}, selfie sorrindo, luz natural suave, pele com textura real, ` +
      `olhos nítidos, enquadramento de retrato vertical.${t}`;
  } else if (req.flowType === "user_candidate_pack") {
    base =
      `Figurinha sticker premium: a pessoa da referência e ${name} lado a lado ` +
      `sorrindo, estilo ilustração vetorial limpa, contorno branco grosso de ` +
      `adesivo, fundo simples e chapado.${t}`;
  } else {
    base =
      `Figurinha sticker premium de ${name}, do peito para cima, sorrindo, ` +
      `estilo ilustração vetorial limpa e moderna, contorno branco grosso de ` +
      `adesivo, fundo simples e chapado.${t}`;
  }
  return `${base}${refNote} ${QUALITY}`.slice(0, 1200);
}

/* ── Submissão / polling: FLUX Kontext ─────────────────────────────────── */

async function fluxSubmit(
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
    promptUpsampling: true,
    safetyTolerance: 2,
  };
  if (inputImage) body.inputImage = inputImage;

  const res = await fetch(FLUX_GEN, {
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
    throw new Error(
      `Kie flux generate: ${res.status} ${j.msg ?? JSON.stringify(j).slice(0, 200)}`,
    );
  }
  return j.data.taskId;
}

async function fluxPoll(key: string, taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(
      `${FLUX_INFO}?taskId=${encodeURIComponent(taskId)}`,
      { headers: { authorization: `Bearer ${key}` } },
    );
    const j = (await res.json().catch(() => ({}))) as {
      data?: { successFlag?: number; response?: { resultImageUrl?: string } };
    };
    const flag = j.data?.successFlag;
    if (flag === 1 && j.data?.response?.resultImageUrl)
      return j.data.response.resultImageUrl;
    if (flag === 2 || flag === 3) throw new Error("Kie flux: geração falhou.");
  }
  throw new Error("Kie flux: tempo esgotado.");
}

/* ── Submissão / polling: jobs (nano-banana e afins) ───────────────────── */

async function jobsSubmit(
  key: string,
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(JOBS_CREATE, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    code?: number;
    msg?: string;
    data?: { taskId?: string };
  };
  if (!res.ok || j.code !== 200 || !j.data?.taskId) {
    throw new Error(
      `Kie jobs create (${model}): ${res.status} ${j.msg ?? JSON.stringify(j).slice(0, 200)}`,
    );
  }
  return j.data.taskId;
}

async function jobsPoll(
  key: string,
  taskId: string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(
      `${JOBS_INFO}?taskId=${encodeURIComponent(taskId)}`,
      { headers: { authorization: `Bearer ${key}` } },
    );
    const j = (await res.json().catch(() => ({}))) as {
      data?: { state?: string; resultJson?: string; failMsg?: string };
    };
    const state = j.data?.state;
    if (state === "success") {
      const parsed = JSON.parse(j.data?.resultJson || "{}") as {
        resultUrls?: string[];
      };
      const url = parsed.resultUrls?.[0];
      if (url) return url;
      throw new Error("Kie jobs: sucesso sem resultUrls.");
    }
    if (state === "fail")
      throw new Error(`Kie jobs: ${j.data?.failMsg || "geração falhou."}`);
  }
  throw new Error("Kie jobs: tempo esgotado.");
}

/** Upscale best-effort: qualquer erro/timeout devolve `null` e fica a base. */
async function upscale(key: string, imageUrl: string): Promise<string | null> {
  try {
    const taskId = await jobsSubmit(key, UPSCALE_MODEL, { image: imageUrl });
    return await jobsPoll(key, taskId, UPSCALE_TIMEOUT_MS);
  } catch {
    return null;
  }
}

async function generateOne(
  key: string,
  req: GenerationRequest,
  caption: string | null,
  refUrls: string[],
  refSlots: string[],
  variant: number,
): Promise<GeneratedItem> {
  const portrait = req.flowType === "user_photo";
  const aspect = portrait ? "3:4" : "1:1";
  const prompt = promptFor(req, caption, refSlots);

  let baseUrl: string;
  if (isFlux) {
    const taskId = await fluxSubmit(key, prompt, refUrls[0] ?? null, aspect);
    baseUrl = await fluxPoll(key, taskId);
  } else if (refUrls.length) {
    const taskId = await jobsSubmit(key, MODEL, {
      prompt,
      image_urls: refUrls,
      output_format: "png",
      image_size: aspect,
    });
    baseUrl = await jobsPoll(key, taskId, POLL_TIMEOUT_MS);
  } else {
    const taskId = await jobsSubmit(key, TEXT_MODEL, {
      prompt,
      output_format: "png",
      image_size: aspect,
    });
    baseUrl = await jobsPoll(key, taskId, POLL_TIMEOUT_MS);
  }

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

function captionPlan(
  flowType: GenerationRequest["flowType"],
  quantity: number,
  customText: string | null,
): (string | null)[] {
  // Foto realista: nunca inventa legenda — só usa a frase se o usuário pediu.
  if (flowType === "user_photo") {
    const c = customText ? customText.toUpperCase() : null;
    return Array.from({ length: quantity }, () => c);
  }
  const base = ["TAMO JUNTO", "É NÓIS", "PRA CIMA", "CONFIA", "FORÇA", "VAMO"];
  const out: (string | null)[] = [];
  for (let i = 0; i < quantity; i++) {
    if (customText && i % 3 === 0) out.push(customText.toUpperCase());
    else if (i % 4 === 3) out.push(null);
    else out.push(base[i % base.length]);
  }
  return out;
}

/**
 * Resolve as referências disponíveis para o fluxo e sobe cada uma para a Kie.
 * Devolve as URLs e a descrição de cada slot (ordem importa no multi-imagem).
 */
async function resolveRefs(
  key: string,
  req: GenerationRequest,
): Promise<{ urls: string[]; slots: string[]; warnings: string[] }> {
  const wanted: { ref: ImageRef | null; slot: string }[] = [];

  if (req.flowType === "candidate_pack") {
    const ref = req.candidatePhoto
      ? dataUrlToRef(req.candidatePhoto)
      : req.candidate.isCustom
        ? null
        : await candidatePhotoRef(req.candidate.id);
    wanted.push({ ref, slot: `rosto de ${req.candidate.name}` });
  } else {
    const userRef = req.userPhoto ? dataUrlToRef(req.userPhoto) : null;
    wanted.push({ ref: userRef, slot: "rosto do usuário" });

    // Segunda referência: rosto do candidato (multi-imagem). FLUX Kontext
    // ignora a partir da 2ª, então só vale para nano-banana e afins.
    if (!isFlux) {
      const candRef = req.candidatePhoto
        ? dataUrlToRef(req.candidatePhoto)
        : req.candidate.isCustom
          ? null
          : await candidatePhotoRef(req.candidate.id);
      if (candRef)
        wanted.push({ ref: candRef, slot: `rosto de ${req.candidate.name}` });
    }
  }

  const urls: string[] = [];
  const slots: string[] = [];
  const warnings: string[] = [];
  for (const w of wanted) {
    if (!w.ref) continue;
    try {
      urls.push(await uploadRef(key, w.ref));
      slots.push(w.slot);
    } catch (err) {
      warnings.push(
        `falha ao subir referência (${w.slot}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  return { urls, slots, warnings };
}

export const fluxGenerator: ImageGenerator = {
  name: "kie",
  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const key = apiKey();

    const { urls: refUrls, slots: refSlots, warnings } = await resolveRefs(
      key,
      req,
    );
    for (const w of warnings) console.warn(`[kie] ${w}`);

    // Fluxos que dependem da foto do usuário não podem gerar "às cegas":
    // sem a referência o rosto seria inventado. Falha explícita > silêncio.
    const needsUserRef =
      req.flowType === "user_photo" || req.flowType === "user_candidate_pack";
    if (needsUserRef && refUrls.length === 0) {
      throw new Error(
        `Não consegui enviar sua foto para a geração${
          warnings[0] ? ` (${warnings[0]})` : ""
        }. Tente de novo em instantes.`,
      );
    }

    const caps = captionPlan(req.flowType, req.quantity, req.customText);
    const items: GeneratedItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < req.quantity; i += 3) {
      const batch = Array.from(
        { length: Math.min(3, req.quantity - i) },
        (_, k) => i + k,
      );
      const settled = await Promise.allSettled(
        batch.map((idx) =>
          generateOne(key, req, caps[idx], refUrls, refSlots, (idx % 6) + 1),
        ),
      );
      for (const r of settled) {
        if (r.status === "fulfilled") items.push(r.value);
        else
          errors.push(
            r.reason instanceof Error ? r.reason.message : String(r.reason),
          );
      }
    }

    if (items.length === 0)
      throw new Error(errors[0] ?? "Falha na geração (Kie).");
    return { items };
  },
};

/** Alias explícito — `import { kieGenerator }`. */
export const kieGenerator = fluxGenerator;
