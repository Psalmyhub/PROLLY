import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "genlayer-template-test/.venv/**",
    "genlayer-template-test/node_modules/**",
    "genlayer-template-test/.pytest_cache/**",
    "genlayer-template-test/__pycache__/**",
    "genlayer-template-test/**/dist/**",
  ]),
]);

export default eslintConfig;
