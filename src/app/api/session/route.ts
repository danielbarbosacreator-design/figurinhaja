import { NextRequest, NextResponse } from "next/server";

/**
 * Cria um identificador de sessão anônimo. Sem cadastro (bloco 1).
 * Fase 2: gravar em tabela `Session` com userAgent e timestamp.
 */
export async function POST(req: NextRequest) {
  const sessionId = crypto.randomUUID();
  return NextResponse.json({
    sessionId,
    createdAt: new Date().toISOString(),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
}
