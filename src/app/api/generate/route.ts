import { NextRequest, NextResponse } from "next/server";
import { startGeneration } from "@/lib/generation/run";
import { getFlow, getProductById, getDefaultProduct } from "@/lib/config";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import type { FlowType } from "@/types";

const FLOWS: FlowType[] = ["candidate_pack", "user_candidate_pack", "user_photo"];

export async function POST(req: NextRequest) {
  const rl = rateLimit(`generate:${clientKey(req)}`, {
    limit: 8,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: {
    sessionId?: string;
    flowType?: FlowType;
    productId?: string | null;
    candidate?: { id?: string; name?: string; isCustom?: boolean };
    customText?: string | null;
    userPhoto?: string | null;
    candidatePhoto?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!body.sessionId || !body.flowType || !FLOWS.includes(body.flowType)) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const flow = getFlow(body.flowType);

  // Preço/quantidade vêm SEMPRE da config no servidor, nunca do cliente.
  const product = flow.usesPacks
    ? (getProductById(body.productId) ?? getDefaultProduct(body.flowType))
    : getDefaultProduct(body.flowType);

  const candidate = {
    id: body.candidate?.id || "custom",
    name: (body.candidate?.name || "Candidato").slice(0, 40),
    isCustom: Boolean(body.candidate?.isCustom),
  };

  if (flow.needsUserPhoto && !body.userPhoto) {
    return NextResponse.json(
      { error: "Falta a sua foto." },
      { status: 400 },
    );
  }

  const customText =
    typeof body.customText === "string" && body.customText.trim()
      ? body.customText.trim().slice(0, 24)
      : null;

  const generation = startGeneration({
    sessionId: body.sessionId,
    flowType: body.flowType,
    productId: product.id,
    candidate,
    customText,
    quantity: product.quantity,
    userPhoto: body.userPhoto ?? null,
    candidatePhoto: body.candidatePhoto ?? null,
  });

  return NextResponse.json({
    generationId: generation.id,
    status: generation.status,
    productId: product.id,
    quantity: product.quantity,
  });
}
