/**
 * Gerador real — Kie.ai (api.kie.ai).
 *
 * Liga com GENERATION_PROVIDER=kie + KIE_API_KEY no .env.local, junto de
 * STORAGE_PROVIDER=memory até o Supabase (Fase 2). Roda SÓ no servidor — a
 * chave nunca vai ao cliente.
 *
 * O usuário final NUNCA escreve prompt nem escolhe modelo. Tudo é decidido
 * aqui a partir do tipo de fluxo, do candidato, das fotos e da quantidade.
 *
 * ── Roteamento de modelo (auditoria set/2026) ────────────────────────────
 * Os 3 fluxos usam `flux-2/pro-image-to-image` (endpoint /api/v1/jobs):
 *   - aceita 1–8 referências humanas (`input_urls`)  → fluxos com 2 pessoas OK
 *   - saída FOTORREALISTA com boa preservação de identidade (testado)
 *   - política permissiva com figura pública (não recusa como nano-banana/gpt)
 * Comparado contra seedream-v4-edit (perde a 2ª identidade) e nano-banana-pro
 * (ignora as referências). Cada fluxo tem override por env se precisar trocar.
 *
 * Figurinha (fluxos 1 e 2): primeiro gera a PESSOA fotográfica, depois
 * `recraft/remove-background` recorta e deixa o fundo transparente. NÃO se
 * pede "ilustração/cartoon" ao modelo — só o recorte é tratamento de sticker.
 * Foto (fluxo 3): sem recorte, imagem fotográfica pura.
 */
import type {
  ImageGenerator,
  GenerationRequest,
  GenerationResult,
  GeneratedItem,
} from "./index";
import sharp from "sharp";
import { storage } from "@/lib/storage";
import { dataUrlToRef, candidatePhotoRef, type ImageRef } from "./refs";

type FlowType = GenerationRequest["flowType"];

const BASE = process.env.KIE_BASE_URL || "https://api.kie.ai";
const JOBS_CREATE = `${BASE}/api/v1/jobs/createTask`;
const JOBS_INFO = `${BASE}/api/v1/jobs/recordInfo`;
// Endpoints FLUX Kontext — só se algum override apontar para flux-kontext-*.
const FLUX_GEN = `${BASE}/api/v1/flux/kontext/generate`;
const FLUX_INFO = `${BASE}/api/v1/flux/kontext/record-info`;

const UPLOAD_URL =
  process.env.KIE_UPLOAD_URL ||
  "https://kieai.redpandaai.co/api/file-base64-upload";

const GEN_TIMEOUT_MS = 240_000;
const BG_REMOVE_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 2500;

// Quantas imagens do pack gerar em paralelo (a Kie processa vários jobs ao
// mesmo tempo). Packs pequenos (≤ este número) disparam todas de uma vez.
const CONCURRENCY = Math.max(
  1,
  Math.min(12, Number(process.env.KIE_CONCURRENCY) || 8),
);

// Recorte de fundo → figurinha 100% transparente. KIE_BG_REMOVE=0 desliga.
const BG_REMOVE_ON = process.env.KIE_BG_REMOVE !== "0";
const BG_REMOVE_MODEL =
  process.env.KIE_BG_REMOVE_MODEL || "recraft/remove-background";

// Ajuste global de estilo, só para o admin (não há campo no app). Vazio = nada.
const STYLE_EXTRA = (process.env.KIE_STYLE_EXTRA || "").trim();

function apiKey(): string {
  const k = process.env.KIE_API_KEY || process.env.BFL_API_KEY;
  if (!k || /^COLE/.test(k)) {
    throw new Error(
      "KIE_API_KEY ausente. Preencha no .env.local para usar GENERATION_PROVIDER=kie.",
    );
  }
  return k;
}

/* ── Roteador de modelo ─────────────────────────────────────────────────── */

interface FlowModel {
  model: string;
  /** aspect_ratio enviado ao modelo */
  aspect: string;
  resolution: "1K" | "2K";
  /** recorta o fundo depois (figurinha) */
  bgRemove: boolean;
  /** nº de referências obrigatório para este fluxo */
  minRefs: number;
  maxRefs: number;
}

const DEFAULT_MODEL = "flux-2/pro-image-to-image";

function envModel(name: string): string {
  const v = (process.env[name] || "").trim();
  return v || process.env.KIE_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL;
}

