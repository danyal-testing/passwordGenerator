// Flat ESLint config (ESLint v9+).
// The app ships as ordered "classic" scripts that share the window.PasswordGen
// namespace, so browser globals are enabled and sourceType is "script"
// (NOT module) to match how the files actually run in the browser.
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "images/**"],
  },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        ...globals.browser,
        // Shared application namespace populated across the ordered scripts.
        PasswordGen: "writable",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      eqeqeq: ["error", "smart"],
      "no-implicit-globals": "error",
    },
  },
  {
    // Tooling / config files run in Node as ES modules.
    files: ["*.mjs", "*.config.mjs", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
