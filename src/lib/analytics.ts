/**
 * Dispatcher de eventos de funil (bloco 17 do briefing).
 *
 * O dispatcher é real; os destinos (sinks) são plugáveis.
 * Fase 1: sink de console apenas.
 * Fase 5: adicionar Meta Pixel (client) + Conversions API (server).
 *
 * REGRA: o evento `payment_approved` e o `Purchase` do Meta só podem ser
 * disparados pelo servidor após confirmação do webhook — NUNCA no load da
 * página de obrigado. Ver src/app/api/webhook/[provider]/route.ts.
 */

export type AnalyticsEvent =
  | "landing_view"
  | "start_clicked"
  | "product_selected"
  | "candidate_selected"
  | "photo_started"
  | "photo_uploaded"
  | "customization_selected"
  | "generation_started"
  | "generation_completed"
  | "preview_viewed"
  | "unlock_clicked"
  | "checkout_started"
  | "payment_approved"
  | "download_clicked"
  | "generate_again_clicked";

type Payload = Record<string, string | number | boolean | null | undefined>;

interface Sink {
  name: string;
  track: (event: AnalyticsEvent, payload?: Payload) => void;
}

const consoleSink: Sink = {
  name: "console",
  track: (event, payload) => {
    if (typeof window !== "undefined") {
      console.log(`[analytics] ${event}`, payload ?? {});
    }
  },
};

/**
 * Meta Pixel sink — só encaminha eventos "padrão" seguros do lado do cliente.
 * `Purchase` fica de fora de propósito: é responsabilidade do servidor.
 */
const metaPixelSink: Sink = {
  name: "meta-pixel",
  track: (event, payload) => {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (!fbq) return;
    const map: Partial<Record<AnalyticsEvent, string>> = {
      landing_view: "ViewContent",
      start_clicked: "Lead",
      preview_viewed: "ViewContent",
      unlock_clicked: "AddToCart",
      checkout_started: "InitiateCheckout",
    };
    const standard = map[event];
    if (standard) fbq("track", standard, payload ?? {});
    else fbq("trackCustom", event, payload ?? {});
  },
};

const sinks: Sink[] = [consoleSink, metaPixelSink];

export function track(event: AnalyticsEvent, payload?: Payload): void {
  for (const sink of sinks) {
    try {
      sink.track(event, payload);
    } catch {
      // um sink com defeito nunca pode quebrar o fluxo do usuário
    }
  }
}
