import { NextRequest, NextResponse } from "next/server";
import { db, paymentForOrder } from "@/lib/db/memory";

/** Status do pedido — usado pelo polling da tela de checkout / aprovado. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = db.orders.get(id);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const payment = paymentForOrder(id);
  return NextResponse.json({
    id: order.id,
    status: order.status,
    amount: order.amount,
    generationId: order.generationId,
    paymentStatus: payment?.status ?? null,
  });
}
