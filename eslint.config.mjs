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
    ".cursor/**",
    ".agents/**",
    ".claude/**",
    "extension/**",
    "demo-output/**",
    "public/**",
  ]),
  {
    files: [
      "components/dualtrack/DualTrackConsole.tsx",
      "features/ui/Views.tsx",
      "features/settings/SettingsPanel.tsx",
      "features/planBuilder/PlanBuilder.tsx",
      "features/learned/LearnedView.tsx",
      "features/modals/PricingPanel.tsx",
    ],
    rules: {
      // Large migrated SPA; typed boundaries are in lib/ and app/api/
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
