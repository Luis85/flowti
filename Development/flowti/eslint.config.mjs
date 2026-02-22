import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["**/node_modules/", "**/main.js"]), {
    extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
    ),

    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        globals: {
            ...globals.node,
        },

        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "module",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    rules: {
        "no-unused-vars": "off",

        "@typescript-eslint/no-unused-vars": ["error", {
            args: "none",
        }],

        "@typescript-eslint/ban-ts-comment": "off",
        "no-prototype-builtins": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-floating-promises": "warn",

        // Obsidian submission compliance rules (Cycle 16, Inc 2)
        // Ban innerHTML/outerHTML to prevent XSS — use createEl()/empty() instead
        "no-restricted-properties": ["error",
            {
                object: "el",
                property: "innerHTML",
                message: "Use el.empty() or DOM methods instead of innerHTML (Obsidian compliance).",
            },
            {
                object: "el",
                property: "outerHTML",
                message: "Use DOM methods instead of outerHTML (Obsidian compliance).",
            },
            {
                property: "insertAdjacentHTML",
                message: "Use createEl()/createDiv() instead of insertAdjacentHTML (Obsidian compliance).",
            },
        ],
    },

	ignores: ["node_modules/"],
}]);
