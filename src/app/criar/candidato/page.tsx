"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { StepShell } from "@/components/flow/StepShell";
import { Button } from "@/components/ui/Button";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import {
  copy,
  getFeaturedCandidates,
  allowsCustomCandidate,
  getCustomCandidateLabel,
  getFlow,
} from "@/lib/config";
import { useWizard } from "@/lib/store";
import { useFlowGuard } from "@/lib/useFlow";
import { track } from "@/lib/analytics";

const CUSTOM = "__custom__";

export default function CandidatoPage() {
  const router = useRouter();
  const { ready } = useFlowGuard(["flowType"]);
  const {
    flowType,
    candidate,
    candidatePhoto,
    setCandidate,
    setCandidatePhoto,
  } = useWizard();

  const featured = getFeaturedCandidates();
  const [selectedId, setSelectedId] = useState<string | null>(
    candidate?.isCustom ? CUSTOM : (candidate?.id ?? null),
  );
  const [customName, setCustomName] = useState(
    candidate?.isCustom ? candidate.name : "",
  );

  if (!ready || !flowType) return <Loading />;

  const isCustom = selectedId === CUSTOM;
  const canContinue = isCustom
    ? Boolean(candidatePhoto)
    : Boolean(selectedId);

  function pickFeatured(id: string, name: string, photo: string) {
    setSelectedId(id);
    setCandidate({ id, name, isCustom: false, photoUrl: photo });
    setCandidatePhoto(null);
    track("candidate_selected", { candidate: id });
  }

  function pickCustom() {
    setSelectedId(CUSTOM);
    track("candidate_selected", { candidate: "custom" });
  }

  function goNext() {
    if (isCustom) {
      setCandidate({
        id: "custom",
        name: customName.trim() || "meu candidato",
        isCustom: true,
      });
    }
    router.push(
      getFlow(flowType!).needsUserPhoto
        ? "/criar/fotos"
        : "/criar/personalizar",
    );
  }

  return (
    <StepShell
      step={2}
      title={copy.candidato.title}
      subtitle="Selecione uma opção abaixo."
      footer={
        <Button disabled={!canContinue} onClick={goNext}>
          CONTINUAR →
        </Button>
      }
    >
      {/* Grid 2x2 de candidatos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: isCustom ? "20px" : "0",
        }}
      >
        {featured.map((c) => {
          const isSelected = selectedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pickFeatured(c.id, c.name, c.photo)}
              aria-pressed={isSelected}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                padding: "12px 8px",
                borderRadius: "16px",
                border: isSelected ? "2.5px solid #6D28D9" : "2px solid #E2E8F0",
                background: isSelected ? "#F5F3FF" : "#fff",
                boxShadow: isSelected
                  ? "0 0 0 3px rgba(109,40,217,0.10), 0 2px 8px rgba(0,0,0,0.06)"
                  : "0 1px 4px rgba(0,0,0,0.05)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                position: "relative",
              }}
            >
              {/* Check badge */}
              {isSelected && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#6D28D9",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✓
                </div>
              )}

              {/* Foto do candidato */}
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: isSelected ? "3px solid #6D28D9" : "3px solid #E2E8F0",
                  background: "#F1F5F9",
                  transition: "border-color 0.15s ease",
                }}
              >
                <Image
                  src={c.photo}
                  alt={c.name}
                  width={80}
                  height={80}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              {/* Nome */}
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: isSelected ? "#6D28D9" : "#0F172A",
                  textAlign: "center",
                  lineHeight: 1.2,
                  transition: "color 0.15s ease",
                }}
              >
                {c.name}
              </span>
            </button>
          );
        })}

        {/* Outro candidato */}
        {allowsCustomCandidate() && (
          <button
            type="button"
            onClick={pickCustom}
            aria-pressed={isCustom}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              padding: "12px 8px",
              borderRadius: "16px",
              border: isCustom ? "2.5px solid #6D28D9" : "2px dashed #CBD5E1",
              background: isCustom ? "#F5F3FF" : "#F8FAFC",
              boxShadow: isCustom
                ? "0 0 0 3px rgba(109,40,217,0.10)"
                : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              gridColumn: featured.length % 2 === 0 ? "1 / -1" : "auto",
            }}
          >
            {/* Ícone upload */}
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: isCustom ? "#EDE9FE" : "#F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: isCustom ? "3px solid #6D28D9" : "3px solid #E2E8F0",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 5v10M9 9l5-4 5 4"
                  stroke={isCustom ? "#6D28D9" : "#94A3B8"}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="3"
                  y="19"
                  width="22"
                  height="5"
                  rx="2.5"
                  fill={isCustom ? "#6D28D9" : "#CBD5E1"}
                  opacity="0.4"
                />
              </svg>
            </div>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: isCustom ? "#6D28D9" : "#64748B",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {getCustomCandidateLabel()}
              {"\n"}(Enviar foto)
            </span>
          </button>
        )}
      </div>

      {/* Área de upload do candidato customizado */}
      {isCustom && (
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <p style={{ fontWeight: 700, color: "#0F172A", margin: 0 }}>
            {copy.candidato.customPrompt}
          </p>
          <PhotoPicker
            label="Foto do candidato"
            hint={copy.fotos.candidateHint}
            value={candidatePhoto}
            onChange={setCandidatePhoto}
            analyticsSlot="candidate"
          />
          <label>
            <span
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#64748B",
                marginBottom: "6px",
              }}
            >
              Nome do candidato (opcional)
            </span>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value.slice(0, 40))}
              placeholder="Ex.: João da Silva"
              style={{
                width: "100%",
                borderRadius: "14px",
                border: "2px solid #E2E8F0",
                background: "#fff",
                padding: "12px 16px",
                fontSize: "16px",
                color: "#0F172A",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6D28D9")}
              onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
            />
          </label>
        </div>
      )}
    </StepShell>
  );
}

function Loading() {
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        color: "#64748B",
        fontSize: "15px",
      }}
    >
      Carregando...
    </div>
  );
}
