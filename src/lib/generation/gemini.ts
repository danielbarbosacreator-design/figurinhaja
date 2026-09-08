/**
 * Gerador real — Google Gemini (modelo de imagem "Nano Banana").
 *
 * Liga com GENERATION_PROVIDER=gemini + GEMINI_API_KEY no .env.local.
 * Recomendado usar junto STORAGE_PROVIDER=memory (Fase 1) para os bitmaps
 * terem onde ficar até o Supabase (Fase 2).
 *
 * Roda SÓ no servidor. A chave nunca é enviada ao cliente.
 */
import type {
  ImageGenerator,
  GenerationRequest,
  GenerationResult,
  GeneratedItem,
} from "./index";
import { storage } from "@/lib/storage";
import {
  dataUrlToRef,
  candidatePhotoRef,
  type ImageRef as InlinePart,
} from "./refs";

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const dataUrlToInline = dataUrlToRef;
const candidatePhotoFromConfig = candidatePhotoRef;

function buildPrompt(
  req: GenerationRequest,
  caption: string | null,
  hasUserPhoto: boolean,
  hasCandidatePhoto: boolean,
): string {
  const name = req.candidate.name;
  const legenda = caption
    ? ` Inclua o texto "${caption}" em letras grandes, estilo pincel, integrado à arte de forma legível.`
    : "";

  if (req.flowType === "user_photo") {
    return (
      `Crie uma FOTO realista da pessoa da primeira imagem de referência ao lado de ${name}` +
      `${hasCandidatePhoto ? " (segunda imagem de referência)" : ""}, como se estivessem juntos, ` +
      `posando para uma selfie amigável. Preserve fielmente os rostos das referências, ` +
      `iluminação natural, enquadramento vertical.${legenda}`
    );
  }

  if (req.flowType === "user_candidate_pack") {
    return (
      `Crie uma FIGURINHA (sticker) divertida com a pessoa da primeira imagem de referência ` +
      `junto de ${name}${hasCandidatePhoto ? " (segunda imagem de referência)" : ""}, ` +
      `lado a lado, sorrindo. Estilo adesivo: contorno branco grosso, fundo simples, ` +
      `alta qualidade, recorte limpo. Preserve os rostos das referências.${legenda}`
    );
  }

  // candidate_pack
  return (
    `Crie uma FIGURINHA (sticker) divertida e carismática de ${name}` +
    `${hasCandidatePhoto ? ", com base na imagem de referência" : ""}. ` +
    `Estilo adesivo: contorno branco grosso, fundo simples, expressão simpática, ` +
    `alta qualidade, recorte limpo.${legenda}`
  );
}

/**
 * Passo de "entendimento": um modelo de texto lê o que foi selecionado
 * (tipo de produto, candidato, frase, quantidade) e devolve um plano com
 * um prompt de imagem sob medida para cada figurinha. Se falhar, o chamador
 * cai nos templates de `buildPrompt`.
 */
async function planPrompts(
  req: GenerationRequest,
  apiKey: string,
  hasUserPhoto: boolean,
  hasCandidatePhoto: boolean,
): Promise<{ prompt: string; caption: string | null }[] | null> {
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const flowDesc: Record<GenerationRequest["flowType"], string> = {
    candidate_pack: "figurinhas (stickers) só do candidato",
    user_candidate_pack: "figurinhas (stickers) do usuário junto com o candidato",
    user_photo: "uma foto realista do usuário junto com o candidato",
  };

  const instruction =
    `Você planeja prompts para um gerador de imagem que fará ${req.quantity} ` +
    `${flowDesc[req.flowType]}.\n` +
    `Candidato: ${req.candidate.name}.\n` +
    `Frase pedida pelo usuário: ${req.customText ? `"${req.customText}"` : "nenhuma (crie variações de apoio curtas e divertidas)"}.\n` +
    `Fotos de referência disponíveis: ${[
      hasUserPhoto ? "foto do usuário" : null,
      hasCandidatePhoto ? "foto do candidato" : null,
    ]
      .filter(Boolean)
      .join(" e ") || "nenhuma"}.\n` +
    `Regras: estilo adesivo com contorno branco grosso e recorte limpo (exceto no caso de foto realista); ` +
    `preserve fielmente os rostos das referências; tom bem-humorado e respeitoso; nada ofensivo. ` +
    `Varie pose, enquadramento e expressão entre os itens.\n` +
    `Responda em JSON: {"items":[{"prompt":"<prompt detalhado em português>","caption":"<texto curto na arte ou null>"}]} com exatamente ${req.quantity} itens.`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = JSON.parse(raw) as {
      items?: Array<{ prompt?: string; caption?: string | null }>;
    };
    const items = (parsed.items ?? [])
      .filter((it) => typeof it.prompt === "string" && it.prompt.trim())
      .map((it) => ({
        prompt: it.prompt!.trim(),
        caption:
          typeof it.caption === "string" && it.caption.trim()
            ? it.caption.trim().slice(0, 24)
            : null,
      }));
    return items.length ? items : null;
  } catch {
    return null;
  }
}

