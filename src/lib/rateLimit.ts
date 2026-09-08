/**
 * Rate limiting simples em memória para as rotas caras (bloco 21).
 * Fase 2: trocar por Upstash/Redis para valer em ambiente com múltiplas instâncias.
 */
const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (arr.length > limit) {
    return { ok: false, retryAfterMs: windowMs - (now - arr[0]) };
  }
  return { ok: true, retryAfterMs: 0 };
}

export function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local"
  );
}
