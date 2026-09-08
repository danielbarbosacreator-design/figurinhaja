"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Header compacto usado em todas as telas do fluxo.
 * - Esquerda: logo FigurinhaJá (asset da identidade)
 * - Direita: "X de Y" (opcional) ou slot customizável
 */
export function AppHeader({
  step,
  total,
  rightSlot,
}: {
  step?: number;
  total?: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid #E2E8F0",
      }}
    >
      <Link href="/" aria-label="FigurinhaJá — início" style={{ display: "flex" }}>
        <Image
          src="/Img/Identidade%20/Logo.png"
          alt="FigurinhaJá"
          width={116}
          height={42}
          priority
          style={{ width: "auto", height: "40px" }}
        />
      </Link>

      {rightSlot ? (
        rightSlot
      ) : step && total ? (
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#6D28D9",
            background: "#F5F3FF",
            padding: "4px 12px",
            borderRadius: "999px",
          }}
        >
          {step} de {total}
        </span>
      ) : null}
    </header>
  );
}
