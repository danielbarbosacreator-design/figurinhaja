import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { rateLimit, clientKey } from "@/lib/rateLimit";

/**
 * Recebe uma foto do usuário e guarda no armazenamento privado.
 *
 * Fase 1: não é usado pelo fluxo — as fotos ficam no cliente (data URL) e são
 * enviadas junto do /api/generate. Esta rota já existe com validação para a
 * Fase 2, quando o upload vai direto para o Supabase Storage.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const rl = rateLimit(`upload:${clientKey(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Aguarde um instante." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Escolha uma foto para enviar." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Essa foto é muito pesada. Escolha uma foto menor." },
      { status: 413 },
    );
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato de foto não aceito. Use JPG ou PNG." },
      { status: 415 },
    );
  }

  const key = await storage.putUpload(await file.arrayBuffer(), file.type);
  return NextResponse.json({ key });
}
