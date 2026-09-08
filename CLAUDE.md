# App Figurinhas — notas para o agente

Gerador mobile-first de figurinhas/imagens com políticos. Briefing completo em 22
blocos; princípio central: **uma tela = uma decisão**, simples para público 19–60+.

## Estado atual: Fase 1 (fluxo completo com mocks)

- Fluxo navegável ponta a ponta sem credenciais. `USE`/provider envs = `mock`.
- "Banco" em memória (`src/lib/db/memory.ts`) — some ao reiniciar o `dev`.
- Telas em `src/app/criar/*` (uma rota por tela). Estado do wizard: `src/lib/store.ts`
  (Zustand + sessionStorage, sobrevive a F5).
- Config administrável (candidatos, produtos, preços, textos): `/config/*.json`.

## Regras que não podem ser quebradas

- `Order.status = PAID` **só** no webhook verificado no servidor
  (`src/app/api/webhook/[provider]/route.ts`). Frontend nunca libera arquivo.
- Download passa por `src/app/api/download/[assetId]` que checa o pedido PAID.
- Preço/quantidade sempre da config do servidor, nunca do corpo do cliente.
- `payment_approved` / Meta `Purchase` só disparam no servidor após confirmação.
- Nada de: contadores falsos, urgência falsa, depoimentos inventados (bloco 13).

## Próximas fases (só depois do fluxo visual aprovado)

2. Supabase: Postgres + Storage privado + URLs assinadas — trocar `src/lib/db` e
   `src/lib/storage/supabase.ts`, `STORAGE_PROVIDER=supabase`.
3. Geração real: `src/lib/generation/gemini.ts`, `GENERATION_PROVIDER=gemini`.
4. Mercado Pago: `src/lib/payments/mercadopago.ts` (createCheckout + verifyWebhook
   com assinatura real), `PAYMENT_PROVIDER=mercadopago`.
5. Meta Pixel client + Conversions API server-side.

## Comandos

`npm run dev` · `npm run build` · `npm run lint` · `node scripts/gen-samples.mjs`

## Ambiente

O projeto vive em volume não-nativo do macOS → arquivos `._*` (AppleDouble) surgem
sozinhos. Estão no `.gitignore` e ignorados no ESLint. Pode apagar com
`find . -name '._*' -not -path './node_modules/*' -delete`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
