"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/ui/AppHeader";
import { copy, getFlow } from "@/lib/config";
import { useWizard } from "@/lib/store";
import { useMounted } from "@/lib/useFlow";
import { usePoll } from "@/lib/usePoll";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";

type Phase = "starting" | "processing" | "slow" | "failed";

export default function GerandoPage() {
  const router = useRouter();
  const mounted = useMounted();
  const s = useWizard();
  const [phase, setPhase] = useState<Phase>("starting");
  // `done`/`total`: progresso REAL — quantas figurinhas já ficaram prontas.
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  // `displayPercent`: número que aparece na tela, sempre andando suavemente
  // em direção ao alvo real (nunca "congela").
  const [displayPercent, setDisplayPercent] = useState(6);
  const [tipIndex, setTipIndex] = useState(0);
  const startedAt = useRef<number>(0);
  const kickedOff = useRef(false);
  const finishing = useRef(false);
  const doneRef = useRef(0);
  const totalRef = useRef(0);

  const flow = s.flowType ? getFlow(s.flowType) : null;
  const missingBasics =
    mounted &&
    (!s.sessionId ||
      !s.flowType ||
      !s.candidate ||
      (flow!.needsUserPhoto && !s.userPhoto) ||
      (flow!.usesPacks && !s.productId));

  const isPhoto = s.flowType === "user_photo";
  const steps = isPhoto
    ? [
        "Foto e dados recebidos",
        "Identificando candidato e enquadramento",
        "Compondo montagem realista com IA",
        "Finalizando sua foto em alta resolução",
      ]
    : [
        "Fotos e dados recebidos",
        "Processando expressões e enquadramento",
        "Criando figurinhas personalizadas",
        "Aplicando legendas e cortes de sticker",
        "Finalizando seu pack exclusivo",
      ];

  const tips = isPhoto
    ? [
        "Ajustando luz e enquadramento...",
        "Cuidando dos detalhes do rosto...",
        "Deixando tudo com cara de foto de verdade...",
        "Quase lá — dando o acabamento final...",
      ]
    : [
        "Desenhando os traços de cada figurinha...",
        "Caprichando nas expressões...",
        "Recortando no estilo sticker...",
        "Separando as melhores variações...",
        "Quase lá — finalizando o pack...",
      ];

  async function startGeneration() {
    setPhase("starting");
    startedAt.current = Date.now();
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: s.sessionId,
          flowType: s.flowType,
          productId: s.productId,
          candidate: s.candidate,
          customText: s.customText,
          userPhoto: s.userPhoto,
          candidatePhoto: s.candidatePhoto,
        }),
      });
      if (!r.ok) throw new Error("generate");
      const d = await r.json();
      s.setGenerationId(d.generationId);
      s.setProductId(d.productId);
      setPhase("processing");
    } catch {
      setPhase("failed");
    }
  }

  useEffect(() => {
    if (!mounted || kickedOff.current) return;
    if (missingBasics) {
      router.replace("/criar/produto");
      return;
    }
    kickedOff.current = true;
    startedAt.current = Date.now();
    if (s.generationId) {
      setPhase("processing");
    } else {
      startGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  usePoll(
    async () => {
      if (!s.generationId) return false;
      const r = await fetch(`/api/generation/${s.generationId}`);
      if (!r.ok) return false;
      const d = await r.json();

      if (typeof d.quantity === "number" && d.quantity > 0) {
        setTotal(d.quantity);
        totalRef.current = d.quantity;
      }
      if (Array.isArray(d.assets)) {
        setDone(d.assets.length);
        doneRef.current = d.assets.length;
      }

      if (d.status === "completed") {
        finishing.current = true;
        setDone(d.quantity ?? d.assets?.length ?? 0);
        track("generation_completed", {
          generationId: s.generationId,
          quantity: d.quantity,
        });
        setTimeout(() => router.replace("/criar/preview"), 650);
        return true;
      }
      if (d.status === "failed") {
        setPhase("failed");
        return true;
      }
      const elapsed = Date.now() - startedAt.current;
      // Rede de segurança: um pack de 20 com 1 retry fica em ~3-4 min. Depois
      // disso algo travou de verdade — mostra "tentar de novo".
      if (elapsed > 300_000) {
        setPhase("failed");
        return true;
      }
      if (elapsed > 45_000) setPhase("slow");
      return false;
    },
    {
      intervalMs: 1500,
      enabled:
        mounted &&
        !!s.generationId &&
        (phase === "processing" || phase === "slow"),
    },
  );

  const active = phase === "processing" || phase === "slow";

  // Anima o número mostrado em direção a um alvo que só cresce — mistura o
  // progresso concreto (figurinhas prontas) com um piso que sobe com o tempo.
  // Assim a barra anda mesmo ENTRE os lotes da IA: nunca parece travada.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const t = totalRef.current;
      const frac = t > 0 ? Math.min(1, doneRef.current / t) : 0;
      const secs = (Date.now() - startedAt.current) / 1000;
      const goal = finishing.current
        ? 100
        : Math.min(96, Math.max(10 + 86 * frac, Math.min(72, 12 + secs * 1.25)));
      setDisplayPercent((cur) => {
        if (goal - cur < 0.3) return Math.max(cur, goal);
        return cur + Math.max(0.25, (goal - cur) * 0.12);
      });
    }, 50);
    return () => clearInterval(id);
  }, [active]);

  // Frases curtas que vão trocando — reforça que algo está acontecendo.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(
      () => setTipIndex((i) => (i + 1) % tips.length),
      2600,
    );
    return () => clearInterval(id);
  }, [active, tips.length]);

  const progressPercent = Math.round(displayPercent);
  // Passo aceso: acompanha o quanto já andou (com um mínimo pra não ficar
  // tudo apagado nos primeiros segundos).
  const activeStep =
    progressPercent >= 100
      ? steps.length - 1
      : Math.min(
          steps.length - 1,
          Math.max(0, Math.floor((displayPercent / 100) * steps.length)),
        );

  if (!mounted) return null;

  if (phase === "failed") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
          background: "#F8FAFC",
        }}
      >
        <AppHeader />
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "24px",
            gap: "18px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
            }}
          >
            ⚠️
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            {copy.errors.generationFailed}
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B", maxWidth: "300px", margin: 0 }}>
            Não se preocupe, suas fotos estão salvas. Vamos tentar novamente.
          </p>
          <div style={{ width: "100%", maxWidth: "320px", marginTop: "8px" }}>
            <Button
              onClick={() => {
                s.setGenerationId(null);
                startGeneration();
              }}
            >
              TENTAR NOVAMENTE
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "#F8FAFC",
      }}
    >
      <AppHeader />

      <style>{`
        @keyframes gerando-spin { to { transform: rotate(360deg); } }
        @keyframes gerando-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(109,40,217,0.35); }
          50% { box-shadow: 0 0 0 7px rgba(109,40,217,0); }
        }
        @keyframes gerando-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "28px 20px",
          maxWidth: "420px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Indicador circular com progresso */}
        <div
          style={{
            position: "relative",
            width: "110px",
            height: "110px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="110"
            height="110"
            viewBox="0 0 110 110"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx="55"
              cy="55"
              r="48"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="7"
            />
            <circle
              cx="55"
              cy="55"
              r="48"
              fill="none"
              stroke="#6D28D9"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={301.6}
              strokeDashoffset={301.6 - (301.6 * progressPercent) / 100}
              style={{
                transition: "stroke-dashoffset 0.35s linear",
              }}
            />
          </svg>

          {/* Arco que gira sem parar por cima — movimento constante mesmo
              enquanto a barra real espera o próximo lote da IA. */}
          {progressPercent < 100 && (
            <svg
              width="110"
              height="110"
              viewBox="0 0 110 110"
              style={{
                position: "absolute",
                inset: 0,
                animation: "gerando-spin 1s linear infinite",
              }}
            >
              <circle
                cx="55"
                cy="55"
                r="48"
                fill="none"
                stroke="#A855F7"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="20 281.6"
              />
            </svg>
          )}

          {/* Porcentagem centralizada */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "#0F172A",
                lineHeight: 1,
              }}
            >
              {progressPercent}%
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#6D28D9",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginTop: "3px",
              }}
            >
              Criando
            </span>
          </div>
        </div>

        {/* Título */}
        <h1
          style={{
            marginTop: "20px",
            fontSize: "22px",
            fontWeight: 900,
            color: "#0F172A",
            textAlign: "center",
            letterSpacing: "-0.4px",
            margin: "20px 0 6px",
          }}
        >
          {isPhoto
            ? "Estamos criando sua foto..."
            : "Estamos criando suas figurinhas..."}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#64748B",
            textAlign: "center",
            margin: "0 0 24px",
          }}
        >
          Nossa inteligência artificial está gerando os resultados.
        </p>

        {/* Card com os passos */}
        <div
          style={{
            width: "100%",
            background: "#ffffff",
            borderRadius: "20px",
            padding: "20px",
            border: "1.5px solid #E2E8F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {steps.map((label, i) => {
              const isDone = i < activeStep || progressPercent === 100;
              const isActive = i === activeStep && progressPercent < 100;

              return (
                <li
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: "13px",
                      fontWeight: 800,
                      background: isDone
                        ? "#15803D"
                        : isActive
                          ? "#6D28D9"
                          : "#F1F5F9",
                      color: isDone || isActive ? "#ffffff" : "#94A3B8",
                      animation: isActive
                        ? "gerando-pulse 1.5s ease-in-out infinite"
                        : "none",
                    }}
                  >
                    {isDone ? (
                      "✓"
                    ) : isActive ? (
                      <span style={{ fontSize: "10px" }}>●</span>
                    ) : (
                      "○"
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: isDone || isActive ? 700 : 500,
                      color: isDone
                        ? "#0F172A"
                        : isActive
                          ? "#0F172A"
                          : "#94A3B8",
                      flex: 1,
                    }}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Frase que troca sozinha — sinal visível de que segue trabalhando */}
        <div
          style={{
            marginTop: "18px",
            minHeight: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#0F172A",
            textAlign: "center",
          }}
        >
          <span
            key={tipIndex}
            style={{ animation: "gerando-fade 0.4s ease" }}
          >
            {progressPercent >= 100
              ? "Tudo pronto! Abrindo seus resultados..."
              : tips[tipIndex]}
          </span>
        </div>

        {/* Estimativa + andamento real */}
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "#64748B",
          }}
        >
          <span>⏱️</span>
          <span>
            {phase === "slow"
              ? copy.errors.generationSlow
              : total > 1
                ? done > 0
                  ? `${done} de ${total} prontas...`
                  : `Gerando ${total} imagens — costuma levar de 30s a 2 min...`
                : "Costuma levar de 20 a 40 segundos..."}
          </span>
        </div>
      </main>
    </div>
  );
}
