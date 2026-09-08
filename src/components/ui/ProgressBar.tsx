/**
 * Barra de progresso fina — linha roxa no topo da tela de passo.
 */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ width: "100%", marginBottom: "4px" }}>
      {/* Linha de progresso */}
      <div
        style={{
          height: "4px",
          width: "100%",
          borderRadius: "9999px",
          background: "#E2E8F0",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #6D28D9 0%, #7C3AED 100%)",
            borderRadius: "9999px",
            width: `${pct}%`,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
