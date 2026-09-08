/**
 * Modelo de dados do MVP (bloco 16 do briefing).
 *
 * Na Fase 1 estas entidades vivem em memória (src/lib/db/memory.ts).
 * Na Fase 2 viram tabelas no Postgres/Supabase com o mesmo formato.
 */

export type FlowType = "candidate_pack" | "user_candidate_pack" | "user_photo";

export type GenerationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type OrderStatus = "PENDING" | "PAID" | "CANCELED" | "REFUNDED";

export type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "refunded"
  | "expired";

export type AssetType = "sticker" | "photo";

export interface Session {
  id: string;
  createdAt: string;
  userAgent?: string;
}

export interface CandidateRef {
  id: string;
  name: string;
  isCustom: boolean;
  photoUrl?: string;
}

export interface Generation {
  id: string;
  sessionId: string;
  productType: FlowType;
  productId: string | null;
  candidate: CandidateRef;
  customText: string | null;
  quantity: number;
  status: GenerationStatus;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface Asset {
  id: string;
  generationId: string;
  type: AssetType;
  /** Caminho da prévia protegida (baixa resolução + marca d'água). Sempre público. */
  previewPath: string;
  /** Caminho do arquivo final em alta qualidade. Nunca exposto sem pagamento confirmado. */
  originalPath: string;
  isUnlocked: boolean;
  /** Metadados só para o mock renderizar placeholders variados. */
  meta?: { variant: number; caption: string | null };
}

export interface Product {
  id: string;
  label: string;
  quantity: number;
  priceCents: number;
  recommended?: boolean;
  badge?: string;
}

export interface Order {
  id: string;
  sessionId: string;
  generationId: string;
  productId: string;
  amount: number; // em centavos
  currency: string;
  status: OrderStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string; // "mock" | "mercadopago" | ...
  providerPaymentId: string | null;
  method?: "pix" | "card" | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}
