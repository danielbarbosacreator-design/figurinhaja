"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWizard } from "@/lib/store";
import { track } from "@/lib/analytics";
import { BrandLogo } from "@/components/ui/BrandLogo";

const BENEFITS = [
  { icon: "⚡", text: "Fácil de fazer" },
  { icon: "🚀", text: "Resultado rápido" },
  { icon: "🔒", text: "Pagamento seguro" },
];

const SHOWCASE_TOP = [
  {
    src: "/Img/Figurinhas/Figurinhas%20do%20candidato%20%28Lula%29.png",
    alt: "Figurinha do candidato",
  },
  {
    src: "/Img/Figurinhas/Voc%C3%AA%20%2B%20candidato.png",
    alt: "Figurinha de você com o candidato",
  },
];
const SHOWCASE_WIDE = {
  src: "/Img/Figurinhas/Foto%20ia%20personalizada.png",
  alt: "Foto personalizada com IA",
};

export default function HomePage() {
  const router = useRouter();
  const { sessionId, setSessionId, resetFlow } = useWizard();

  useEffect(() => {
    track("landing_view");
    if (!sessionId) {
      fetch("/api/session", { method: "POST" })
        .then((r) => r.json())
        .then((d) => d?.sessionId && setSessionId(d.sessionId))
        .catch(() => {});
    }
  }, [sessionId, setSessionId]);

  function start() {
    track("start_clicked");
    resetFlow();
    router.push("/criar/produto");
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        margin: "0 -20px", /* sangria para fundo full-width */
      }}
    >
      {/* ════════════════════════════════════
          HERO ESCURO
      ════════════════════════════════════ */}
      <section
        style={{
          background: "linear-gradient(165deg, #0F172A 0%, #1E293B 100%)",
          padding: "20px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Brilho roxo discreto */}
        <div
          style={{
            position: "absolute",
            top: "-90px",
            right: "-70px",
            width: "240px",
            height: "240px",
            borderRadius: "50%",
            background: "rgba(109,40,217,0.28)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        {/* ── Header dentro do hero ── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}
        >
          <BrandLogo size={22} onDark />
          {/* Badge IA */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#fff",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "5px 11px",
              borderRadius: "999px",
            }}
          >
            ✦ Com IA
          </span>
        </header>

        {/* ── Headline ── */}
        <div style={{ marginBottom: "20px" }}>
          <h1
            className="font-display"
            style={{
              fontSize: "34px",
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Crie suas{" "}
            <span className="ink-underline" style={{ color: "#A78BFA" }}>
              figurinhas e fotos
            </span>{" "}
            em segundos
          </h1>
          <p
            style={{
              marginTop: "12px",
              fontSize: "15px",
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.55,
            }}
          >
            Escolha uma opção, envie suas fotos e crie suas montagens
            personalizadas.
          </p>
        </div>

        {/* ── Composição visual: figurinhas showcase ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {SHOWCASE_TOP.map(({ src, alt }) => (
              <div
                key={src}
                className="sticker-frame"
                style={{
                  aspectRatio: "1",
                  background: "#1E293B",
                  overflow: "hidden",
                }}
              >
                <Image
                  src={src}
                  alt={alt}
                  width={200}
                  height={200}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                  priority
                />
              </div>
            ))}
          </div>

          <div
            className="sticker-frame"
            style={{
              aspectRatio: "16 / 10",
              background: "#1E293B",
              overflow: "hidden",
            }}
          >
            <Image
              src={SHOWCASE_WIDE.src}
              alt={SHOWCASE_WIDE.alt}
              width={480}
              height={300}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              priority
            />
          </div>
        </div>

        {/* ── Benefits ── */}
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            listStyle: "none",
            margin: 0,
            padding: 0,
            marginBottom: "24px",
          }}
        >
          {BENEFITS.map(({ icon, text }) => (
            <li
              key={text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>

        {/* ── CTA principal ── */}
        <button
          onClick={start}
          style={{
            width: "100%",
            minHeight: "56px",
            borderRadius: "16px",
            background: "#FBBF24",
            color: "#0F172A",
            fontSize: "17px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 8px 24px -6px rgba(251,191,36,0.6)",
            transition: "transform 0.12s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.01)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          COMEÇAR AGORA
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10h12M11 6l5 4-5 4" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </section>

      {/* ════════════════════════════════════
          SEÇÃO DE COMO FUNCIONA (clara)
      ════════════════════════════════════ */}
      <section
        style={{
          background: "#fff",
          padding: "28px 20px",
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#0F172A",
            margin: "0 0 20px",
            letterSpacing: "-0.03em",
          }}
        >
          Como funciona?
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            {
              step: "1",
              color: "#6D28D9",
              title: "Escolha o produto",
              desc: "Figurinha do candidato, sua com ele ou foto personalizada.",
            },
            {
              step: "2",
              color: "#0F172A",
              title: "Envie sua foto",
              desc: "Use uma foto nítida e com o rosto visível.",
            },
            {
              step: "3",
              color: "#6D28D9",
              title: "Receba em segundos",
              desc: "Nossa IA cria seu resultado. Pague e baixe na hora.",
            },
          ].map(({ step, color, title, desc }) => (
            <div
              key={step}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: color,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {step}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A" }}>
                  {title}
                </div>
                <div style={{ fontSize: "13px", color: "#64748B", marginTop: "2px", lineHeight: 1.4 }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════
          CTA de rodapé (repetido)
      ════════════════════════════════════ */}
      <section
        style={{
          background: "#F8FAFC",
          padding: "20px 20px 32px",
        }}
      >
        <button
          onClick={start}
          style={{
            width: "100%",
            minHeight: "54px",
            borderRadius: "16px",
            background: "#FBBF24",
            color: "#0F172A",
            fontSize: "16px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 8px 24px -6px rgba(251,191,36,0.55)",
          }}
        >
          COMEÇAR AGORA →
        </button>
        <p
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "#94A3B8",
            marginTop: "10px",
          }}
        >
          Criado com inteligência artificial · Seguro e rápido
        </p>
      </section>
    </main>
  );
}
