"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { copy } from "@/lib/config";
import { useWizard } from "@/lib/store";
import { useMounted } from "@/lib/useFlow";
import { usePoll } from "@/lib/usePoll";
import { track } from "@/lib/analytics";

interface Asset {
  id: string;
  originalPath: string | null;
  isUnlocked: boolean;
}

export default function AprovadoPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { generationId, resetFlow } = useWizard();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [paid, setPaid] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (mounted && !generationId) router.replace("/");
  }, [mounted, generationId, router]);

  usePoll(
    async () => {
      if (!generationId) return true;
      const r = await fetch(`/api/generation/${generationId}`);
      if (!r.ok) return false;
      const d = await r.json();
      setAssets(d.assets);
      setPaid(d.paid);
      setPending(!d.paid);
      return d.paid === true;
    },
    { intervalMs: 2000, enabled: mounted && !!generationId && !paid },
  );

  if (!mounted) return null;

  if (!paid) {
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
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: "4px solid rgba(109,40,217, 0.2)",
              borderTopColor: "#6D28D9",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#0F172A",
              maxWidth: "280px",
            }}
          >
            {pending ? copy.errors.paymentPending : "Verificando seu pagamento..."}
          </p>
          <div style={{ width: "100%", maxWidth: "240px" }}>
            <Button variant="ghost" size="md" href="/criar/preview">
              Voltar para a prévia
            </Button>
          </div>
        </main>
      </div>
    );
  }

  function downloadAll() {
    track("download_clicked", { scope: "all", count: assets?.length ?? 0 });
    (assets ?? []).forEach((a, i) => {
      if (!a.originalPath) return;
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = a.originalPath!;
        link.download = `figurinha-${i + 1}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, i * 400);
    });
  }

  function again() {
    track("generate_again_clicked");
    resetFlow();
    router.push("/criar/produto");
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

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "20px 16px 120px",
          maxWidth: "430px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Banner de sucesso em verde */}
        <div
          style={{
            textAlign: "center",
            padding: "20px 16px",
            background: "#ffffff",
            borderRadius: "20px",
            border: "1.5px solid #DCFCE7",
            boxShadow: "0 4px 12px rgba(22,163,74, 0.08)",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "#16A34A",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 900,
              margin: "0 auto 12px",
              boxShadow: "0 4px 14px rgba(22,163,74, 0.3)",
            }}
          >
            ✓
          </div>

          <span
            style={{
              fontSize: "12px",
              fontWeight: 800,
              color: "#15803D",
              background: "#DCFCE7",
              padding: "3px 10px",
              borderRadius: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Pagamento Aprovado
          </span>

          <h1
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#0F172A",
              margin: "8px 0 4px",
              letterSpacing: "-0.4px",
            }}
          >
            {copy.aprovado.title}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#64748B",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {copy.aprovado.text}
          </p>
        </div>

        {/* Galeria de arquivos liberados */}
        <div style={{ marginTop: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
              Seus arquivos ({assets?.length ?? 0})
            </span>
            <span style={{ fontSize: "12px", color: "#15803D", fontWeight: 700 }}>
              ✓ Sem marca d&apos;água
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            {(assets ?? []).map((a, i) => (
              <div
                key={a.id}
                style={{
                  position: "relative",
                  aspectRatio: "1 / 1",
                  borderRadius: "18px",
                  overflow: "hidden",
                  background: "#ffffff",
                  border: "2px solid #E2E8F0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px",
                  boxSizing: "border-box",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.originalPath ?? undefined}
                  alt={`Figurinha ${i + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
                <a
                  href={a.originalPath ?? "#"}
                  download={`figurinha-${i + 1}.png`}
                  onClick={() => track("download_clicked", { scope: "one" })}
                  style={{
                    position: "absolute",
                    bottom: "8px",
                    right: "8px",
                    background: "rgba(15,23,42, 0.8)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "14px",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>⬇️</span> Baixar
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé fixo de ações */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to top, #F8FAFC 85%, transparent 100%)",
            padding: "16px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxWidth: "430px",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          <Button onClick={downloadAll}>
            BAIXAR TODAS AS FOTOS ⬇️
          </Button>

          <Button
            variant="secondary"
            href="https://faq.whatsapp.com/"
            size="md"
          >
            💬 Como adicionar no WhatsApp
          </Button>

          <button
            type="button"
            onClick={again}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              padding: "6px",
            }}
          >
            + Criar mais figurinhas
          </button>
        </div>
      </main>
    </div>
  );
}
