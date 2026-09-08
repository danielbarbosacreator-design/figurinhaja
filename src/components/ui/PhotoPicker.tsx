"use client";

import { useRef, useState } from "react";
import { copy } from "@/lib/config";
import { track } from "@/lib/analytics";

const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB antes de reduzir
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_DIM = 900;

/**
 * Seleção de foto para o consumidor.
 * - Linguagem simples: "escolher foto" / "trocar foto".
 * - Reduz a imagem no cliente antes de guardar.
 * - Visual azul para upload (cor de ação secundária/info).
 * - Preview grande e elegante após seleção.
 */
export function PhotoPicker({
  label,
  hint,
  value,
  onChange,
  analyticsSlot,
}: {
  label: string;
  hint: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  analyticsSlot: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_INPUT_BYTES) {
      setError(copy.errors.photoTooBig);
      return;
    }
    if (file.type && !ACCEPTED.includes(file.type)) {
      setError(copy.errors.invalidPhoto);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await downscale(file);
      onChange(dataUrl);
      track("photo_uploaded", { slot: analyticsSlot });
    } catch {
      setError(copy.errors.invalidPhoto);
    } finally {
      setBusy(false);
    }
  }

  function openPicker() {
    track("photo_started", { slot: analyticsSlot });
    inputRef.current?.click();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {value ? (
        /* ── Preview elegante após upload ── */
        <div
          style={{
            borderRadius: "20px",
            border: "2px solid #6D28D9",
            background: "#F5F3FF",
            padding: "12px",
            boxShadow: "0 0 0 3px rgba(109,40,217,0.10)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Sua foto escolhida"
            style={{
              width: "100%",
              aspectRatio: "1",
              objectFit: "cover",
              borderRadius: "14px",
              background: "#F1F5F9",
              display: "block",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "12px",
              paddingLeft: "4px",
              paddingRight: "4px",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: "14px",
                color: "#6D28D9",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#6D28D9",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                ✓
              </span>
              {copy.fotos.added}
            </span>
            <button
              onClick={openPicker}
              style={{
                fontWeight: 700,
                fontSize: "14px",
                color: "#0F172A",
                background: "#F1F5F9",
                border: "none",
                padding: "6px 14px",
                borderRadius: "20px",
                cursor: "pointer",
              }}
            >
              {copy.fotos.change}
            </button>
          </div>
        </div>
      ) : (
        /* ── Área de upload ── */
        <button
          onClick={openPicker}
          disabled={busy}
          style={{
            width: "100%",
            borderRadius: "20px",
            border: "2.5px dashed #6D28D9",
            background: "#F5F3FF",
            padding: "36px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {/* Ícone de câmera */}
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "#6D28D9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M12 8L10 11H6a2 2 0 00-2 2v12a2 2 0 002 2h20a2 2 0 002-2V13a2 2 0 00-2-2h-4l-2-3h-8z"
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="16" cy="18" r="4" stroke="#fff" strokeWidth="2" fill="none"/>
            </svg>
          </div>

          <span style={{ fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
            {label}
          </span>
          <span style={{ fontSize: "13px", color: "#64748B", lineHeight: 1.4 }}>
            {hint}
          </span>

          <span
            style={{
              marginTop: "4px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "46px",
              padding: "0 28px",
              borderRadius: "14px",
              background: "#6D28D9",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2v9M5 7l4-5 4 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="2" y="14" width="14" height="2" rx="1" fill="#fff"/>
            </svg>
            {busy ? "Aguarde..." : copy.fotos.pick}
          </span>
        </button>
      )}

      {error ? (
        <p
          style={{
            marginTop: "12px",
            color: "#dc2626",
            fontWeight: 600,
            fontSize: "14px",
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
