"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { StepShell } from "@/components/flow/StepShell";
import { Button } from "@/components/ui/Button";
import { getFlows } from "@/lib/config";
import { useWizard } from "@/lib/store";
import { useMounted } from "@/lib/useFlow";
import { track } from "@/lib/analytics";
import type { FlowType } from "@/types";

const MEDIA: Record<
  FlowType,
  { src: string; color: string; icon: string; fit: "cover" | "contain" }
> = {
  candidate_pack: {
    src: "/Img/Figurinhas/Figurinhas%20do%20candidato%20%28Lula%29.png",
    color: "#F5F3FF",
    icon: "🏷️",
    fit: "contain",
  },
  user_candidate_pack: {
    src: "/Img/Figurinhas/Voc%C3%AA%20%2B%20candidato.png",
    color: "#F5F3FF",
    icon: "🤝",
    fit: "contain",
  },
  user_photo: {
    src: "/Img/Figurinhas/Foto%20ia%20personalizada.png",
    color: "#F5F3FF",
    icon: "📸",
    fit: "cover",
  },
};

export default function ProdutoPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { flowType, setFlowType } = useWizard();
  const flows = getFlows();

  function pick(f: FlowType) {
    setFlowType(f);
    track("product_selected", { flow: f });
  }

  return (
    <StepShell
      step={1}
      title="O que você quer criar?"
      subtitle="Escolha uma opção abaixo."
      onBack={() => router.push("/")}
      footer={
        <Button
          disabled={!mounted || !flowType}
          onClick={() => router.push("/criar/candidato")}
        >
          CONTINUAR →
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {(Object.keys(flows) as FlowType[]).map((key) => {
          const { src, color, icon, fit } = MEDIA[key];
          const isSelected = mounted && flowType === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              aria-pressed={isSelected}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                width: "100%",
                textAlign: "left",
                borderRadius: "16px",
                border: isSelected ? "2px solid #6D28D9" : "2px solid #E2E8F0",
                padding: "0",
                overflow: "hidden",
                background: isSelected ? "#F5F3FF" : "#fff",
                boxShadow: isSelected
                  ? "0 0 0 3px rgba(109,40,217,0.12), 0 2px 8px rgba(0,0,0,0.06)"
                  : "0 1px 4px rgba(0,0,0,0.05)",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}
            >
              {/* Imagem de preview */}
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  flexShrink: 0,
                  background: color,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <Image
                  src={src}
                  alt={flows[key].title}
                  width={100}
                  height={100}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: fit,
                    display: "block",
                  }}
                />
              </div>

              {/* Texto */}
              <div style={{ flex: 1, padding: "14px 0 14px 2px", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                    color: "#0F172A",
                    lineHeight: 1.25,
                  }}
                >
                  {icon} {flows[key].title}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#64748B",
                    marginTop: "4px",
                    lineHeight: 1.4,
                  }}
                >
                  {flows[key].subtitle}
                </div>
              </div>

              {/* Check */}
              <div style={{ paddingRight: "14px", flexShrink: 0 }}>
                <span
                  aria-hidden
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    border: isSelected ? "2px solid #6D28D9" : "2px solid #CBD5E1",
                    background: isSelected ? "#6D28D9" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: isSelected ? "#fff" : "transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  ✓
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
