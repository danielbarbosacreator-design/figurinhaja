/**
 * Gera SVGs de exemplo em /public/samples (avatares de candidatos + vitrine da home).
 * Uso: node scripts/gen-samples.mjs
 * São só placeholders da Fase 1 — no ar, o admin substitui por fotos reais.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples");
mkdirSync(out, { recursive: true });

// Paleta FigurinhaJá — só roxo e navy (identidade neutra, sem cores partidárias)
const PAL = [
  ["#0F172A", "#1E293B"],
  ["#6D28D9", "#5B21B6"],
  ["#5B21B6", "#6D28D9"],
  ["#1E293B", "#334155"],
  ["#6D28D9", "#4C1D95"],
  ["#0F172A", "#312E81"],
];

function avatar([c1, c2], label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <circle cx="128" cy="104" r="48" fill="#fff"/>
  <path d="M56 214c0-40 33-66 72-66s72 26 72 66z" fill="#fff"/>
  <text x="128" y="120" text-anchor="middle" font-family="Poppins, Inter, system-ui, sans-serif" font-size="40" font-weight="800" fill="#0F172A">${label}</text>
</svg>`;
}

for (let i = 1; i <= 4; i++) {
  writeFileSync(join(out, `candidate-${i}.svg`), avatar(PAL[i - 1], `C${i}`));
}

// vitrine da home: 3 "figurinhas" prontas
function showcase([c1, c2], caption) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="320" height="320" rx="44" fill="url(#g)"/>
  <circle cx="160" cy="120" r="56" fill="#fff"/>
  <path d="M74 232c0-48 39-78 86-78s86 30 86 78z" fill="#fff"/>
  <rect x="26" y="242" width="268" height="52" rx="14" fill="#fff"/>
  <text x="160" y="278" text-anchor="middle" font-family="Poppins, Inter, system-ui, sans-serif" font-size="26" font-weight="800" fill="#0F172A">${caption}</text>
</svg>`;
}

["TAMO JUNTO", "É NÓIS", "BRASIL"].forEach((cap, i) => {
  writeFileSync(join(out, `showcase-${i + 1}.svg`), showcase(PAL[i], cap));
});

console.log("Samples gerados em public/samples");
