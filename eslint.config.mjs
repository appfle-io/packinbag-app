import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import pibV2 from "./eslint/pib-v2-rules.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 리디자인 v2 코드에만 디자인 토큰 규칙을 강제한다 (구 UI는 대상 아님).
  {
    files: ["components/v2/**/*.{ts,tsx}", "app/dev/**/*.{ts,tsx}"],
    plugins: { "pib-v2": pibV2 },
    rules: {
      "pib-v2/no-arbitrary-values": "error",
      "pib-v2/no-static-inline-style": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