async function generateOne(
  prompt: string,
  apiKey: string,
  caption: string | null,
  refs: InlinePart[],
  variant: number,
): Promise<GeneratedItem> {
  const parts: Array<{ text: string } | { inlineData: InlinePart }> = [
    { text: prompt },
    ...refs.map((r) => ({ inlineData: r })),
  ];

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: InlinePart; inline_data?: InlinePart }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini bloqueou o pedido: ${json.promptFeedback.blockReason}`);
  }

  const partList = json.candidates?.[0]?.content?.parts ?? [];
  const img = partList
    .map((p) => p.inlineData ?? p.inline_data)
    .find((d): d is InlinePart => Boolean(d?.data));

  if (!img) {
    throw new Error("Gemini não devolveu imagem.");
  }

  const bytes = Buffer.from(img.data, "base64");
  const mime = img.mimeType || "image/png";
  const key = await storage.putOriginal(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    mime,
  );

  const previewPath = key.startsWith("mem:")
    ? `/api/blob/${key.slice(4)}?preview=1`
    : key; // outros storages precisam expor a prévia por conta própria

  return { previewPath, originalPath: key, meta: { variant, caption } };
}

export const geminiGenerator: ImageGenerator = {
  name: "gemini",
  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "COLE_SUA_CHAVE_AQUI") {
      throw new Error(
        "GEMINI_API_KEY ausente. Preencha no .env.local para usar GENERATION_PROVIDER=gemini.",
      );
    }
    if (apiKey.startsWith("gen-lang-client")) {
      throw new Error(
        "GEMINI_API_KEY inválida: esse valor é o ID do projeto, não a chave. " +
          "Copie a chave (começa com 'AIza' ou 'AQ.') da coluna 'API key' em aistudio.google.com/apikey.",
      );
    }

    const userInline = req.userPhoto ? dataUrlToInline(req.userPhoto) : null;
    let candInline = req.candidatePhoto ? dataUrlToInline(req.candidatePhoto) : null;
    if (!candInline && !req.candidate.isCustom) {
      candInline = await candidatePhotoFromConfig(req.candidate.id);
    }

    const refs: InlinePart[] = [];
    if (userInline) refs.push(userInline);
    if (candInline) refs.push(candInline);

    const hasUser = Boolean(userInline);
    const hasCand = Boolean(candInline);

    // 1) Entendimento: o modelo de texto planeja um prompt por figurinha a
    //    partir do que foi selecionado. Sem isso, usa os templates fixos.
    const plan = await planPrompts(req, apiKey, hasUser, hasCand);
    const caps = captionPlan(req.quantity, req.customText);

    const items: GeneratedItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < req.quantity; i++) {
      const planned = plan?.[i];
      const caption = planned ? planned.caption : caps[i];
      const prompt = planned
        ? planned.prompt
        : buildPrompt(req, caption, hasUser, hasCand);
      try {
        const item = await generateOne(prompt, apiKey, caption, refs, (i % 6) + 1);
        items.push(item);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      // respiro para o rate limit do tier gratuito
      if (i < req.quantity - 1) await new Promise((r) => setTimeout(r, 1200));
    }

    if (items.length === 0) {
      throw new Error(errors[0] ?? "Falha na geração com Gemini.");
    }
    return { items };
  },
};

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
