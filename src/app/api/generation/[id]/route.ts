import { NextRequest, NextResponse } from "next/server";
import { db, assetsForGeneration, orderForGeneration } from "@/lib/db/memory";

/**
 * Status da geração + assets.
 * `originalPath` só é devolvido quando o asset está liberado (pagamento
 * confirmado). Sem isso, o cliente nunca recebe o caminho do arquivo final.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const generation = db.generations.get(id);
  if (!generation) {
    return NextResponse.json(
      { error: "Geração não encontrada." },
      { status: 404 },
    );
  }

  const order = orderForGeneration(id);
  const paid = order?.status === "PAID";

  const assets = assetsForGeneration(id).map((a) => ({
    id: a.id,
    type: a.type,
    previewPath: a.previewPath,
    isUnlocked: a.isUnlocked,
    originalPath: a.isUnlocked ? `/api/download/${a.id}` : null,
    meta: a.meta,
  }));

  return NextResponse.json({
    id: generation.id,
    status: generation.status,
    quantity: generation.quantity,
    productType: generation.productType,
    productId: generation.productId,
    candidate: generation.candidate,
    customText: generation.customText,
    error: generation.error ?? null,
    paid,
    orderId: order?.id ?? null,
    assets,
  });
}
