import { NextRequest, NextResponse } from "next/server";
import { db, orderForGeneration } from "@/lib/db/memory";
import { storage } from "@/lib/storage";

/**
 * Entrega o arquivo final. Autorização feita SÓ no servidor:
 * o asset precisa pertencer a uma geração cujo pedido está PAID.
 * Mexer em parâmetro no frontend não libera nada (bloco 21).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = db.assets.get(assetId);
  if (!asset) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const order = orderForGeneration(asset.generationId);
  if (!order || order.status !== "PAID" || !asset.isUnlocked) {
    return NextResponse.json(
      { error: "Este arquivo ainda não está liberado." },
      { status: 402 },
    );
  }

  // URL assinada e temporária (na Fase 2, do bucket privado do Supabase).
  const url = await storage.signedDownloadUrl(asset.originalPath, 300);
  return NextResponse.redirect(new URL(url, _req.nextUrl.origin), 302);
}
