import { readFileSync } from "node:fs";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

// ── Read configurable thresholds from flowti.config.json ─────────────
const DEFAULTS = { maxComplexity: 10, maxLines: 300 };

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

export default [
	// Base: @typescript-eslint recommended (mirrors plugin's eslint:recommended + @typescript-eslint/recommended)
	...tseslint.configs["flat/recommended"].map((config) => ({
		...config,
		files: ["src/**/*.ts", "scripts/**/*.ts"],
	})),

	// Project-specific overrides
	{
		files: ["src/**/*.ts", "scripts/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			// Cyclomatic complexity — configurable via devtools.thresholds.maxComplexity
			complexity: ["warn", thresholds.maxComplexity],

			// File size — configurable via devtools.thresholds.maxLines (excludes blanks/comments)
			"max-lines": ["warn", { max: thresholds.maxLines, skipBlankLines: true, skipComments: true }],

			// Unused vars — error, but allow unused function args
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", {
				args: "none",
			}],

			// Relaxations matching the parent plugin
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",

			// ── Architecture enforcement ───────────────────────────────────────
			// These rules enforce the centralized service pattern:
			//   console.*    → { debug, log, warn, error } from infrastructure/logger.js
			//   process.*    → { proc }              from infrastructure/proc.js
			//   node:fs      → { disk }              from infrastructure/filesystem.js
			//   child_process→ { shell }             from infrastructure/shell.js
			//   node:path    → { paths }             from infrastructure/paths.js

			"no-console": "error",

			"no-restricted-properties": ["error",
				{ object: "process", property: "exit", message: "Use { proc } from infrastructure/proc.js instead." },
				{ object: "process", property: "argv", message: "Use { proc } from infrastructure/proc.js instead." },
				{ object: "process", property: "cwd", message: "Use { proc } from infrastructure/proc.js instead." },
				{ object: "process", property: "env", message: "Use { proc } from infrastructure/proc.js instead." },
			],

			"no-restricted-imports": ["error", {
				paths: [{
					name: "node:fs",
					message: "Use { disk } from infrastructure/filesystem.js instead.",
				}, {
					name: "fs",
					message: "Use { disk } from infrastructure/filesystem.js instead.",
				}, {
					name: "node:child_process",
					message: "Use { shell } from infrastructure/shell.js instead.",
				}, {
					name: "child_process",
					message: "Use { shell } from infrastructure/shell.js instead.",
				}, {
					name: "node:path",
					message: "Use { paths } from infrastructure/paths.js instead.",
				}, {
					name: "path",
					message: "Use { paths } from infrastructure/paths.js instead.",
				}, {
					name: "node:readline",
					message: "Use { input } from infrastructure/input.js instead.",
				}, {
					name: "readline",
					message: "Use { input } from infrastructure/input.js instead.",
				}],
			}],
		},
	},

	// ── Service implementations ────────────────────────────────────────
	// These files ARE the centralized services — they wrap the raw APIs
	{
		files: [
			"src/infrastructure/filesystem.ts",
			"src/infrastructure/shell.ts",
			"src/infrastructure/paths.ts",
			"src/infrastructure/proc.ts",
			"src/infrastructure/clock.ts",
			"src/infrastructure/logger.ts",
			"src/infrastructure/input.ts",
			"src/infrastructure/types.ts",
		],
		rules: {
			"no-restricted-imports": "off",
			"no-restricted-properties": "off",
			"no-console": "off",
		},
	},

	// ── Template generators ────────────────────────────────────────────
	// These files generate code for OTHER projects — their string literals
	// contain process.*, console.*, and node:* imports that are valid in
	// the generated output, not runtime violations
	{
		files: [
			"src/domain/make/templates.ts",
			"src/domain/make/appTemplates.ts",
			"src/domain/make/cliTemplates.ts",
			"src/domain/scaffold/templates/shared-templates.ts",
			"src/domain/scaffold/templates/project-templates.ts",
		],
		rules: {
			"no-restricted-imports": "off",
			"no-restricted-properties": "off",
			"no-console": "off",
			"max-lines": "off",
		},
	},

	// ── Data registries ───────────────────────────────────────────────
	// Pure data files with no logic — max-lines is not meaningful here
	{
		files: [
			"src/domain/reports/generators/entity-registry.ts",
		],
		rules: {
			"max-lines": "off",
		},
	},
];
