import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: [".next/**", ".next-dev/**", "node_modules/**", "ios/**", "android/**", "native-shell/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
    },
  },
];
