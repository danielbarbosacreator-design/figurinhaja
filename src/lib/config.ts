/**
 * Loader tipado da configuração administrável (bloco 18 do briefing).
 *
 * Fonte: arquivos JSON em /config. Editáveis sem tocar no código da aplicação.
 * Fase 2: migrar para uma tabela no Supabase mantendo estas mesmas funções.
 */
import candidatesRaw from "../../config/candidates.json";
import productsRaw from "../../config/products.json";
import copyRaw from "../../config/copy.json";
import type { FlowType, Product } from "@/types";

export interface Category {
  id: string;
  label: string;
}

export interface FeaturedCandidate {
  id: string;
  name: string;
  categoryId: string;
  photo: string;
  active: boolean;
}

export interface FlowConfig {
  title: string;
  subtitle: string;
  needsUserPhoto: boolean;
  usesPacks: boolean;
}

export const copy = copyRaw;

export function getCategories(): Category[] {
  return candidatesRaw.categories;
}

export function getFeaturedCandidates(): FeaturedCandidate[] {
  return (candidatesRaw.featured as FeaturedCandidate[]).filter((c) => c.active);
}

export function allowsCustomCandidate(): boolean {
  return candidatesRaw.allowCustomCandidate;
}

export function getCustomCandidateLabel(): string {
  return candidatesRaw.customCandidateLabel;
}

export function getFlows(): Record<FlowType, FlowConfig> {
  return productsRaw.flows as Record<FlowType, FlowConfig>;
}

export function getFlow(flow: FlowType): FlowConfig {
  return getFlows()[flow];
}

export function getPacks(): Product[] {
  return productsRaw.packs as Product[];
}

export function getPhotoProduct(): Product {
  return productsRaw.photo as Product;
}

export function getCurrency(): string {
  return productsRaw.currency;
}

/** Resolve um productId (pack ou foto) para o registro completo do produto. */
export function getProductById(productId: string | null | undefined): Product | null {
  if (!productId) return null;
  if (productsRaw.photo.id === productId) return productsRaw.photo as Product;
  return (productsRaw.packs as Product[]).find((p) => p.id === productId) ?? null;
}

/** Produto padrão de um fluxo: o pack recomendado, ou a foto única. */
export function getDefaultProduct(flow: FlowType): Product {
  if (!getFlow(flow).usesPacks) return getPhotoProduct();
  const packs = getPacks();
  return packs.find((p) => p.recommended) ?? packs[0];
}
