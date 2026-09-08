import { NextRequest, NextResponse } from "next/server";
import { db, orderForGeneration } from "@/lib/db/memory";
import { getProductById } from "@/lib/config";
import { paymentGateway } from "@/lib/payments";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import type { Order, Payment } from "@/types";

/**
 * Cria (ou reaproveita) o pedido e inicia o checkout no gateway.
 * O valor cobrado é SEMPRE o preço do produto na config do servidor.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`checkout:${clientKey(req)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Aguarde um instante." }, { status: 429 });
  }

  let body: { generationId?: string; productId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const generation = body.generationId
    ? db.generations.get(body.generationId)
    : undefined;
  if (!generation) {
    return NextResponse.json({ error: "Geração não encontrada." }, { status: 404 });
  }
  if (generation.status !== "completed") {
    return NextResponse.json(
      { error: "O resultado ainda não está pronto." },
      { status: 409 },
    );
  }

  const product =
    getProductById(body.productId) ?? getProductById(generation.productId);
  if (!product) {
    return NextResponse.json({ error: "Produto inválido." }, { status: 400 });
  }

  // Idempotência: se já existe pedido para essa geração, reusa.
  let order = orderForGeneration(generation.id);
  if (order && order.status === "PAID") {
    return NextResponse.json({ orderId: order.id, alreadyPaid: true });
  }
  if (!order) {
    order = {
      id: crypto.randomUUID(),
      sessionId: generation.sessionId,
      generationId: generation.id,
      productId: product.id,
      amount: product.priceCents,
      currency: "BRL",
      status: "PENDING",
      createdAt: new Date().toISOString(),
    } satisfies Order;
    db.orders.set(order.id, order);
  }

  const origin = req.nextUrl.origin;
  const checkout = await paymentGateway.createCheckout({
    order,
    description: `${product.label} — Figurinhas`,
    returnUrl: `${origin}/criar/aprovado`,
  });

  const now = new Date().toISOString();
  const payment: Payment = {
    id: crypto.randomUUID(),
    orderId: order.id,
    provider: paymentGateway.name,
    providerPaymentId: checkout.providerPaymentId,
    method: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  db.payments.set(payment.id, payment);

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    checkoutUrl: checkout.checkoutUrl,
  });
}
