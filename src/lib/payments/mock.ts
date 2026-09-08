/**
 * Gateway mock.
 *
 * createCheckout devolve uma URL interna (/criar/checkout) onde o usuário
 * pode "simular pagamento aprovado/recusado". Esse botão chama
 * /api/webhook/mock, que é o único caminho que marca o pedido como PAID —
 * exatamente como um webhook real faria.
 */
import type {
  PaymentGateway,
  CreateCheckoutInput,
  CreateCheckoutResult,
  WebhookVerifyInput,
  WebhookEvent,
} from "./index";

const MOCK_SECRET = process.env.MOCK_WEBHOOK_SECRET ?? "dev-mock-secret";

export const mockGateway: PaymentGateway = {
  name: "mock",

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerPaymentId = `mock_${input.order.id}`;
    // O checkout "hospedado" é a nossa própria página de teste.
    const checkoutUrl = `/criar/checkout?order=${encodeURIComponent(
      input.order.id,
    )}`;
    return { checkoutUrl, providerPaymentId };
  },

  async verifyWebhook(input: WebhookVerifyInput): Promise<WebhookEvent | null> {
    let body: {
      secret?: string;
      orderId?: string;
      providerPaymentId?: string;
      status?: WebhookEvent["status"];
      method?: "pix" | "card";
    };
    try {
      body = JSON.parse(input.rawBody);
    } catch {
      return null;
    }
    // "assinatura" do mock: um segredo compartilhado no corpo.
    if (body.secret !== MOCK_SECRET) return null;
    if (!body.orderId || !body.status) return null;

    return {
      providerPaymentId: body.providerPaymentId ?? `mock_${body.orderId}`,
      orderId: body.orderId,
      status: body.status,
      method: body.method ?? "pix",
    };
  },
};
