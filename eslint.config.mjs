import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // O plugin react-hooks v6 marca estes como erro. Buscar dados dentro de
      // um efeito e chamar setState no resultado é o padrão que usamos nas
      // telas de polling (gerando / preview / checkout / aprovado). Mantemos
      // como aviso para não travar o build, sem perder o sinal.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // AppleDouble sidecar files criados pelo macOS neste volume não-nativo.
    "**/._*",
  ]),
]);

export default eslintConfig;