function modelForFlow(flow: FlowType): FlowModel {
  switch (flow) {
    case "user_photo":
      return {
        model: envModel("KIE_MODEL_ME_CANDIDATE_PHOTO"),
        aspect: "3:4",
        resolution: "1K",
        bgRemove: false,
        minRefs: 2,
        maxRefs: 2,
      };
    case "user_candidate_pack":
      return {
        model: envModel("KIE_MODEL_ME_CANDIDATE_STICKERS"),
        aspect: "1:1",
        resolution: "1K",
        bgRemove: BG_REMOVE_ON,
        minRefs: 2,
        maxRefs: 2,
      };
    case "candidate_pack":
    default:
      return {
        model: envModel("KIE_MODEL_CANDIDATE_STICKERS"),
        aspect: "1:1",
        resolution: "1K",
        bgRemove: BG_REMOVE_ON,
        minRefs: 1,
        maxRefs: 1,
      };
  }
}

const isFluxKontext = (m: string) => /^flux-kontext/.test(m);

/** Nome do campo de referências conforme a família do modelo. */
function refField(model: string): "input_urls" | "image_urls" {
  if (process.env.KIE_REF_FIELD === "image_urls") return "image_urls";
  if (process.env.KIE_REF_FIELD === "input_urls") return "input_urls";
  return /^flux-2\//.test(model) ? "input_urls" : "image_urls";
}

/* ── Upload das referências ─────────────────────────────────────────────── */

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
    data?: { downloadUrl?: string };
  };
  const url = j.data?.downloadUrl;
  if (!res.ok || !url || !/^https?:\/\//.test(url)) {
    throw new Error(
      `upload da referência falhou (${res.status} ${JSON.stringify(j).slice(0, 160)})`,
    );
  }
  return url;
}

/**
 * Resolve as referências do fluxo, na ORDEM certa (pessoa 1 = usuário,
 * pessoa 2 = candidato) e sobe cada uma para a Kie.
 */
async function resolveRefs(
  key: string,
  req: GenerationRequest,
): Promise<{ urls: string[]; count: number }> {
  const wanted: (ImageRef | null)[] = [];

  if (req.flowType === "candidate_pack") {
    wanted.push(
      req.candidatePhoto
        ? dataUrlToRef(req.candidatePhoto)
        : req.candidate.isCustom
          ? null
          : await candidatePhotoRef(req.candidate.id),
    );
  } else {
    // REFERÊNCIA 1 = usuário
    wanted.push(req.userPhoto ? dataUrlToRef(req.userPhoto) : null);
    // REFERÊNCIA 2 = candidato (sempre, para os dois fluxos de 2 pessoas)
    wanted.push(
      req.candidatePhoto
        ? dataUrlToRef(req.candidatePhoto)
        : req.candidate.isCustom
          ? null
          : await candidatePhotoRef(req.candidate.id),
    );
  }

  const urls: string[] = [];
  for (const ref of wanted) {
    if (!ref) continue;
    urls.push(await uploadRef(key, ref));
  }
  return { urls, count: urls.length };
}

/* ── Prompt interno (fotorrealista) ─────────────────────────────────────── */

const POOL_CANDIDATE = [
  "sorrindo e fazendo joinha com as duas mãos",
  "usando óculos escuros, braços cruzados, sorriso de canto",
  "usando um chapéu, acenando com a mão, expressão simpática",
  "usando boné, polegar para cima, expressão animada",
  "fazendo coração com as mãos, expressão carinhosa",
  "dando uma gargalhada espontânea, mão no peito",
  "apontando para a câmera com as duas mãos, piscando um olho",
  "fazendo sinal de paz com a mão, cabeça levemente inclinada",
  "com as duas mãos na cintura, pose confiante, sorrindo",
  "mandando um beijo com a mão, expressão brincalhona",
  "dando de ombros com um sorriso divertido",
  "com o polegar para cima e piscando um olho",
];

const POOL_TWO = [
  "os dois lado a lado tirando uma selfie, sorrindo para a câmera, rostos próximos",
  "os dois lado a lado fazendo joinha, sorrindo animados",
  "a pessoa 1 apontando para a pessoa 2, os dois rindo",
  "os dois lado a lado, um com o braço sobre o ombro do outro, abraço amigável",
  "os dois fazendo sinal de paz, expressão descontraída",
  "os dois lado a lado rindo juntos, clima de amigos",
  "os dois fazendo coração com as mãos, expressão simpática",
  "os dois lado a lado com os polegares para cima, sorrindo",
];

