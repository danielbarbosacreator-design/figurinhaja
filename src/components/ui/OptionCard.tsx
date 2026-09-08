"use client";

/**
 * Card de escolha visual — estado selecionado em VERMELHO.
 * Borda 2px vermelha + ring vermelho + check preenchido.
 * Mobile-first: área de toque generosa, contraste alto.
 */
export function OptionCard({
  selected,
  onSelect,
  title,
  subtitle,
  media,
  badge,
  align = "row",
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  media?: React.ReactNode;
  badge?: string;
  align?: "row" | "col";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        position: "relative",
        width: "100%",
        textAlign: "left",
        borderRadius: "16px",
        border: selected ? "2px solid #6D28D9" : "2px solid #E2E8F0",
        padding: "14px",
        transition: "all 0.15s ease",
        background: selected ? "#F5F3FF" : "#ffffff",
        boxShadow: selected
          ? "0 0 0 3px rgba(109,40,217,0.12), 0 2px 8px rgba(0,0,0,0.06)"
          : "0 1px 4px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: align === "col" ? "column" : "row",
        alignItems: align === "col" ? "flex-start" : "center",
        gap: "12px",
        cursor: "pointer",
      }}
    >
      {/* Badge topo */}
      {badge ? (
        <span
          style={{
            position: "absolute",
            top: "-11px",
            right: "14px",
            background: "#6D28D9",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: "20px",
            letterSpacing: "0.3px",
          }}
        >
          {badge}
        </span>
      ) : null}

      {/* Mídia */}
      {media ? (
        <div
          style={{
            flexShrink: 0,
            borderRadius: "12px",
            overflow: "hidden",
            background: "#F1F5F9",
            ...(align === "col"
              ? { width: "100%", aspectRatio: "4/3" }
              : { width: "80px", height: "80px" }),
          }}
        >
          {media}
        </div>
      ) : null}

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 800,
            lineHeight: 1.3,
            color: "#0F172A",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: "13px",
              color: "#64748B",
              marginTop: "3px",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {/* Check */}
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: "26px",
          height: "26px",
          borderRadius: "50%",
          border: selected ? "2px solid #6D28D9" : "2px solid #CBD5E1",
          background: selected ? "#6D28D9" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 800,
          color: selected ? "#fff" : "transparent",
          transition: "all 0.15s ease",
          alignSelf: align === "col" ? "flex-end" : "center",
        }}
      >
        ✓
      </span>
    </button>
  );
}
