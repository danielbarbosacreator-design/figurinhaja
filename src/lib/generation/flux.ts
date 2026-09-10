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
// Kie processa vários jobs em paralelo. Quanto maior, menos lotes sequenciais
// (pack de 20 em 4 lotes em vez de 7). KIE_CONCURRENCY ajusta.
const CONCURRENCY = Math.max(
  1,
  Math.min(12, Number(process.env.KIE_CONCURRENCY) || 6),
);

// Passo de upscale (Recraft Crisp Upscale via Kie "jobs"): 1024 -> 2048/4096,
// remove ruído e limpa contornos, mas DOBRA o tempo total (um job extra por
// figurinha). Desligado por padrão — o nano-banana já sai nítido. FLUX_UPSCALE=1
// religa quando a nitidez extra vale a espera.
const UPSCALE_ON = process.env.FLUX_UPSCALE === "1";
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

/**
 * O usuário final NUNCA escreve prompt. Tudo abaixo é montado automaticamente
 * a partir das escolhas da interface (tipo, candidato, quantidade, fotos).
 */

// Estilo padrão das figurinhas (fluxos "candidate_pack" e "user_candidate_pack").
const STICKER_STYLE =
  "Estilo: figurinha (sticker) premium para WhatsApp — ilustração vetorial " +
  "limpa e moderna, contorno/borda branca grossa e uniforme por toda a " +
  "silhueta, recorte limpo, FUNDO TOTALMENTE TRANSPARENTE (sem cenário, sem " +
  "fundo colorido, sem sombra projetada), formato PNG, cores vivas, alta " +
  "nitidez, personagem centralizado com margem de folga em volta, " +
  "enquadramento do corpo inteiro ou da cintura para cima, iluminação boa e " +
  "uniforme, rosto bem definido, mãos corretas, aparência descontraída e " +
  "simpática.";

// Estilo do fluxo "user_photo" — foto realista, NUNCA figurinha.
const PHOTO_STYLE =
  "Estilo: fotografia realista e natural — parece uma foto de verdade tirada " +
  "no celular, cenário realista e agradável, iluminação natural, foco nítido " +
  "nos dois rostos, composição boa para redes sociais. SEM borda branca, SEM " +
  "recorte de figurinha, SEM fundo transparente, SEM aparência de desenho ou " +
  "ilustração.";

const NEGATIVE =
  "Evite: rosto ou mãos deformados, dedos a mais ou a menos, olhos tortos, " +
  "boca distorcida, óculos/chapéu/boné deformados, pessoas extras no fundo, " +
  "rostos duplicados, mistura de identidades, membros ou acessórios cortados " +
  "pela borda, baixa resolução, texto aleatório.";

// Ajuste global de estilo, só para o admin (não há campo no app). Vazio = nada.
const STYLE_EXTRA = (process.env.KIE_STYLE_EXTRA || "").trim();

/**
 * Biblioteca de variações automáticas — pose + expressão + acessório +
 * elemento. Cada imagem do pack pega uma entrada diferente para que 5 pedidas
 * saiam 5 DIFERENTES, não 5 quase iguais. As 5 primeiras seguem a ordem
 * preferida do briefing.
 */
// Poses NEUTRAS de propósito: o nano-banana recusa figura política + carga
// eleitoral (bandeira, punho cerrado, "comício", verde-e-amarelo). Aqui é um
// pack de personalidade divertido, não de campanha — reduz muito a recusa.
const POOL_CANDIDATE = [
  "fazendo joinha com as duas mãos, sorriso largo",
  "usando óculos escuros estilosos, braços cruzados, sorriso de canto",
  "usando um chapéu de palha, acenando com a mão, expressão simpática",
  "usando boné, polegar para cima, expressão animada",
  "fazendo coração com as mãos, expressão carinhosa e carismática",
  "dando uma gargalhada espontânea, mão no peito, expressão divertida",
  "apontando para a câmera com as duas mãos, sorriso divertido, piscando um olho",
  "fazendo sinal de paz com a mão, sorriso tranquilo, cabeça levemente inclinada",
  "com as duas mãos na cintura, pose confiante, sorrindo",
  "mandando um beijo com a mão, expressão simpática e brincalhona",
  "dando de ombros com um sorriso divertido, palmas das mãos para cima",
  "com o polegar para cima e piscando um olho, pose de aprovação",
];

