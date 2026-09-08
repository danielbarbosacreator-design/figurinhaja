import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/memory";
import { verifyBlobSignature } from "@/lib/storage/memory";

/**
 * Serve os bitmaps gerados que estão em memória (STORAGE_PROVIDER=memory).
 *
 *  ?preview=1        → prévia protegida: baixa fidelidade + marca d'água.
 *                      Pública, mas nunca é o arquivo final.
 *  ?exp=&sig=        → arquivo ORIGINAL. Só sai com assinatura HMAC válida,
 *                      emitida por /api/download/[assetId] após o pedido PAID.
 *  (sem parâmetros)  → 403.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const blob = db.blobs.get(id);
  if (!blob) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const isPreview = sp.get("preview") === "1";
  const exp = sp.get("exp");
  const sig = sp.get("sig");

  if (isPreview) {
    const svg = watermarkedSvg(blob.mime, blob.bytes);
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=60",
      },
    });
  }

  if (exp && sig && verifyBlobSignature(id, exp, sig)) {
    const ext = blob.mime.includes("png") ? "png" : blob.mime.includes("webp") ? "webp" : "jpg";
    return new Response(new Uint8Array(blob.bytes), {
      headers: {
        "content-type": blob.mime,
        "content-disposition": `attachment; filename="figurinha.${ext}"`,
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
}

/** Envolve o bitmap num SVG com marca d'água diagonal (sem dependência de imagem raster). */
function watermarkedSvg(mime: string, bytes: Buffer): string {
  const dataUri = `data:${mime};base64,${bytes.toString("base64")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <pattern id="wm" width="150" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <text x="0" y="70" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700" fill="#ffffff" fill-opacity="0.30">PRÉVIA</text>
    </pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.7" stop-color="#0F172A" stop-opacity="0"/>
      <stop offset="1" stop-color="#0F172A" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <image href="${dataUri}" x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid slice"/>
  <rect width="512" height="512" fill="url(#fade)"/>
  <rect width="512" height="512" fill="url(#wm)"/>
</svg>`;
}
