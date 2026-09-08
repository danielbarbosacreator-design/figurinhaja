"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepShell } from "@/components/flow/StepShell";
import { Button } from "@/components/ui/Button";
import { copy, getFlow } from "@/lib/config";
import { useWizard } from "@/lib/store";
import { useFlowGuard } from "@/lib/useFlow";
import { track } from "@/lib/analytics";

const MAX = copy.personalizar.maxLength;

export default function PersonalizarPage() {
  const router = useRouter();
  const { ready } = useFlowGuard(["flowType", "candidate"]);
  const { flowType, wantsCustomText, customText, setCustomText } = useWizard();

  const [mode, setMode] = useState<"auto" | "manual" | null>(
    wantsCustomText === null ? null : wantsCustomText ? "manual" : "auto",
  );
  const [text, setText] = useState(customText ?? "");

  if (!ready || !flowType) {
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

  const flow = getFlow(flowType);
  const currentStep = flow.needsUserPhoto ? 4 : 3;
  const totalSteps =
    2 + (flow.needsUserPhoto ? 1 : 0) + 1 + (flow.usesPacks ? 1 : 0);
  const canContinue = mode === "auto" || mode === "manual";

  function choose(m: "auto" | "manual") {
    setMode(m);
    track("customization_selected", { mode: m });
  }

  function goNext() {
    const wants = mode === "manual";
    setCustomText(wants, wants ? text.trim() : null);
    router.push(
      flow.usesPacks ? "/criar/quantidade" : "/criar/gerando",
    );
  }

  return (
    <StepShell
      step={currentStep}
      totalSteps={totalSteps}
      title={copy.personalizar.title}
      subtitle={copy.personalizar.explain}
      footer={
        <Button disabled={!canContinue} onClick={goNext}>
          {copy.personalizar.cta} →
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Opção Automática */}
        <div
          onClick={() => choose("auto")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "16px",
            borderRadius: "16px",
            background: "#ffffff",
            border: mode === "auto" ? "2px solid #6D28D9" : "2px solid #E2E8F0",
            boxShadow:
              mode === "auto"
                ? "0 4px 14px rgba(109,40,217, 0.12)"
                : "0 1px 3px rgba(0,0,0,0.05)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: mode === "auto" ? "#F5F3FF" : "#F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              flexShrink: 0,
            }}
          >
            ✨
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "15px",
                  color: "#0F172A",
                }}
              >
                {copy.personalizar.optionAuto}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#6D28D9",
                  background: "#F5F3FF",
                  padding: "2px 8px",
                  borderRadius: "999px",
                }}
              >
                Recomendado
              </span>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "#64748B",
                margin: "3px 0 0",
                lineHeight: 1.4,
              }}
            >
              Nossa inteligência cria frases criativas e divertidas de apoio.
            </p>
          </div>
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border:
                mode === "auto" ? "6px solid #6D28D9" : "2px solid #CBD5E1",
              background: "#ffffff",
              flexShrink: 0,
            }}
          />
        </div>

        {/* Opção Manual */}
        <div
          onClick={() => choose("manual")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "16px",
            borderRadius: "16px",
            background: "#ffffff",
            border:
              mode === "manual" ? "2px solid #6D28D9" : "2px solid #E2E8F0",
            boxShadow:
              mode === "manual"
                ? "0 4px 14px rgba(109,40,217, 0.12)"
                : "0 1px 3px rgba(0,0,0,0.05)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: mode === "manual" ? "#F5F3FF" : "#F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              flexShrink: 0,
            }}
          >
            ✍️
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: "15px",
                color: "#0F172A",
              }}
            >
              {copy.personalizar.optionManual}
            </span>
            <p
              style={{
                fontSize: "13px",
                color: "#64748B",
                margin: "3px 0 0",
                lineHeight: 1.4,
              }}
            >
              Coloque seu nome, bordão ou frase de apoio personalizada.
            </p>
          </div>
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border:
                mode === "manual" ? "6px solid #6D28D9" : "2px solid #CBD5E1",
              background: "#ffffff",
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Caixa de texto personalizada quando "manual" */}
      {mode === "manual" && (
        <div
          style={{
            marginTop: "16px",
            background: "#ffffff",
            borderRadius: "16px",
            padding: "16px",
            border: "1.5px solid #E2E8F0",
          }}
        >
          <label style={{ display: "block" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                {copy.personalizar.fieldLabel}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: text.length >= MAX ? "#6D28D9" : "#94A3B8",
                }}
              >
                {text.length}/{MAX}
              </span>
            </div>

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              placeholder="Ex.: Tamo Junto, É Nóis, Maria com Candidato"
              style={{
                width: "100%",
                borderRadius: "12px",
                border: "2px solid #E2E8F0",
                background: "#F8FAFC",
                padding: "12px 14px",
                fontSize: "15px",
                fontWeight: 600,
                color: "#0F172A",
                outline: "none",
                transition: "border-color 0.15s ease",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#6D28D9")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
              autoFocus
            />
          </label>

          {/* Exemplos de frases rápidas */}
          <div style={{ marginTop: "12px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748B",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Ideias rápidas (clique para usar):
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {copy.personalizar.examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setText(ex.slice(0, MAX))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1.5px solid #E2E8F0",
                    background: text === ex ? "#F5F3FF" : "#F1F5F9",
                    color: text === ex ? "#6D28D9" : "#334155",
                    borderColor: text === ex ? "#6D28D9" : "#E2E8F0",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  + {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </StepShell>
  );
}