const POOL_USER_CANDIDATE = [
  "os dois lado a lado tirando uma selfie juntos, sorrindo para a câmera, rostos próximos",
  "os dois lado a lado fazendo joinha, sorrindo animados",
  "a pessoa do usuário apontando para o candidato ao lado, os dois rindo",
  "os dois lado a lado, o candidato com o braço sobre o ombro da pessoa do usuário, abraço amigável",
  "os dois fazendo sinal de paz, expressão descontraída",
  "os dois lado a lado rindo juntos, clima de amigos de longa data",
  "os dois fazendo coração com as mãos, expressão simpática",
  "os dois lado a lado com os polegares para cima, sorrindo",
];

const POOL_USER_PHOTO = [
  "uma selfie natural dos dois juntos, sorrindo, tirada com o braço esticado",
  "os dois lado a lado posando para uma foto casual, luz natural de dia",
  "os dois de pé conversando e sorrindo, foto espontânea",
  "os dois se cumprimentando com um aperto de mãos, foto de encontro amistoso",
];

function poolFor(flow: GenerationRequest["flowType"]): string[] {
  if (flow === "user_photo") return POOL_USER_PHOTO;
  if (flow === "user_candidate_pack") return POOL_USER_CANDIDATE;
  return POOL_CANDIDATE;
}

/** Variação automática do item `index` (0-based). Cicla o pool sem repetir cedo. */
function variationFor(flow: GenerationRequest["flowType"], index: number): string {
  const pool = poolFor(flow);
  const base = pool[index % pool.length];
  // Passou do tamanho do pool: nudge de ângulo pra não sair idêntico.
  const lap = Math.floor(index / pool.length);
  return lap === 0
    ? base
    : `${base}, com ângulo e enquadramento levemente diferentes`;
}

/**
 * Monta o prompt interno. Ordem de prioridade embutida (briefing):
 * 1º identidade facial · 2º duas identidades distintas · 3º anatomia ·
 * 4º pose automática · 5º acessórios · 6º estilo.
 */
