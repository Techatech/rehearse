import globals from "globals";
import pluginJs from "@eslint/js/src/index.js"; // Modified line
import tseslint from "typescript-eslint";


export default [
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // Add any specific rules for your project here
    }
  }
];