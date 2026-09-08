"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StepShell } from "@/components/flow/StepShell";
import { Button } from "@/components/ui/Button";
import { copy, getProductById } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { useWizard } from "@/lib/store";
import { useMounted } from "@/lib/useFlow";
import { usePoll } from "@/lib/usePoll";

const MOCK_SECRET =
  process.env.NEXT_PUBLIC_MOCK_WEBHOOK_SECRET ?? "dev-mock-secret";

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const mounted = useMounted();
  const { orderId: storeOrderId, generationId, productId } = useWizard();
  const orderId = params.get("order") || storeOrderId;

  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [state, setState] = useState<"idle" | "waiting" | "rejected">("idle");

  const product = getProductById(productId);

  useEffect(() => {
    if (mounted && !orderId) router.replace("/criar/preview");
  }, [mounted, orderId, router]);

  usePoll(
    async () => {
      if (!orderId) return true;
      const r = await fetch(`/api/order/${orderId}`);
      if (!r.ok) return false;
      const d = await r.json();
      setAmount(d.amount);
      if (d.status === "PAID") {
        router.replace("/criar/aprovado");
        return true;
      }
      return false;
    },
    { intervalMs: 1500, enabled: mounted && !!orderId },
  );

  async function fireWebhook(status: "approved" | "rejected") {
    if (!orderId) return;
    await fetch("/api/webhook/mock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: MOCK_SECRET, orderId, status, method }),
    });
  }

  function simulateApprove() {
    setState("waiting");
    setTimeout(() => fireWebhook("approved"), 1200);
  }

  async function simulateReject() {
    await fireWebhook("rejected");
    setState("rejected");
  }

  if (!mounted) return null;

  return (
    <StepShell
      title="Finalize sua compra"
      subtitle="Ambiente seguro. A liberação do seu arquivo é instantânea."
      onBack={() => router.push("/criar/preview")}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {state === "waiting" ? (
            <div
              style={{
                textAlign: "center",
                fontWeight: 700,
                color: "#64748B",
                padding: "12px",
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #E2E8F0",
              }}
            >
              ⏳ Processando pagamento... aguarde a confirmação
            </div>
          ) : (
            <>
              <Button onClick={simulateApprove}>
                PAGAR AGORA {amount ? `(${formatBRL(amount)})` : ""} →
              </Button>
              <button
                type="button"
                onClick={simulateReject}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "6px",
                }}
              >
                [Simular falha / recusa no pagamento]
              </button>
            </>
          )}

          {/* Selos de segurança */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748B",
            }}
          >
            <span>🔒 Criptografia SSL 256-bit</span>
            <span>⚡ Liberação automática</span>
          </div>
        </div>
      }
    >
      {/* Resumo visual do pedido */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "18px",
          padding: "16px 18px",
          border: "1.5px solid #E2E8F0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#64748B",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "8px",
          }}
        >
          Resumo do pedido
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 800,
                color: "#0F172A",
              }}
            >
              {product?.label ?? "Pack Personalizado"}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#15803D",
                fontWeight: 600,
                marginTop: "2px",
              }}
            >
              ✓ Download em alta resolução sem marca
            </div>
          </div>

          <div
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#6D28D9",
            }}
          >
            {amount ? formatBRL(amount) : product ? formatBRL(product.priceCents) : ""}
          </div>
        </div>
      </div>

      {/* Aviso de mock/ambiente de teste */}
      <div
        style={{
          borderRadius: "14px",
          background: "#F5F3FF",
          border: "1px solid #DDD6FE",
          padding: "10px 14px",
          fontSize: "12px",
          fontWeight: 600,
          color: "#5B21B6",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <span>💡</span>
        <span>{copy.checkout.mockNote}</span>
      </div>

      {/* Escolha do método de pagamento */}
      <div style={{ marginBottom: "16px" }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#334155",
            display: "block",
            marginBottom: "8px",
          }}
        >
          Forma de pagamento:
        </span>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {([
            { id: "pix", label: "PIX", badge: "Aprovação imediata", icon: "⚡" },
            { id: "card", label: "Cartão", badge: "Até 12x", icon: "💳" },
          ] as const).map((m) => {
            const isSelected = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                style={{
                  borderRadius: "14px",
                  border: isSelected
                    ? "2px solid #6D28D9"
                    : "1.5px solid #E2E8F0",
                  background: isSelected ? "#F5F3FF" : "#ffffff",
                  padding: "14px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected
                    ? "0 2px 8px rgba(109,40,217, 0.12)"
                    : "none",
                }}
              >
                <span style={{ fontSize: "20px" }}>{m.icon}</span>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: isSelected ? "#6D28D9" : "#0F172A",
                  }}
                >
                  {m.label}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: isSelected ? "#5B21B6" : "#64748B",
                  }}
                >
                  {m.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhes do método selecionado */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1.5px solid #E2E8F0",
          padding: "16px",
        }}
      >
        {method === "pix" ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "18px" }}>📱</span>
              <strong style={{ fontSize: "14px", color: "#0F172A" }}>
                Pagamento via PIX
              </strong>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "#64748B",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Ao clicar em <strong>Pagar Agora</strong>, o código PIX é
              processado e a liberação das suas fotos acontece automaticamente em
              poucos segundos.
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "18px" }}>🔒</span>
              <strong style={{ fontSize: "14px", color: "#0F172A" }}>
                Cartão de Crédito
              </strong>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "#64748B",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Transação criptografada de ponta a ponta através do gateway
              seguro. Seus dados nunca passam pelo nosso servidor.
            </p>
          </div>
        )}
      </div>

      {state === "rejected" && (
        <div
          style={{
            marginTop: "16px",
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "12px",
            padding: "12px 14px",
            color: "#b91c1c",
            fontSize: "13px",
            fontWeight: 700,
          }}
          role="alert"
        >
          ⚠️ {copy.errors.paymentRejected}
        </div>
      )}

      {generationId && (
        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            fontSize: "12px",
            color: "#94A3B8",
          }}
        >
          Seus arquivos permanecem salvos em segurança durante o processo.
        </p>
      )}
    </StepShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
