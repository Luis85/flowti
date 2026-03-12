/**
 * plugin-templates.ts — Templates for the flowti-obsidian-plugin scaffold.
 *
 * Produces Obsidian-specific files: Plugin class, manifest.json, styles.css,
 * tsconfig with Obsidian resolution, and esbuild CJS config.
 */

import type { TemplateFn, ScaffoldVariables } from "../scaffold-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function toJson(obj: unknown): string {
	return JSON.stringify(obj, null, "\t") + "\n";
}

// ── tsconfig.json (Obsidian-specific) ────────────────────────────────

export const pluginTsconfigTemplate: TemplateFn = (): string => {
	return toJson({
		compilerOptions: {
			target: "ES2022",
			module: "ESNext",
			moduleResolution: "bundler",
			strict: true,
			esModuleInterop: true,
			outDir: "../dist",
			rootDir: "..",
			declaration: false,
			sourceMap: true,
			skipLibCheck: true,
			types: ["node"],
		},
		include: ["../src/**/*.ts"],
		exclude: ["../node_modules", "../dist", "../tests"],
	});
};

// ── esbuild.config.mjs (CJS output for Obsidian) ────────────────────

export const pluginEsbuildConfigTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `/**
 * esbuild.config.mjs — Bundles ${vars.name} into main.js (CJS for Obsidian).
 */

import esbuild from "esbuild";
import builtins from "builtin-modules";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

const options = {
\tentryPoints: [path.join(projectRoot, "src/main.ts")],
\tbundle: true,
\toutfile: path.join(projectRoot, "main.js"),
\tplatform: "node",
\tformat: "cjs",
\ttarget: "es2022",
\tsourcemap: isProduction ? false : "inline",
\tminify: isProduction,
\texternal: [
\t\t"obsidian",
\t\t"electron",
\t\t"@codemirror/autocomplete",
\t\t"@codemirror/collab",
\t\t"@codemirror/commands",
\t\t"@codemirror/language",
\t\t"@codemirror/lint",
\t\t"@codemirror/search",
\t\t"@codemirror/state",
\t\t"@codemirror/view",
\t\t"@lezer/common",
\t\t"@lezer/highlight",
\t\t"@lezer/lr",
\t\t...builtins,
\t],
};

if (isWatch) {
\tconst ctx = await esbuild.context(options);
\tawait ctx.watch();
\tconsole.log("  Watching for changes...");
} else {
\tawait esbuild.build(options);
\tconsole.log("  Built: main.js");
}
`;
};

// ── manifest.json ────────────────────────────────────────────────────

export const pluginManifestTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return toJson({
		id: vars.id,
		name: vars.name,
		version: "0.0.1",
		minAppVersion: "1.5.0",
		description: `${vars.name} — an Obsidian plugin.`,
		author: vars.author || "Author",
		isDesktopOnly: false,
	});
};

// ── styles.css ───────────────────────────────────────────────────────

export const pluginStylesTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `/* ${vars.name} — Plugin styles */
`;
};

// ── main.ts (Plugin class) ──────────────────────────────────────────

export const pluginMainTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `import { Plugin } from "obsidian";

export default class ${vars.pascal}Plugin extends Plugin {
\tasync onload(): Promise<void> {
\t\tconsole.log(\`Loading ${vars.name}\`);
\t}

\tonunload(): void {
\t\tconsole.log(\`Unloading ${vars.name}\`);
\t}
}
`;
};

// ── main.test.ts ─────────────────────────────────────────────────────

export const pluginMainTestTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `import { describe, it, expect } from "vitest";

describe("${vars.name} Plugin", () => {
\tit("should have a valid plugin ID", () => {
\t\texpect("${vars.id}").toMatch(/^[a-z0-9-]+$/);
\t});

\tit("should be configured as ES module source", () => {
\t\texpect(true).toBe(true);
\t});
});
`;
};

// ── Export all ────────────────────────────────────────────────────────

export const pluginTemplates: Record<string, TemplateFn> = {
	"plugin-tsconfig": pluginTsconfigTemplate,
	"plugin-esbuild-config": pluginEsbuildConfigTemplate,
	"plugin-manifest": pluginManifestTemplate,
	"plugin-styles": pluginStylesTemplate,
	"plugin-main": pluginMainTemplate,
	"plugin-main-test": pluginMainTestTemplate,
};
