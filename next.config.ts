import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // O projeto vive num volume não-nativo do macOS (exFAT), onde o Finder
    // espalha arquivos AppleDouble `._*` dentro de qualquer diretório. O cache
    // em disco do Turbopack (`.next/dev/cache/turbopack/*.sst`) lê esse diretório
    // e tenta converter cada nome de arquivo em número; ao topar com `._00000060`
    // ele quebra com "invalid digit found in string" e o `next dev` morre no
    // boot. Desligar o cache em disco evita criar esse diretório frágil.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  images: {
    // Toda a imagética de exemplo da Fase 1 é SVG servido do nosso próprio /public.
    // Na Fase 2, adicionar aqui o domínio do Supabase Storage em `remotePatterns`.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