function promptFor(
  req: GenerationRequest,
  caption: string | null,
  refCount: number,
  variation: string,
): string {
  const name = req.candidate.name;
  const twoPeople = req.flowType !== "candidate_pack";

  let identity: string;
  if (twoPeople) {
    identity =
      `Duas pessoas DIFERENTES e reconhecíveis juntas: a pessoa da 1ª foto de ` +
      `referência (o usuário) e ${name}` +
      (refCount >= 2
        ? ` (2ª foto de referência)`
        : ` (mantenha a semelhança real de ${name})`) +
      `. Preserve com fidelidade o rosto de CADA uma, separadamente. Nunca use ` +
      `o mesmo rosto nas duas, não funda nem troque os rostos, não substitua ` +
      `nenhuma delas e não crie uma terceira pessoa.`;
  } else {
    identity =
      `${name}, sozinho, sem nenhuma outra pessoa na imagem. Preserve com ` +
      `fidelidade o rosto e a identidade de ${name} a partir da(s) foto(s) de ` +
      `referência — o rosto é consistente mesmo mudando roupa, acessório e pose.`;
  }

  const scene = twoPeople
    ? `Cena: ${variation}.`
    : `Cena: ${name} ${variation}.`;

  const style = req.flowType === "user_photo" ? PHOTO_STYLE : STICKER_STYLE;

  const legenda = caption
    ? `Inclua o texto "${caption}" em uma faixa/balão de adesivo, letras ` +
      `grandes e 100% legíveis, sem cortar nem distorcer as letras.`
    : `Não inclua nenhum texto, letra ou marca d'água.`;

  const priority =
    `Prioridade: a identidade facial correta vem acima de qualquer acessório ` +
    `ou pose — nunca sacrifique o rosto para cumprir um gesto. Anatomia ` +
    `correta (mãos, dedos, olhos, boca). Nada cortado: cabeça, mãos, chapéu e ` +
    `boné sempre inteiros dentro do quadro.`;

  return [identity, scene, style, legenda, priority, NEGATIVE, STYLE_EXTRA]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1600);
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
    await new Promise((r) => setTimeout(r, 2000));
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
    await new Promise((r) => setTimeout(r, 2000));
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
  variation: string,
  variant: number,
): Promise<GeneratedItem> {
  const portrait = req.flowType === "user_photo";
  const aspect = portrait ? "3:4" : "1:1";
  const prompt = promptFor(req, caption, refUrls.length, variation);

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

/**
 * Legendas. Regra do briefing: NUNCA inventar texto. Só entra a frase que o
 * usuário digitou (uma só, no app), distribuída em ~metade das imagens para o
 * pack ter variedade (umas com frase, outras limpas).
 */
function captionPlan(
  quantity: number,
  customText: string | null,
): (string | null)[] {
  const c = customText && customText.trim() ? customText.trim().toUpperCase() : null;
  return Array.from({ length: quantity }, (_, i) => (c && i % 2 === 0 ? c : null));
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
  async generate(
    req: GenerationRequest,
    onItem?: (item: GeneratedItem) => void,
  ): Promise<GenerationResult> {
    const key = apiKey();

    const { urls: refUrls, warnings } = await resolveRefs(key, req);
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

    const caps = captionPlan(req.quantity, req.customText);
    // Mapa índice -> item pronto. O usuário pediu N; entregamos N.
    const done = new Map<number, GeneratedItem>();
    const errors: string[] = [];

    // Round 0 = tentativa normal; rounds seguintes só re-tentam o que faltou,
    // com uma variação diferente (o modelo às vezes recusa uma pose/acessório).
    const MAX_ROUNDS = 3;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const pending = Array.from({ length: req.quantity }, (_, i) => i).filter(
        (i) => !done.has(i),
      );
      if (pending.length === 0) break;
      if (round > 0) {
        console.warn(
          `[kie] round ${round}: re-tentando ${pending.length} item(ns)`,
        );
        await new Promise((r) => setTimeout(r, 1500));
      }

      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const batch = pending.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map((idx) =>
            generateOne(
              key,
              req,
              caps[idx],
              refUrls,
              // a cada round pega a próxima "volta" do pool → pose diferente
              variationFor(req.flowType, idx + round * req.quantity),
              (idx % 6) + 1,
            ).then((item) => ({ idx, item })),
          ),
        );
        for (const r of settled) {
          if (r.status === "fulfilled") {
            done.set(r.value.idx, r.value.item);
            onItem?.(r.value.item); // progresso anda item a item
          } else {
            errors.push(
              r.reason instanceof Error ? r.reason.message : String(r.reason),
            );
            console.warn(
              `[kie] item falhou: ${
                r.reason instanceof Error ? r.reason.message : String(r.reason)
              }`,
            );
          }
        }
      }
    }

    if (done.size === 0)
      throw new Error(errors[0] ?? "Falha na geração (Kie).");
    if (done.size < req.quantity) {
      throw new Error(
        `Geramos ${done.size} de ${req.quantity} imagens. ` +
          `Tente novamente — você não será cobrado.`,
      );
    }

    // Devolve na ordem dos índices (1..N), legendas/poses batendo com o plano.
    const items = Array.from({ length: req.quantity }, (_, i) => done.get(i)!);
    return { items };
  },
};

/** Alias explícito — `import { kieGenerator }`. */
export const kieGenerator = fluxGenerator;