const POOL_PHOTO = [
  "standing side by side, taking a casual friendly photo together, smiling at the camera",
  "standing next to each other, one with an arm around the other's shoulder, both smiling",
  "posing together for a photo, natural relaxed stance, daytime natural light",
  "greeting each other with a friendly handshake, warm expressions",
];

function variationFor(flow: FlowType, index: number): string {
  const pool =
    flow === "user_photo"
      ? POOL_PHOTO
      : flow === "user_candidate_pack"
        ? POOL_TWO
        : POOL_CANDIDATE;
  const base = pool[index % pool.length];
  const lap = Math.floor(index / pool.length);
  return lap === 0 ? base : `${base}, ângulo e enquadramento diferentes`;
}

const PHOTO_NEGATIVE =
  "NO cartoon, NO illustration, NO caricature, NO vector, NO anime, NO 3D " +
  "character, NO digital painting, NO sticker style, NO white sticker outline. " +
  "Avoid deformed faces or hands, extra fingers, extra people, duplicated faces.";

function promptFor(
  req: GenerationRequest,
  caption: string | null,
  variation: string,
): string {
  const name = req.candidate.name;

  if (req.flowType === "user_photo") {
    // Conceito fornecido pelo dono — foto realista de DUAS pessoas.
    return [
      "Create a highly photorealistic photograph featuring the two distinct " +
        "people provided in the reference images together in the same scene.",
      "REFERENCE IMAGE 1 represents PERSON 1 (a regular person). REFERENCE " +
        `IMAGE 2 represents PERSON 2 (${name}).`,
      "Preserve the facial identity, age, facial structure, hair, beard when " +
        "applicable, skin characteristics and recognizable features of PERSON 1. " +
        "Separately preserve the same for PERSON 2.",
      "These are TWO DIFFERENT PEOPLE. Do not merge their identities. Do not " +
        "copy one person's face onto the other. Do not replace either person. " +
        "Do not create additional people.",
      `Scene: ${variation}.`,
      "The final image must look like an authentic photograph: natural skin " +
        "texture, realistic hair, realistic hands, correct anatomy, natural " +
        "lighting, realistic camera perspective, natural depth of field, sharp " +
        "facial features.",
      PHOTO_NEGATIVE,
      "Facial identity preservation has higher priority than changing " +
        "clothing, poses, accessories or scenery.",
      STYLE_EXTRA,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 4500);
  }

  // Fluxos 1 e 2 — PESSOA FOTOGRÁFICA. O recorte de figurinha é feito depois.
  const two = req.flowType === "user_candidate_pack";
  const who = two
    ? `two different real people together: PERSON 1 from reference image 1 (a ` +
      `regular person) and PERSON 2 from reference image 2 (${name}). Keep each ` +
      `face, hair and beard exactly like their own reference. They are two ` +
      `distinct people — never repeat the same face on both.`
    : `${name}, the exact person from the reference image. Keep the same face, ` +
      `age, hair, beard and recognizable features as the reference.`;

  const legenda = caption
    ? `Add the short text "${caption}" as a small readable caption banner, ` +
      `large legible letters, no cut-off letters.`
    : "No text.";

  return [
    `A real, authentic photograph of ${who}`,
    `Scene: ${variation}.`,
    two
      ? "Both people from the chest up, facing the camera."
      : "From the chest up or waist up, facing the camera.",
    "Plain neutral studio background, even photographic lighting, natural skin " +
      "texture, realistic hands, sharp facial features, high detail.",
    "This is a REAL PHOTOGRAPH of real people — the sticker look will be added " +
      "later only as a cut-out. Do NOT convert the subject into an " +
      "illustration, cartoon, caricature or drawing.",
    "Present it as a die-cut photo sticker: the person is cut out with a thick " +
      "solid white border around the silhouette, on a plain background.",
    legenda,
    PHOTO_NEGATIVE,
    "Facial identity preservation is the top priority, above pose, clothing or " +
      "accessories.",
    STYLE_EXTRA,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 4500);
}

