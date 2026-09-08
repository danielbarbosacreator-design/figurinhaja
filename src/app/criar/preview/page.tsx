"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StepShell } from "@/components/flow/StepShell";
import { Button } from "@/components/ui/Button";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { copy, getProductById } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { useWizard } from "@/lib/store";
import { useMounted } from "@/lib/useFlow";
import { track } from "@/lib/analytics";

interface Asset {
  id: string;
  previewPath: string;
  isUnlocked: boolean;
}
interface GenView {
  status: string;
  productId: string | null;
  productType: string;
  paid: boolean;
  orderId: string | null;
  assets: Asset[];
}

export default function PreviewPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { generationId, setOrderId } = useWizard();
  const [gen, setGen] = useState<GenView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!generationId) return;
    try {
      const r = await fetch(`/api/generation/${generationId}`);
      if (!r.ok) throw new Error();
      const d: GenView = await r.json();
      setGen(d);
      if (d.paid) router.replace("/criar/aprovado");
    } catch {
      setError(copy.errors.sessionLost);
    }
  }, [generationId, router]);

  useEffect(() => {
    if (!mounted) return;
    if (!generationId) {
      router.replace("/criar/produto");
      return;
    }
    load();
    track("preview_viewed");
  }, [mounted, generationId, load, router]);

  if (!mounted) return null;

  if (error) {
    return (
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          textAlign: "center",
          padding: "40px 20px",
          minHeight: "100dvh",
          background: "#F8FAFC",
        }}
      >
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
          {error}
        </p>
        <div style={{ width: "100%", maxWidth: "280px" }}>
          <Button href="/">Começar de novo</Button>
        </div>
      </main>
    );
  }

  if (!gen) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          color: "#64748B",
          minHeight: "100dvh",
          background: "#F8FAFC",
        }}
      >
        Carregando sua prévia...
      </div>
    );
  }

  const product = getProductById(gen.productId);
  const price = product ? formatBRL(product.priceCents) : "";
  const isSinglePhoto = gen.productType === "user_photo";
  const showAiDisclosure =
    gen.productType === "user_photo" ||
    gen.productType === "user_candidate_pack";

  async function unlock() {
    if (!generationId) return;
    setSubmitting(true);
    track("unlock_clicked", { productId: gen!.productId });
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ generationId, productId: gen!.productId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "checkout");
      setOrderId(d.orderId);
      track("checkout_started", { orderId: d.orderId, amount: d.amount });
      router.push(d.checkoutUrl);
    } catch {
      setError(copy.errors.generationFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StepShell
      title={copy.preview.title}
      subtitle={
        isSinglePhoto
          ? "Sua foto exclusiva está gerada. Desbloqueie para baixar em alta resolução."
          : `Seu pack com ${gen.assets.length} figurinhas está pronto! Desbloqueie para baixar.`
      }
      onBack={() => router.push("/")}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Caixa de valor e ação */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "14px 16px",
              border: "1.5px solid #E2E8F0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#64748B",
                  textTransform: "uppercase",
                }}
              >
                {product?.label ?? "Pack Completo"}
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 900,
                  color: "#0F172A",
                  marginTop: "2px",
                }}
              >
                {price}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#15803D",
                  background: "#DCFCE7",
                  padding: "3px 8px",
                  borderRadius: "12px",
                }}
              >
                ✓ Acesso Imediato
              </span>
            </div>
          </div>

          <Button disabled={submitting} onClick={unlock}>
            {submitting
              ? "Abrindo pagamento..."
              : `${copy.preview.ctaPrefix} ${price} →`}
          </Button>

          {/* Badges de segurança */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748B",
            }}
          >
            <span>🔒 Pagamento seguro</span>
            <span>⚡ Envio instantâneo</span>
          </div>
        </div>
      }
    >
      {/* Visualização dos resultados */}
      {isSinglePhoto ? (
        /* Foto grande */
        <div style={{ maxWidth: "340px", margin: "0 auto" }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "4 / 5",
              borderRadius: "20px",
              overflow: "hidden",
              background: "#ffffff",
              border: "2px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gen.assets[0]?.previewPath}
              alt="Prévia da foto"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <LockOverlay show={!gen.assets[0]?.isUnlocked} />

            {/* Badge de proteção */}
            <div
              style={{
                position: "absolute",
                top: "12px",
                left: "12px",
                background: "rgba(15,23,42, 0.75)",
                backdropFilter: "blur(4px)",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "20px",
              }}
            >
              🔒 Prévia protegida
            </div>
          </div>
        </div>
      ) : (
        /* Grid de figurinhas */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          {gen.assets.map((a, idx) => (
            <div
              key={a.id}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: "18px",
                overflow: "hidden",
                background: "#ffffff",
                border: "2px solid #E2E8F0",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                boxSizing: "border-box",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.previewPath}
                alt={`Figurinha ${idx + 1}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
              <LockOverlay show={!a.isUnlocked} />

              {/* Tag com número */}
              <div
                style={{
                  position: "absolute",
                  bottom: "8px",
                  left: "8px",
                  background: "rgba(15,23,42, 0.7)",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "8px",
                }}
              >
                #{idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nota sobre prévia */}
      <p
        style={{
          marginTop: "16px",
          textAlign: "center",
          fontSize: "13px",
          color: "#64748B",
          fontWeight: 500,
        }}
      >
        🔒 {copy.preview.lockedNote} — após o pagamento, todos os arquivos são
        liberados em alta definição e sem marca d&apos;água.
      </p>

      {/* Aviso de IA */}
      {showAiDisclosure && (
        <div
          style={{
            marginTop: "14px",
            fontSize: "12px",
            color: "#64748B",
            background: "#ffffff",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "10px 12px",
            lineHeight: 1.4,
          }}
        >
          ⚠️ {copy.preview.aiDisclosure}
        </div>
      )}
    </StepShell>
  );
}
