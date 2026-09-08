import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";

export function SiteFooter() {
  return (
    <footer
      style={{
        background: "#0F172A",
        color: "rgba(255,255,255,0.6)",
        padding: "20px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "448px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Linha 1: brand + tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <BrandLogo size={17} onDark />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
            Política também é diversão.
          </span>
        </div>

        {/* Linha 2: links nav */}
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 16px",
          }}
        >
          {[
            { href: "/termos", label: "Termos de Uso" },
            { href: "/privacidade", label: "Privacidade" },
            { href: "/contato", label: "Suporte" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
                textDecoration: "underline",
                textDecorationColor: "rgba(255,255,255,0.25)",
                textUnderlineOffset: "3px",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Linha 3: disclaimer */}
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.5, margin: 0 }}>
          As figurinhas são criadas por IA a partir das fotos enviadas.
          Imagens que combinam pessoas são montagens ilustrativas.
          Para todos os eleitores. De 19 a 60+.
        </p>
      </div>
    </footer>
  );
}
