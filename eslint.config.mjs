import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["build/**", "coverage/**", "dist/**", "node_modules/**"],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    languageOptions: {
      globals: {
        URL: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.strict,
);
