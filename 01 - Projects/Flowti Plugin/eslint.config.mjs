// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import obsidianmd from "eslint-plugin-obsidianmd";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    globalIgnores(["**/node_modules/", "**/main.js", "scripts/", "eslint.config.mjs", "esbuild.config.mjs", "split-css.mjs"]),
    {
        extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/eslint-recommended",
            "plugin:@typescript-eslint/recommended",
        ),

        plugins: {
            "@typescript-eslint": typescriptEslint,
            "obsidianmd": obsidianmd,
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
            "@typescript-eslint/no-floating-promises": "error",

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

            // Ban console.log — only warn/error/debug allowed per Obsidian marketplace policy
            "no-console": ["error", {
                allow: ["warn", "error", "debug"],
            }],

            // ── Obsidian marketplace rules (eslint-plugin-obsidianmd) ────
            ...obsidianmd.configs.recommended,

            // Downgrade no-static-styles-assignment to warn — 1,740 inline styles across the
            // entire UI layer. Full CSS class migration tracked as TD-129. Will be resolved
            // incrementally across future cycles (each UI file touched gets migrated).
            "obsidianmd/no-static-styles-assignment": "warn",

            // Sentence-case: all violations fixed in Cycle 48. Remaining warnings are
            // false positives on vault paths, "e.g." prefixes, and proper nouns (suppressed
            // with inline eslint-disable comments). Keep as warn to catch new violations.
            "obsidianmd/ui/sentence-case": ["warn", {
                ignoreWords: ["Flowti", "IBDE", "KPI", "KPIs"],
            }],

            // Downgrade validate-license/validate-manifest to warn — not blocking dev workflow
            "obsidianmd/validate-license": "warn",
            "obsidianmd/validate-manifest": "warn",

            // Downgrade sample-names — we don't have sample code but the rule can be noisy
            "obsidianmd/sample-names": "warn",
            "obsidianmd/no-sample-code": "warn",
        },

        ignores: ["node_modules/"],
    },
    ...storybook.configs["flat/recommended"]
]);
