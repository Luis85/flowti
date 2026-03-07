import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

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
			// Complexity threshold @todo should be driven by plugin config
			// @todo should error out at treshold + 10%
			complexity: ["warn", 15],

			// Unused vars — match plugin: error, but allow unused function args
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", {
				args: "none",
			}],

			// Match plugin relaxations
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",

			// Route all output through infrastructure/logger.ts — ban direct console usage
			"no-console": ["error", {
				allow: ["warn", "error", "debug"],
			}],

			// Route all process operations through infrastructure/proc.ts — ban direct process.exit/argv/cwd
			"no-restricted-properties": ["error",
				{ object: "process", property: "exit", message: "Use { proc } from infrastructure/proc.js instead." },
				{ object: "process", property: "argv", message: "Use { proc } from infrastructure/proc.js instead." },
				{ object: "process", property: "cwd", message: "Use { proc } from infrastructure/proc.js instead." },
			],

			// Route all file I/O through infrastructure/filesystem.ts — ban direct node:fs usage
			// Route all shell execution through infrastructure/shell.ts — ban direct child_process usage
			// Route all path operations through infrastructure/paths.ts — ban direct node:path usage
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
				}],
			}],
		},
	},

	// Allow node:fs in the filesystem service and types (type-only import for interface signatures)
	// Allow node:child_process in the shell service and legacy orchestration files
	// Allow node:path in the paths service
	// Allow process.* in the proc service and entry points
	{
		files: [
			"src/infrastructure/filesystem.ts",
			"src/infrastructure/shell.ts",
			"src/infrastructure/paths.ts",
			"src/infrastructure/proc.ts",
			"src/types.ts",
			// Legacy orchestration — too complex to refactor now, isolated scripts
			"src/domain/review/run-e2e.ts",
			"src/domain/devtools/cli-reload.ts",
			"src/domain/knowledgebase/vault-service.ts",
		],
		rules: {
			"no-restricted-imports": "off",
			"no-restricted-properties": "off",
		},
	},
	// Template files generate code for other projects — their string literals contain
	// process.*, console.*, and node:* imports that are valid in the generated output
	{
		files: [
			"src/domain/make/templates.ts",
			"src/domain/make/appTemplates.ts",
			"src/domain/make/cliTemplates.ts",
		],
		rules: {
			"no-restricted-imports": "off",
			"no-restricted-properties": "off",
			"no-console": "off",
		},
	},
];