function captionPlan(
  quantity: number,
  customText: string | null,
): (string | null)[] {
  const c =
    customText && customText.trim() ? customText.trim().toUpperCase() : null;
  return Array.from({ length: quantity }, (_, i) => (c && i % 2 === 0 ? c : null));
}

/* ── Chamadas à Kie ────────────────────────────────────────────────────── */

type Timings = { tCreated: number; tDone: number; costMs: number | null };

async function jobsGenerate(
  key: string,
  model: string,
  input: Record<string, unknown>,
  timeoutMs: number = GEN_TIMEOUT_MS,
): Promise<{ url: string; t: Timings }> {
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
      `Kie createTask (${model}): ${res.status} ${j.msg ?? JSON.stringify(j).slice(0, 200)}`,
    );
  }
  const tCreated = Date.now();
  const taskId = j.data.taskId;
  const deadline = tCreated + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const p = await fetch(`${JOBS_INFO}?taskId=${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    const pj = (await p.json().catch(() => ({}))) as {
      data?: {
        state?: string;
        resultJson?: string;
        failCode?: string | null;
        failMsg?: string | null;
        costTime?: number | null;
      };
    };
    const st = pj.data?.state;
    if (st === "success") {
      const parsed = JSON.parse(pj.data?.resultJson || "{}") as {
        resultUrls?: string[];
      };
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error(`Kie ${model}: success sem resultUrls`);
      return {
        url,
        t: { tCreated, tDone: Date.now(), costMs: pj.data?.costTime ?? null },
      };
    }
    if (st === "fail") {
      throw new Error(
        `Kie ${model}: ${pj.data?.failCode || ""} ${pj.data?.failMsg || "geração falhou"}`.trim(),
      );
    }
  }
  throw new Error(`Kie ${model}: tempo esgotado`);
}

/** FLUX Kontext (1 imagem) — só usado se um override apontar para flux-kontext-*. */
async function fluxKontextGenerate(
  key: string,
  model: string,
  prompt: string,
  inputImage: string | null,
  aspectRatio: string,
): Promise<{ url: string; t: Timings }> {
  const res = await fetch(FLUX_GEN, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      prompt,
      model,
      aspectRatio,
      outputFormat: "png",
      enableTranslation: true,
      ...(inputImage ? { inputImage } : {}),
    }),
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
  const tCreated = Date.now();
  const taskId = j.data.taskId;
  const deadline = tCreated + GEN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const p = await fetch(`${FLUX_INFO}?taskId=${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    const pj = (await p.json().catch(() => ({}))) as {
      data?: { successFlag?: number; response?: { resultImageUrl?: string } };
    };
    const flag = pj.data?.successFlag;
    if (flag === 1 && pj.data?.response?.resultImageUrl)
      return {
        url: pj.data.response.resultImageUrl,
        t: { tCreated, tDone: Date.now(), costMs: null },
      };
    if (flag === 2 || flag === 3)
      throw new Error("Kie flux: geração falhou (successFlag 2/3)");
  }
  throw new Error("Kie flux: tempo esgotado");
}

// Borda branca de adesivo — largura relativa ao tamanho da imagem.
const STICKER_BORDER_ON = process.env.KIE_STICKER_BORDER !== "0";

/**
 * Recorte já veio transparente do `recraft/remove-background`. Aqui, no
 * servidor (sharp, rápido), adicionamos a BORDA BRANCA grossa e uniforme da
 * figurinha: dilata a silhueta, pinta de branco, e recoloca o recorte por cima.
 */
