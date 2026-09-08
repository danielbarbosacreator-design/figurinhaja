"use client";

import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/ui/AppHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * Moldura comum de todas as telas do fluxo:
 *  - Header compacto com logo + "X de Y"
 *  - Barra de progresso vermelha fina
 *  - Botão voltar discreto
 *  - Título forte + instrução curta
 *  - Área de conteúdo com scroll
 *  - Rodapé fixo com o CTA principal
 */
export function StepShell({
  step,
  totalSteps = 4,
  title,
  subtitle,
  children,
  footer,
  onBack,
}: {
  step?: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: "100dvh",
        paddingBottom: "8px",
        background: "#F8FAFC",
      }}
    >
      {/* ── Header ── */}
      <AppHeader step={step} total={totalSteps} />

      {/* ── Barra de progresso ── */}
      {step ? (
        <div style={{ paddingTop: "10px", paddingBottom: "2px" }}>
          <ProgressBar step={step} total={totalSteps} />
        </div>
      ) : null}

      {/* ── Voltar ── */}
      <div style={{ paddingTop: "10px" }}>
        <button
          onClick={() => (onBack ? onBack() : router.back())}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "#64748B",
            fontWeight: 600,
            fontSize: "14px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "0",
            marginLeft: "-2px",
          }}
          aria-label="Voltar"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14l-5-5 5-5" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Voltar
        </button>
      </div>

      {/* ── Título e subtítulo ── */}
      <div style={{ paddingTop: "14px", paddingBottom: "4px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 900,
            letterSpacing: "-0.5px",
            lineHeight: 1.25,
            color: "#0F172A",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              marginTop: "6px",
              color: "#64748B",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, paddingTop: "18px" }}>{children}</div>

      {/* ── Rodapé fixo ── */}
      {footer ? (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background:
              "linear-gradient(to top, #F8FAFC 80%, transparent 100%)",
            paddingTop: "16px",
            paddingBottom: "16px",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
