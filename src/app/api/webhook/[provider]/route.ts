import { NextRequest, NextResponse } from "next/server";
import { db, paymentForOrder, assetsForGeneration } from "@/lib/db/memory";
import { paymentGateway } from "@/lib/payments";

/**
 * Único caminho que marca um pedido como PAID (blocos 10 e 21).
 *
 * - Não confia em redirecionamento de navegador.
 * - Verifica a assinatura/segredo do gateway antes de qualquer coisa.
 * - É idempotente: reentregas do webhook não causam efeito duplicado.
 * - Só aqui os assets são liberados (isUnlocked = true).
 *
 * Fase 5: disparar aqui o `Purchase` via Meta Conversions API (server-side).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (provider !== paymentGateway.name) {
    return NextResponse.json({ error: "Provider desconhecido." }, { status: 404 });
  }

  const rawBody = await req.text();
  const event = await paymentGateway.verifyWebhook({
    provider,
    headers: req.headers,
    rawBody,
  });

  if (!event) {
    // assinatura inválida — não revela detalhes
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const order = event.orderId ? db.orders.get(event.orderId) : undefined;
  if (!order) {
    // 200 mesmo assim: evita o gateway ficar reenviando para sempre
    return NextResponse.json({ received: true, matched: false });
  }

  const payment = paymentForOrder(order.id);
  const now = new Date().toISOString();
  if (payment) {
    payment.status = event.status;
    payment.method = event.method ?? payment.method ?? null;
    payment.providerPaymentId = event.providerPaymentId;
    payment.updatedAt = now;
  }

  if (event.status === "approved") {
    if (order.status !== "PAID") {
      order.status = "PAID";
      for (const asset of assetsForGeneration(order.generationId)) {
        asset.isUnlocked = true;
      }
      console.log("[analytics] payment_approved", {
        orderId: order.id,
        amount: order.amount,
        provider,
      });
    }
  } else if (event.status === "rejected" || event.status === "expired") {
    if (order.status !== "PAID") order.status = "CANCELED";
  } else if (event.status === "refunded") {
    order.status = "REFUNDED";
    for (const asset of assetsForGeneration(order.generationId)) {
      asset.isUnlocked = false;
    }
  }

  return NextResponse.json({ received: true, matched: true, status: order.status });
}
