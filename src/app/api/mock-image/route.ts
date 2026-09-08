import { NextRequest } from "next/server";

/**
 * Gera figurinhas de EXEMPLO como SVG, para a Fase 1 (sem geração de IA real).
 *
 * A proteção da prévia já é real e feita aqui no servidor:
 *  - wm=1  → resolução menor + marca d'água diagonal discreta (mas legível)
 *  - wm=0  → arquivo "final" limpo, só servido após pagamento confirmado
 *
 * Na Fase 3 este arquivo é substituído: o provedor de IA devolve bitmaps e o
 * downscale + watermark do preview passam a ser aplicados sobre esses bitmaps.
 */

const PALETTES = [
  ["#0F172A","#1E293B"],
  ["#6D28D9","#5B21B6"],
  ["#5B21B6","#6D28D9"],
  ["#1E293B","#334155"],
  ["#6D28D9","#4C1D95"],
  ["#0F172A","#312E81"],
];

function esc(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : c === "'"
            ? "&#39;"
            : "&quot;",
  );
}

export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const variant = Math.max(1, Math.min(6, Number(p.get("v") || 1)));
  const caption = (p.get("c") || "").slice(0, 24).toUpperCase();
  const name = (p.get("n") || "Candidato").slice(0, 28);
  const watermarked = p.get("wm") !== "0";

  const size = watermarked ? 256 : 512;
  const [c1, c2] = PALETTES[variant - 1];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const wm = watermarked
    ? `<defs>
         <pattern id="wm" width="140" height="140" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
           <text x="0" y="70" font-family="Poppins, Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#ffffff" fill-opacity="0.28">PRÉVIA</text>
         </pattern>
       </defs>`
    : "";

  const captionBlock = caption
    ? `<g>
         <rect x="26" y="392" width="460" height="82" rx="20" fill="#ffffff"/>
         <text x="256" y="446" text-anchor="middle" font-family="Poppins, Inter, system-ui, sans-serif" font-size="42" font-weight="800" fill="#0F172A">${esc(
           caption,
         )}</text>
       </g>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    ${wm}
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}"/>
        <stop offset="1" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="72" fill="url(#bg)"/>
    <circle cx="256" cy="212" r="120" fill="#ffffff" fill-opacity="0.16"/>
    <circle cx="256" cy="196" r="84" fill="#ffffff"/>
    <text x="256" y="228" text-anchor="middle" font-family="Poppins, Inter, system-ui, sans-serif" font-size="72" font-weight="800" fill="${c2}">${esc(
      initials || "★",
    )}</text>
    <path d="M124 372c0-72 59-118 132-118s132 46 132 118v18H124z" fill="#ffffff"/>
    ${captionBlock}
    ${watermarked ? `<rect width="512" height="512" rx="72" fill="url(#wm)"/>` : ""}
  </svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
