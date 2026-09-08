/**
 * Gerador mock: devolve figurinhas de exemplo (SVGs estáticos em /public/samples).
 *
 * A separação previewPath / originalPath já é real:
 *  - previewPath aponta para o SVG "com marca d'água"
 *  - originalPath aponta para o SVG "limpo"
 * Na Fase 3 o provedor real produz bitmaps e o downscale + watermark do preview
 * é feito no servidor antes de salvar.
 */
import type { ImageGenerator, GenerationRequest, GenerationResult } from "./index";

const CAPTIONS = [
  "TAMO JUNTO",
  "É NÓIS",
  "BRASIL",
  "PRA CIMA",
  "CONFIA",
  "VAMO QUE VAMO",
  "FORÇA",
  "NA LUTA",
];

function pickCaptions(quantity: number, customText: string | null): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < quantity; i++) {
    if (customText && i % 3 === 0) out.push(customText.toUpperCase());
    else if (i % 4 === 3) out.push(null); // algumas sem texto
    else out.push(CAPTIONS[i % CAPTIONS.length]);
  }
  return out;
}

export const mockGenerator: ImageGenerator = {
  name: "mock",
  async generate(req: GenerationRequest): Promise<GenerationResult> {
    // pequeno atraso para a tela "Estamos criando..." fazer sentido
    await new Promise((r) => setTimeout(r, 600));

    const captions = pickCaptions(req.quantity, req.customText);
    const items = captions.map((caption, i) => {
      const variant = (i % 6) + 1;
      const q = new URLSearchParams({
        v: String(variant),
        c: caption ?? "",
        n: req.candidate.name,
      });
      return {
        previewPath: `/api/mock-image?${q}&wm=1`,
        originalPath: `/api/mock-image?${q}&wm=0`,
        meta: { variant, caption },
      };
    });

    return { items };
  },
};
