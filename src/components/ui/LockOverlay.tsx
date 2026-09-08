/**
 * Overlay de cadeado sobre prévia protegida.
 * Blur suave + ícone cadeado no canto — sinaliza que está protegido
 * sem ocultar totalmente o conteúdo (dica do produto).
 */
export function LockOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        background: "rgba(15,23,42,0.15)",
        borderRadius: "inherit",
      }}
    >
      {/* Cadeado no centro */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="9" rx="2" fill="#fff"/>
            <path d="M7 9V6.5a3 3 0 016 0V9" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
