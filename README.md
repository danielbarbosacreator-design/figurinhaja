# App Figurinhas

Gerador simples de figurinhas e imagens personalizadas com políticos/candidatos.
Mobile-first, uma tela = uma decisão, pronto para tráfego pago.

## Rodar (Fase 1 — fluxo completo com mocks)

```bash
npm install
cp .env.example .env.local   # nada precisa ser preenchido na Fase 1
npm run dev
```

Abra http://localhost:3000 no modo responsivo do navegador (375 / 390 / 430 px).

Fluxo navegável de ponta a ponta, sem nenhuma credencial:

Home → Produto → Candidato → Fotos → Personalização → Quantidade →
Gerando → Preview (com marca d'água + cadeado) → Checkout (simular
aprovação) → Aprovado → Baixar → Criar novamente

O webhook mock é o **único** caminho que marca o pedido como pago — igual ao real.

## Arquitetura

- **Next.js (App Router) + TypeScript + Tailwind**. Uma rota por tela em `src/app/criar/*`.
- **Estado do wizard**: Zustand + `sessionStorage` (`src/lib/store.ts`) — sobrevive a F5.
- **Config administrável** em `/config/*.json` (candidatos, produtos, preços, textos) — bloco 18.
- **Integrações desacopladas** com interface + `mock` + implementação real:
  - `src/lib/generation/` — geração de imagem (mock → Google Gemini)
  - `src/lib/payments/` — gateway (mock → Mercado Pago)
  - `src/lib/storage/` — armazenamento privado (mock → Supabase Storage)
  Troca por env: `GENERATION_PROVIDER`, `PAYMENT_PROVIDER`, `STORAGE_PROVIDER`.
- **"Banco" da Fase 1**: em memória (`src/lib/db/memory.ts`), some ao reiniciar o `dev`.
- **Regra de ouro**: `status = PAID` só é definido pelo webhook verificado no servidor
  (`src/app/api/webhook/[provider]/route.ts`). O frontend nunca libera arquivo.
  Download passa por `src/app/api/download/[assetId]` que checa o pedido.

## Roadmap de integração (depois do fluxo aprovado)

| Fase | O que conectar | Env |
|------|----------------|-----|
| 2 | Postgres + Supabase Storage privado + URLs assinadas | `DATABASE_URL`, `SUPABASE_*`, `STORAGE_BUCKET` |
| 3 | Geração real (Google Gemini 2.5 Flash Image) | `GENERATION_PROVIDER=gemini`, `GEMINI_API_KEY` |
| 4 | Mercado Pago (PIX + cartão) + webhook | `PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_*` |
| 5 | Meta Pixel + Conversions API (`Purchase` só no servidor) | `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TOKEN` |

## Analytics

Eventos de funil em `src/lib/analytics.ts` (bloco 17). Na Fase 1 saem no console.
`payment_approved` / `Purchase` são disparados **pelo servidor**, no webhook — nunca
ao abrir a página de obrigado.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build && npm start` — produção
- `npm run lint` — ESLint
- `node scripts/gen-samples.mjs` — regenera os SVGs de exemplo em `public/samples`
