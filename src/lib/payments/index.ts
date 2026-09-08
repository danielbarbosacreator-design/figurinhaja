/**
 * Interface desacoplada de gateway de pagamento (blocos 10 e 22 do briefing).
 *
 * Fase 1: implementação `mock` (checkout interno + botão "simular aprovação").
 * Fase 4: implementação `mercadopago` (PIX + cartão, checkout hospedado, webhook).
 *
 * Regras invioláveis:
 *  - dados sensíveis de cartão NUNCA passam pelo nosso backend;
 *  - o status PAID só é definido por webhook verificado no servidor;
 *  - o frontend nunca decide que algo foi pago.
 */
import type { Order } from "@/types";
import { mockGateway } from "./mock";

export interface CreateCheckoutInput {
  order: Order;
  description: string;
  /** Para onde o gateway redireciona o navegador após o pagamento. */
  returnUrl: string;
}

export interface CreateCheckoutResult {
  /** URL para enviar o usuário (checkout hospedado do gateway, ou nosso mock). */
  checkoutUrl: string;
  providerPaymentId: string | null;
}

export interface WebhookVerifyInput {
  provider: string;
  headers: Headers;
  rawBody: string;
}

export interface WebhookEvent {
  /** id do pagamento no gateway */
  providerPaymentId: string;
  /** nosso orderId, quando o gateway devolve na referência externa */
  orderId: string | null;
  status: "approved" | "rejected" | "pending" | "refunded" | "expired";
  method?: "pix" | "card" | null;
}

export interface PaymentGateway {
  name: string;
  createCheckout: (input: CreateCheckoutInput) => Promise<CreateCheckoutResult>;
  /**
   * Valida a assinatura do webhook e normaliza o payload.
   * Retorna null se a requisição não for legítima.
   */
  verifyWebhook: (input: WebhookVerifyInput) => Promise<WebhookEvent | null>;
}

function selectGateway(): PaymentGateway {
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";
  switch (provider) {
    case "mercadopago":
      throw new Error(
        "PAYMENT_PROVIDER=mercadopago ainda não implementado (Fase 4).",
      );
    case "mock":
    default:
      return mockGateway;
  }
}

export const paymentGateway: PaymentGateway = selectGateway();