async function addStickerBorder(png: Buffer): Promise<Buffer> {
  try {
    const base = sharp(png).ensureAlpha();
    const meta = await base.metadata();
    const w = meta.width ?? 1024;
    const h = meta.height ?? 1024;
    const borderPx = Math.max(8, Math.round(Math.min(w, h) * 0.022));

    // Máscara dilatada: alpha -> blur -> threshold baixo = silhueta expandida.
    const dilated = await sharp(png)
      .ensureAlpha()
      .extractChannel("alpha")
      .blur(borderPx / 2)
      .threshold(24)
      .toColourspace("b-w")
      .png()
      .toBuffer();

    const whiteRGB = await sharp({
      create: { width: w, height: h, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();

    const whiteShape = await sharp(whiteRGB)
      .joinChannel(dilated)
      .png()
      .toBuffer();

    return await sharp(whiteShape)
      .composite([{ input: await base.png().toBuffer() }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    log("sticker_border_fallback", {
      msg: err instanceof Error ? err.message : String(err),
    });
    return png;
  }
}

async function removeBackground(key: string, imageUrl: string): Promise<string> {
  try {
    const { url } = await jobsGenerate(
      key,
      BG_REMOVE_MODEL,
      { image: imageUrl },
      BG_REMOVE_TIMEOUT_MS,
    );
    return url;
  } catch (err) {
    log("bg_remove_fallback", {
      msg: err instanceof Error ? err.message : String(err),
    });
    return imageUrl;
  }
}

/* ── Classificação de erro (fallback por tipo) ─────────────────────────── */

type ErrKind = "policy" | "transient" | "unknown";

function classifyError(msg: string): ErrKind {
  if (/sensitive|flagged|content polic|policy violation|violat|moderation|safety|not allowed/i.test(msg))
    return "policy";
  if (/tempo esgotado|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|network|fetch failed|socket|502|503|504|429|sem resultUrls/i.test(msg))
    return "transient";
  return "unknown";
}

/* ── Logs estruturados (sem segredos) ──────────────────────────────────── */

function log(event: string, data: Record<string, unknown>): void {
  try {
    console.log(`[gen] ${JSON.stringify({ event, ts: Date.now(), ...data })}`);
  } catch {
    /* nunca quebra a geração por causa de log */
  }
}

/* ── Geração de um item ────────────────────────────────────────────────── */

async function generateOne(
  key: string,
  req: GenerationRequest,
  cfg: FlowModel,
  caption: string | null,
  refUrls: string[],
  variation: string,
  variant: number,
): Promise<GeneratedItem> {
  const prompt = promptFor(req, caption, variation);
  const tStart = Date.now();

  let genUrl: string;
  let t: Timings;
  if (isFluxKontext(cfg.model)) {
    ({ url: genUrl, t } = await fluxKontextGenerate(
      key,
      cfg.model,
      prompt,
      refUrls[0] ?? null,
      cfg.aspect,
    ));
  } else {
    const input: Record<string, unknown> = {
      [refField(cfg.model)]: refUrls,
      prompt,
      aspect_ratio: cfg.aspect,
    };
    if (/^flux-2\//.test(cfg.model)) input.resolution = cfg.resolution;
    ({ url: genUrl, t } = await jobsGenerate(key, cfg.model, input));
  }

  const providerMs = t.tDone - t.tCreated;
  const isSticker = cfg.bgRemove && req.flowType !== "user_photo";

  // Figurinha: recorta o fundo (Kie) e depois adiciona a borda branca (sharp).
  const finalUrl = isSticker ? await removeBackground(key, genUrl) : genUrl;

  const img = await fetch(finalUrl);
  if (!img.ok) throw new Error(`download do resultado falhou (${img.status})`);
  let bytes: Buffer = Buffer.from(await img.arrayBuffer());
  let mime = img.headers.get("content-type")?.split(";")[0] || "image/png";

  if (isSticker && STICKER_BORDER_ON) {
    bytes = Buffer.from(await addStickerBorder(bytes));
    mime = "image/png";
  }

  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const storeKey = await storage.putOriginal(ab, mime);
  const previewPath = storeKey.startsWith("mem:")
    ? `/api/blob/${storeKey.slice(4)}?preview=1`
    : storeKey;

  log("item_ok", {
    generationId: req.generationId,
    flow: req.flowType,
    model: cfg.model,
    variant,
    providerMs,
    bgRemove: cfg.bgRemove && req.flowType !== "user_photo",
    totalMs: Date.now() - tStart,
    costMs: t.costMs,
  });

  return { previewPath, originalPath: storeKey, meta: { variant, caption } };
}

/* ── Orquestração ──────────────────────────────────────────────────────── */

export const fluxGenerator: ImageGenerator = {
  name: "kie",
  async generate(
    req: GenerationRequest,
    onItem?: (item: GeneratedItem) => void,
  ): Promise<GenerationResult> {
    const key = apiKey();
    const cfg = modelForFlow(req.flowType);
    const t0 = Date.now();

    // Referências — resolve e sobe. Fluxos de 2 pessoas EXIGEM 2.
    let refUrls: string[];
    try {
      ({ urls: refUrls } = await resolveRefs(key, req));
    } catch (err) {
      log("refs_error", {
        generationId: req.generationId,
        flow: req.flowType,
        msg: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        "Não consegui preparar as fotos de referência. Tente de novo em instantes.",
      );
    }

    log("start", {
      generationId: req.generationId,
      flow: req.flowType,
      model: cfg.model,
      endpoint: isFluxKontext(cfg.model) ? "flux/kontext" : "jobs/createTask",
      candidateId: req.candidate.id,
      candidateCustom: req.candidate.isCustom,
      referenceCount: refUrls.length,
      quantity: req.quantity,
      aspect: cfg.aspect,
      bgRemove: cfg.bgRemove,
    });

    if (refUrls.length < cfg.minRefs) {
      const falta =
        req.flowType === "candidate_pack"
          ? "a foto do candidato"
          : refUrls.length === 0
            ? "a sua foto e a do candidato"
            : "a foto do candidato";
      throw new Error(
        `Este fluxo precisa de ${cfg.minRefs} foto(s) de referência e só tenho ${refUrls.length} (falta ${falta}). Geração não iniciada.`,
      );
    }
    const refs = refUrls.slice(0, cfg.maxRefs);

    const caps = captionPlan(req.quantity, req.customText);
    const done = new Map<number, GeneratedItem>();
    const failures: { idx: number; kind: ErrKind; msg: string }[] = [];

    // Round 0 = todas as N em paralelo (em lotes de CONCURRENCY).
    // Round 1 = re-tenta SÓ o que falhou por motivo transitório/desconhecido.
    for (let round = 0; round < 2; round++) {
      const pending =
        round === 0
          ? Array.from({ length: req.quantity }, (_, i) => i)
          : failures
              .filter((f) => f.kind !== "policy")
              .map((f) => f.idx)
              .filter((i) => !done.has(i));
      if (pending.length === 0) break;
      if (round > 0) {
        log("retry_round", {
          generationId: req.generationId,
          retrying: pending.length,
        });
        failures.length = 0;
      }

      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const batch = pending.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map((idx) =>
            generateOne(
              key,
              req,
              cfg,
              caps[idx],
              refs,
              round === 0
                ? variationFor(req.flowType, idx)
                : variationFor(req.flowType, idx + req.quantity),
              (idx % 6) + 1,
            ).then((item) => ({ idx, item })),
          ),
        );
        for (let k = 0; k < settled.length; k++) {
          const r = settled[k];
          const idx = batch[k];
          if (r.status === "fulfilled") {
            done.set(idx, r.value.item);
            onItem?.(r.value.item);
          } else {
            const msg =
              r.reason instanceof Error ? r.reason.message : String(r.reason);
            const kind = classifyError(msg);
            failures.push({ idx, kind, msg });
            log("item_fail", {
              generationId: req.generationId,
              flow: req.flowType,
              model: cfg.model,
              idx,
              kind,
              providerMessage: msg.slice(0, 300),
            });
          }
        }
      }
    }

    const totalMs = Date.now() - t0;
    log("end", {
      generationId: req.generationId,
      flow: req.flowType,
      model: cfg.model,
      requested: req.quantity,
      completed: done.size,
      failed: req.quantity - done.size,
      totalMs,
    });

    if (done.size === 0) {
      const anyPolicy = failures.some((f) => f.kind === "policy");
      throw new Error(
        anyPolicy
          ? "O modelo recusou gerar as imagens por política de conteúdo. Tente outro candidato ou outra foto."
          : failures[0]?.msg || "Falha na geração (Kie).",
      );
    }
    if (done.size < req.quantity) {
      const anyPolicy = failures.some((f) => f.kind === "policy");
      throw new Error(
        anyPolicy
          ? `Geramos ${done.size} de ${req.quantity} — o modelo recusou o restante por política de conteúdo. Você não será cobrado.`
          : `Geramos ${done.size} de ${req.quantity} imagens. Tente novamente — você não será cobrado.`,
      );
    }

    const items = Array.from({ length: req.quantity }, (_, i) => done.get(i)!);
    return { items };
  },
};

/** Alias explícito. */
export const kieGenerator = fluxGenerator;
