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

			// Route all file I/O through infrastructure/filesystem.ts — ban direct node:fs usage
			"no-restricted-imports": ["error", {
				paths: [{
					name: "node:fs",
					message: "Use { disk } from infrastructure/filesystem.js instead.",
				}, {
					name: "fs",
					message: "Use { disk } from infrastructure/filesystem.js instead.",
				}],
			}],
		},
	},

	// Allow node:fs in the filesystem service and types (type-only import for interface signatures)
	{
		files: ["src/infrastructure/filesystem.ts", "src/types.ts"],
		rules: {
			"no-restricted-imports": "off",
		},
	},
];
