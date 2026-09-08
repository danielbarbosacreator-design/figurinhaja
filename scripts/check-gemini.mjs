/**
 * Testa se a GEMINI_API_KEY do .env.local é válida.
 * Uso: node scripts/check-gemini.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvLocal() {
  try {
    const txt = readFileSync(join(root, ".env.local"), "utf8");
    const out = {};
    for (const line of txt.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const env = readEnvLocal();
const key = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;

if (!key || key === "COLE_SUA_CHAVE_AQUI") {
  console.error("❌ GEMINI_API_KEY não preenchida no .env.local (linha 5).");
  process.exit(1);
}
if (key.startsWith("gen-lang-client")) {
  console.error(
    `❌ O valor "${key.slice(0, 20)}…" é o ID do PROJETO, não a chave.\n` +
      "   A chave começa com 'AIza' ou 'AQ.'.\n" +
      "   Em aistudio.google.com/apikey copie da coluna 'API key', não da 'Project'.",
  );
  process.exit(1);
}

const model = env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
console.log(`Testando chave (${key.slice(0, 6)}…${key.slice(-3)}, ${key.length} chars) no modelo ${model}…`);

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}`,
  { headers: { "x-goog-api-key": key } },
);
const body = await res.json().catch(() => ({}));

if (res.ok) {
  console.log(`✅ Chave OK. Modelo disponível: ${body.name ?? model}`);
  process.exit(0);
}

console.error(`❌ HTTP ${res.status}: ${body?.error?.message ?? JSON.stringify(body).slice(0, 300)}`);
if (res.status === 429 || /quota/i.test(body?.error?.message ?? "")) {
  console.error("   → Chave válida, mas sem cota. Verifique billing/limites no projeto.");
}
process.exit(1);
