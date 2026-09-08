/**
 * Logo FigurinhaJá — wordmark estilo sticker.
 * "Figurinha" navy + "Já" roxo, contorno branco de adesivo e traço amarelo à mão.
 * Fonte Poppins (só a marca usa Poppins). Funciona em fundo claro e escuro.
 */
export function BrandLogo({
  size = 22,
  tagline = false,
  onDark = false,
}: {
  size?: number;
  tagline?: boolean;
  onDark?: boolean;
}) {
  const stroke = Math.max(2, Math.round(size * 0.2));
  return (
    <span
      className="font-display"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: size * 0.34,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      <span style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{
            fontSize: size,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            display: "inline-block",
            WebkitTextStroke: `${stroke}px #fff`,
            paintOrder: "stroke fill",
            filter: onDark
              ? "drop-shadow(0 2px 6px rgba(0,0,0,0.45))"
              : "drop-shadow(0 1px 2px rgba(15,23,42,0.12))",
          }}
        >
          <span style={{ color: "#0F172A" }}>Figurinha</span>
          <span style={{ color: "#7C3AED" }}>Já</span>
        </span>
        {/* Traço amarelo curvo à mão */}
        <svg
          viewBox="0 0 200 16"
          width="62%"
          height={size * 0.42}
          preserveAspectRatio="none"
          style={{ position: "absolute", left: "4%", bottom: size * -0.16 }}
          aria-hidden
        >
          <path
            d="M4 11 C 55 3, 150 3, 196 9"
            fill="none"
            stroke="#FBBF24"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {tagline ? (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: Math.max(10, size * 0.3),
            letterSpacing: "-0.01em",
            color: onDark ? "#F8FAFC" : "#0F172A",
            background: onDark ? "#0F172A" : "transparent",
            border: onDark ? "2px solid rgba(255,255,255,0.9)" : "none",
            borderRadius: 999,
            padding: onDark ? "4px 12px" : 0,
          }}
        >
          Figurinhas e fotos com seu candidato.
        </span>
      ) : null}
    </span>
  );
}
