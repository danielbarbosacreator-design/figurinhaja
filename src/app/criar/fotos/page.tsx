"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepShell } from "@/components/flow/StepShell";
import { Button } from "@/components/ui/Button";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { copy, getFlow } from "@/lib/config";
import { useWizard } from "@/lib/store";
import { useFlowGuard } from "@/lib/useFlow";

const TIPS = [
  "Use uma foto nítida e bem iluminada",
  "Rosto visível e de frente",
  "Evite filtros muito fortes",
];

export default function FotosPage() {
  const router = useRouter();
  const { ready } = useFlowGuard(["flowType", "candidate"]);
  const { flowType, userPhoto, setUserPhoto } = useWizard();

  const needsUserPhoto = flowType ? getFlow(flowType).needsUserPhoto : true;

  useEffect(() => {
    if (ready && flowType && !needsUserPhoto) {
      router.replace("/criar/personalizar");
    }
  }, [ready, flowType, needsUserPhoto, router]);

  if (!ready || !flowType || !needsUserPhoto) {
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

  return (
    <StepShell
      step={3}
      title={copy.fotos.userTitle}
      subtitle={copy.fotos.userHint}
      footer={
        <Button
          disabled={!userPhoto}
          onClick={() => router.push("/criar/personalizar")}
        >
          CONTINUAR →
        </Button>
      }
    >
      <PhotoPicker
        label={copy.fotos.userTitle}
        hint={copy.fotos.userHint}
        value={userPhoto}
        onChange={setUserPhoto}
        analyticsSlot="user"
      />

      {/* Card de dicas */}
      <div
        style={{
          marginTop: "20px",
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          background: "#fff",
          padding: "16px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#334155",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              background: "#6D28D9",
              color: "#fff",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            i
          </span>
          Dicas para um melhor resultado
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {TIPS.map((tip) => (
            <li
              key={tip}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: "#334155",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#DCFCE7",
                  color: "#16A34A",
                  fontSize: "10px",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <p
        style={{
          marginTop: "14px",
          fontSize: "12px",
          color: "#94A3B8",
          textAlign: "center",
        }}
      >
        {copy.trust.photoUse}
      </p>
    </StepShell>
  );
}
