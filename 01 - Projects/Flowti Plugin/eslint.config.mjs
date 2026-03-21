// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { readFileSync } from "node:fs";
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

// ── Read configurable thresholds from flowti.config.json ─────────────
const DEFAULTS = { maxComplexity: 15, maxLines: 400 };

function loadThresholds() {
	try {
		const raw = JSON.parse(readFileSync("configs/flowti.config.json", "utf-8"));
		const t = raw?.devtools?.thresholds;
		return {
			maxComplexity: typeof t?.maxComplexity === "number" ? t.maxComplexity : DEFAULTS.maxComplexity,
			maxLines: typeof t?.maxLines === "number" ? t.maxLines : DEFAULTS.maxLines,
		};
	} catch {
		return DEFAULTS;
	}
}

const thresholds = loadThresholds();

export default defineConfig([
    globalIgnores(["**/node_modules/", "**/main.js", "scripts/", "eslint.config.mjs", "esbuild.config.mjs", "split-css.mjs", "components/"]),
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
            // ── Code quality thresholds (from flowti.config.json) ─────────
            complexity: ["warn", thresholds.maxComplexity],
            "max-lines": ["warn", { max: thresholds.maxLines, skipBlankLines: true, skipComments: true }],

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

    // ── Architecture enforcement: Domain purity ──────────────────────
    // Domain is PURE business logic — must NEVER import infrastructure,
    // UI, components, bootstrap, or Obsidian directly.
    // Receives all deps via typed injection through EventBus/service interfaces.
    {
        files: ["src/domain/**/*.ts"],
        rules: {
            "no-restricted-imports": ["error", {
                patterns: [{
                    group: ["../infrastructure/*", "../infrastructure/**"],
                    message: "Domain must not import infrastructure. Use dependency injection via typed interfaces.",
                }, {
                    group: ["../ui/*", "../ui/**", "../../ui/*", "../../ui/**"],
                    message: "Domain must not import UI. Emit events via EventBus instead.",
                }, {
                    group: ["../components/*", "../components/**", "../../components/*", "../../components/**"],
                    message: "Domain must not import components. Components consume domain types, not the reverse.",
                }, {
                    group: ["../bootstrap/*", "../bootstrap/**", "../../bootstrap/*", "../../bootstrap/**"],
                    message: "Domain must not import bootstrap. Bootstrap wires domain, not the reverse.",
                }],
                paths: [{
                    name: "obsidian",
                    message: "Domain must not import Obsidian. Use EventBus abstractions instead.",
                }],
            }],
        },
    },

    // ── Architecture enforcement: Component isolation ─────────────────
    // Lit components are presentation-only — import from 'lit' and
    // domain types only. Never reach into infrastructure or Obsidian.
    {
        files: ["src/components/**/*.ts"],
        rules: {
            "no-restricted-imports": ["error", {
                patterns: [{
                    group: ["../infrastructure/*", "../infrastructure/**", "../../infrastructure/*", "../../infrastructure/**"],
                    message: "Components must not import infrastructure. Receive data via properties, emit via CustomEvent.",
                }, {
                    group: ["../ui/*", "../ui/**", "../../ui/*", "../../ui/**"],
                    message: "Components must not import UI views. Components are consumed by UI, not the reverse.",
                }, {
                    group: ["../bootstrap/*", "../bootstrap/**", "../../bootstrap/*", "../../bootstrap/**"],
                    message: "Components must not import bootstrap.",
                }],
                paths: [{
                    name: "obsidian",
                    message: "Components must not import Obsidian. Use Lit APIs and receive Obsidian data via properties.",
                }],
            }],
        },
    },

    // ── Architecture enforcement: Utils purity ───────────────────────
    // Utility modules are pure helpers — no Obsidian, no infrastructure.
    {
        files: ["src/utils/**/*.ts"],
        rules: {
            "no-restricted-imports": ["error", {
                patterns: [{
                    group: ["../infrastructure/*", "../infrastructure/**"],
                    message: "Utils must not import infrastructure. Keep utils pure and portable.",
                }, {
                    group: ["../ui/*", "../ui/**"],
                    message: "Utils must not import UI.",
                }, {
                    group: ["../components/*", "../components/**"],
                    message: "Utils must not import components.",
                }],
            }],
        },
    },

    // ── Large data files — exempt from max-lines ─────────────────────
    {
        files: [
            "src/infrastructure/events/catalog.ts",
            "src/infrastructure/events/events.ts",
            "src/game/systems/talk/templates/core.ts",
        ],
        rules: {
            "max-lines": "off",
        },
    },

    ...storybook.configs["flat/recommended"]
]);
