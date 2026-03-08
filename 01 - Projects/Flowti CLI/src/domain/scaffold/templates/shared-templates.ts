/**
 * shared-templates.ts — Config file templates for scaffolded Flowti projects.
 *
 * These mirror the CLI's own stack: TypeScript strict, Vitest, esbuild, ESLint.
 * All templates are pure functions conforming to TemplateFn.
 */

import type { TemplateFn, ScaffoldVariables, ScaffoldDefinition } from "../scaffold-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function toJson(obj: unknown): string {
	return JSON.stringify(obj, null, "\t") + "\n";
}

// ── package.json ─────────────────────────────────────────────────────

export const packageJsonTemplate: TemplateFn = (vars: ScaffoldVariables, def: ScaffoldDefinition): string => {
	return toJson({
		name: vars.id,
		version: "0.0.1",
		...def.package.type ? { type: def.package.type } : {},
		description: vars.name,
		private: true,
		scripts: def.package.scripts,
		devDependencies: def.package.devDependencies,
	});
};

// ── tsconfig.json ────────────────────────────────────────────────────

export const tsconfigTemplate: TemplateFn = (): string => {
	return toJson({
		compilerOptions: {
			target: "ES2022",
			module: "NodeNext",
			moduleResolution: "NodeNext",
			strict: true,
			esModuleInterop: true,
			outDir: "../dist",
			rootDir: "..",
			declaration: true,
			sourceMap: true,
			skipLibCheck: true,
		},
		include: ["../src/**/*.ts"],
		exclude: ["../node_modules", "../dist", "../tests"],
	});
};

// ── vitest.config.ts ─────────────────────────────────────────────────

export const vitestConfigTemplate: TemplateFn = (): string => {
	return `import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
\ttest: {
\t\troot: path.resolve(import.meta.dirname, ".."),
\t\tinclude: ["tests/**/*.test.ts"],
\t\tcoverage: {
\t\t\tprovider: "v8",
\t\t\treporter: ["text", "json-summary"],
\t\t\tinclude: ["src/**/*.ts"],
\t\t},
\t},
});
`;
};

// ── esbuild.config.mjs ──────────────────────────────────────────────

export const esbuildConfigTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `/**
 * esbuild.config.mjs — Bundles ${vars.name} into dist/main.js.
 */

import esbuild from "esbuild";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.join(projectRoot, "dist");
const isWatch = process.argv.includes("--watch");

const options = {
\tentryPoints: [path.join(projectRoot, "src/main.ts")],
\tbundle: true,
\toutfile: path.join(outDir, "main.js"),
\tplatform: "node",
\tformat: "esm",
\ttarget: "node22",
\tsourcemap: !isWatch,
\tminify: !isWatch,
\tbanner: { js: "#!/usr/bin/env node" },
\texternal: ["node:*"],
};

if (isWatch) {
\tconst ctx = await esbuild.context(options);
\tawait ctx.watch();
\tconsole.log("  Watching for changes...");
} else {
\tawait esbuild.build(options);
\tconsole.log(\`  Built: dist/main.js\`);
}
`;
};

// ── eslint.config.mjs ────────────────────────────────────────────────

export const eslintConfigTemplate: TemplateFn = (): string => {
	return `import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
\t...tseslint.configs["flat/recommended"].map((config) => ({
\t\t...config,
\t\tfiles: ["src/**/*.ts"],
\t})),
\t{
\t\tfiles: ["src/**/*.ts"],
\t\tlanguageOptions: {
\t\t\tparser: tsparser,
\t\t\tparserOptions: { ecmaVersion: "latest", sourceType: "module" },
\t\t},
\t\tplugins: { "@typescript-eslint": tseslint },
\t\trules: {
\t\t\tcomplexity: ["warn", 10],
\t\t\t"max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
\t\t\t"no-unused-vars": "off",
\t\t\t"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
\t\t\t"@typescript-eslint/ban-ts-comment": "off",
\t\t\t"@typescript-eslint/no-empty-function": "off",
\t\t},
\t},
];
`;
};

// ── .gitignore ───────────────────────────────────────────────────────

export const gitignoreTemplate: TemplateFn = (): string => {
	return `node_modules/
dist/
*.js.map
`;
};

// ── flowti.config.json ───────────────────────────────────────────────

export const flowtiConfigTemplate: TemplateFn = (vars: ScaffoldVariables, def: ScaffoldDefinition): string => {
	return toJson({
		name: vars.id,
		...def.flowtiConfig,
	});
};

// ── Export all ────────────────────────────────────────────────────────

export const sharedTemplates: Record<string, TemplateFn> = {
	"package-json": packageJsonTemplate,
	"tsconfig": tsconfigTemplate,
	"vitest-config": vitestConfigTemplate,
	"esbuild-config": esbuildConfigTemplate,
	"eslint-config": eslintConfigTemplate,
	"gitignore": gitignoreTemplate,
	"flowti-config": flowtiConfigTemplate,
};
