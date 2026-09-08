import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Toda a imagética de exemplo da Fase 1 é SVG servido do nosso próprio /public.
    // Na Fase 2, adicionar aqui o domínio do Supabase Storage em `remotePatterns`.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
