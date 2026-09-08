"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepShell } from "@/components/flow/StepShell";
import { Button } from "@/components/ui/Button";
import { copy, getFlow, getPacks } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { useWizard } from "@/lib/store";
import { useFlowGuard } from "@/lib/useFlow";
import { track } from "@/lib/analytics";

export default function QuantidadePage() {
  const router = useRouter();
  const { ready } = useFlowGuard(["flowType", "candidate"]);
  const { flowType, productId, setProductId } = useWizard();
  const packs = getPacks().slice(0, 3);

  const usesPacks = flowType ? getFlow(flowType).usesPacks : true;
  const flow = flowType ? getFlow(flowType) : null;
  const currentStep = flow?.needsUserPhoto ? 5 : 4;
  const totalSteps = currentStep;

  useEffect(() => {
    if (ready && flowType && !usesPacks) router.replace("/criar/gerando");
  }, [ready, flowType, usesPacks, router]);

  useEffect(() => {
    // pré-seleciona o recomendado
    if (ready && usesPacks && !productId) {
      const rec = packs.find((p) => p.recommended) ?? packs[0];
      if (rec) setProductId(rec.id);
    }
  }, [ready, usesPacks, productId, packs, setProductId]);

  if (!ready || !flowType || !usesPacks) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          color: "#64748B",
        }}
      >
        Carregando...
      </div>
    );
  }

  function goGenerate() {
    track("generation_started", { productId });
    router.push("/criar/gerando");
  }

  return (
    <StepShell
      step={currentStep}
      totalSteps={totalSteps}
      title={copy.quantidade.title}
      subtitle="Escolha o tamanho do seu pack. Você vê a prévia de todas antes de pagar."
      footer={
        <Button disabled={!productId} onClick={goGenerate}>
          {copy.quantidade.cta} →
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {packs.map((p) => {
          const isSelected = productId === p.id;
          const unitPrice = (p.priceCents / p.quantity / 100)
            .toFixed(2)
            .replace(".", ",");

          return (
            <div
              key={p.id}
              onClick={() => setProductId(p.id)}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px",
                borderRadius: "16px",
                background: isSelected ? "#ffffff" : "#ffffff",
                border: isSelected ? "2px solid #6D28D9" : "2px solid #E2E8F0",
                boxShadow: isSelected
                  ? "0 4px 14px rgba(109,40,217, 0.12)"
                  : "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {/* Badge no topo se for recomendado ou maior */}
              {p.recommended && (
                <div
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "16px",
                    background: "#6D28D9",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.2px",
                    padding: "2px 10px",
                    borderRadius: "12px",
                    textTransform: "uppercase",
                    boxShadow: "0 2px 6px rgba(109,40,217, 0.3)",
                  }}
                >
                  {p.badge ?? "Mais escolhido"}
                </div>
              )}

              {p.quantity === 20 && !p.recommended && (
                <div
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "16px",
                    background: "#0F172A",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.2px",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    textTransform: "uppercase",
                  }}
                >
                  Melhor valor
                </div>
              )}

              {/* Lado esquerdo: ícone/quantidade */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "12px",
                    background: isSelected ? "#F5F3FF" : "#F1F5F9",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 900,
                      color: isSelected ? "#6D28D9" : "#0F172A",
                      lineHeight: 1,
                    }}
                  >
                    {p.quantity}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      color: "#64748B",
                      textTransform: "uppercase",
                      marginTop: "1px",
                    }}
                  >
                    figuras
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "16px",
                      color: "#0F172A",
                    }}
                  >
                    {p.label}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748B",
                      marginTop: "2px",
                      fontWeight: 500,
                    }}
                  >
                    Apenas R$ {unitPrice} por figurinha
                  </div>
                </div>
              </div>

              {/* Lado direito: preço e seletor */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "right",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 900,
                      color: isSelected ? "#6D28D9" : "#0F172A",
                    }}
                  >
                    {formatBRL(p.priceCents)}
                  </div>
                </div>

                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: isSelected
                      ? "6px solid #6D28D9"
                      : "2px solid #CBD5E1",
                    background: "#ffffff",
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Segurança */}
      <div
        style={{
          marginTop: "24px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "14px 16px",
          border: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "22px" }}>🔒</span>
        <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.4 }}>
          <strong style={{ color: "#0F172A", display: "block" }}>
            Satisfação garantida
          </strong>
          Você visualiza todas as figurinhas geradas antes de decidir pagar.
        </div>
      </div>
    </StepShell>
  );
}
