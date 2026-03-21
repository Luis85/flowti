/**
 * storybook.controller.ts — Non-interactive CLI commands for Storybook.
 *
 * Provides storybook:install, storybook:start, storybook:stop, storybook:build,
 * storybook:generate, storybook:scaffold, storybook:import.
 */

import { createHash } from "node:crypto";
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ComponentFramework, IFileSystem, IPaths } from "../infrastructure/types.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

import {
	installStorybook,
	isStorybookInstalled,
	isStorybookRunning,
	stopStorybook,
	startStorybookDev,
	runStorybookBuild,
	resolveStorybookDir,
} from "../domain/make/component/storybook-service.js";
import { getFramework, setFramework, writeComponentsConfig } from "../domain/make/component/storybook-settings.js";
import { createStorybookRenderer } from "../ui/renderers/storybook-renderer-impl.js";

import {
	renderStorybookInstallResult,
	renderStorybookStartResult,
	renderStorybookStopResult,
	renderStorybookBuildResult,
	renderStorybookGenerateResult,
	renderStorybookScaffoldResult,
	renderStorybookImportResult,
	type StorybookInstallResultModel,
	type StorybookStartResultModel,
	type StorybookStopResultModel,
	type StorybookBuildResultModel,
	type StorybookGenerateResultModel,
	type StorybookScaffoldResultModel,
	type StorybookImportResultModel,
} from "../ui/renderers/storybook-renderers.js";
import { scaffoldStorybookFromSitemap, SCAFFOLD_FRAMEWORKS } from "../domain/make/storybook-scaffold.js";
import { parseFrontmatterContent } from "../infrastructure/frontmatter.js";
import { validateComponents, generateSitemapFromMarkdown } from "../domain/make/markdown-sitemap-import.js";
import { parseCanvasToSitemap } from "../domain/make/canvas-sitemap-import.js";
import { generateSitemapCanvas } from "../domain/make/canvas-sitemap-export.js";
import type { CanvasData } from "../domain/make/canvas-sitemap-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function scanMarkdownFrontmatter(
	rootDir: string,
	deps: { disk: Pick<IFileSystem, "readdirSync" | "readFileSync">; paths: Pick<IPaths, "join" | "relative"> },
): Record<string, Record<string, unknown>> {
	const mdFiles: Record<string, Record<string, unknown>> = {};

	function walk(dir: string): void {
		const entries = deps.disk.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = deps.paths.join(dir, entry.name);
			if (entry.isFile() && entry.name.endsWith(".md")) {
				const relPath = deps.paths.relative(rootDir, fullPath).replace(/\\/g, "/");
				const content = deps.disk.readFileSync(fullPath, "utf8");
				const fm = parseFrontmatterContent(content);
				if (!fm) continue;
				// Derive category from folder path if not in frontmatter
				if (!fm.category) {
					const relDir = deps.paths.relative(rootDir, dir).replace(/\\/g, "/");
					if (relDir && relDir !== ".") fm.category = relDir;
				}
				mdFiles[relPath] = fm;
			} else if (!entry.isFile()) {
				walk(fullPath);
			}
		}
	}

	walk(rootDir);
	return mdFiles;
}

function runMarkdownImport(
	projectPath: string,
	sourcePath: string,
	mdSource: { strategy?: string; requiredFields?: readonly string[] } | undefined,
	outputFlag: string,
	deps: { disk: IFileSystem; paths: IPaths },
): StorybookImportResultModel {
	const srcDir = deps.paths.isAbsolute(sourcePath)
		? sourcePath
		: deps.paths.resolve(sourcePath);
	const strategy = (mdSource?.strategy ?? "category") as import("../domain/make/markdown-sitemap-types.js").Strategy;
	const requiredFields = mdSource?.requiredFields ?? ["name", "category"];

	const mdFiles = scanMarkdownFrontmatter(srcDir, deps);
	const { valid, warnings } = validateComponents(mdFiles, requiredFields);
	const sitemap = generateSitemapFromMarkdown(valid, strategy);

	const outputPath = outputFlag || deps.paths.join(projectPath, "imported-sitemap.json");
	writeSitemapFile(outputPath, JSON.stringify(sitemap, null, "\t") + "\n", deps);

	return {
		componentCount: valid.length,
		skippedCount: warnings.length,
		warnings: warnings.map((w) => ({ file: w.file, reason: w.reason })),
		outputPath,
		configured: true,
	};
}

function writeSitemapFile(
	outputPath: string,
	content: string,
	deps: { disk: Pick<IFileSystem, "existsSync" | "mkdirSync" | "writeFileSync">; paths: Pick<IPaths, "dirname"> },
): void {
	const outputDir = deps.paths.dirname(outputPath);
	if (!deps.disk.existsSync(outputDir)) deps.disk.mkdirSync(outputDir, { recursive: true });
	deps.disk.writeFileSync(outputPath, content, "utf8");
}

export const commands: Record<string, CommandHandler> = {
	"storybook:install": adaptDescriptor<{ framework: string }, StorybookInstallResultModel>({
		requires: "project",
		flags: {
			framework: {
				type: "string",
				required: false,
				hint: "--framework=html|angular|react|vue",
				choices: ["html", "angular", "react", "vue"],
			},
		},
		handler: (ctx) => {
			const { disk, paths, shell, input, log } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			const framework = (ctx.flags.framework || getFramework(ctx.project!.path, { disk, paths }) || "html") as ComponentFramework;
			const projectName = paths.basename(ctx.project!.path);
			const sbDir = resolveStorybookDir(ctx.project!.path, config, { paths });

			setFramework(ctx.project!.path, framework, { disk, paths });
			const installed = installStorybook(
				ctx.project!.path, projectName,
				{ ...config, framework },
				{ disk, paths, shell, input },
				createStorybookRenderer(log),
			);
			return { installed, framework, sbDir };
		},
		renderer: renderStorybookInstallResult,
	}),

	"storybook:start": adaptDescriptor<Record<string, unknown>, StorybookStartResultModel>({
		requires: "project",
		handler: async (ctx) => {
			const { disk, paths, shell, log } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			return startStorybookDev(
				ctx.project!.path, config, VAULT_ROOT,
				{ disk, paths, shell },
				createStorybookRenderer(log),
			);
		},
		renderer: renderStorybookStartResult,
	}),

	"storybook:stop": adaptDescriptor<Record<string, unknown>, StorybookStopResultModel>({
		requires: "project",
		handler: (ctx) => {
			const wasRunning = isStorybookRunning();
			if (wasRunning) stopStorybook(createStorybookRenderer(ctx.deps.log));
			return { stopped: wasRunning, wasRunning };
		},
		renderer: renderStorybookStopResult,
	}),

	"storybook:build": adaptDescriptor<Record<string, unknown>, StorybookBuildResultModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell, log } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			if (!isStorybookInstalled(ctx.project!.path, config, { disk, paths })) {
				return { built: false };
			}
			runStorybookBuild(ctx.project!.path, config, { disk, paths, shell }, createStorybookRenderer(log));
			return { built: true };
		},
		renderer: renderStorybookBuildResult,
	}),

	"storybook:generate": adaptDescriptor<Record<string, unknown>, StorybookGenerateResultModel>({
		requires: "project",
		handler: (ctx) => {
			const { shell, paths } = ctx.deps;
			const scriptPath = paths.join(ctx.project!.path, "scripts", "generate-storybook.mjs");
			const exitCode = shell.run(`node "${scriptPath}"`, { cwd: ctx.project!.path, label: "Generating sitemap stories" });
			return { generated: exitCode === 0, exitCode };
		},
		renderer: renderStorybookGenerateResult,
	}),

	"storybook:scaffold": adaptDescriptor<{ sitemap: string; framework: string; adoptImport: boolean }, StorybookScaffoldResultModel>({
		requires: "project",
		flags: {
			sitemap: {
				type: "string",
				required: false,
				hint: "--sitemap=<path>",
			},
			framework: {
				type: "string",
				required: false,
				hint: "--framework=react|vue|angular|lit|cli-app",
				choices: [...SCAFFOLD_FRAMEWORKS],
			},
			adoptImport: {
				type: "boolean",
				required: false,
				hint: "--adopt-import",
			},
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			const storybookDir = resolveStorybookDir(ctx.project!.path, config, { paths });
			const framework = ctx.flags.framework || getFramework(ctx.project!.path, { disk, paths }) || "html";

			// Primary sitemap lives at configs/sitemap.json
			const configsSitemap = paths.join(ctx.project!.path, "configs", "sitemap.json");
			const importedSitemap = paths.join(ctx.project!.path, "imported-sitemap.json");

			let sitemapPath = ctx.flags.sitemap || configsSitemap;
			let adoptedImport = false;

			// Auto-adopt imported-sitemap.json when no project sitemap exists
			if (!ctx.flags.sitemap && !disk.existsSync(configsSitemap) && disk.existsSync(importedSitemap)) {
				if (ctx.flags.adoptImport) {
					const configsDir = paths.join(ctx.project!.path, "configs");
					if (!disk.existsSync(configsDir)) disk.mkdirSync(configsDir, { recursive: true });
					const content = disk.readFileSync(importedSitemap, "utf8");
					disk.writeFileSync(configsSitemap, content, "utf8");
					sitemapPath = configsSitemap;
					adoptedImport = true;
				} else {
					// Signal that an import is available but not adopted
					return { files: [], framework, pageCount: 0, outputDir: storybookDir, noSitemap: false, pendingImport: true };
				}
			}

			if (!disk.existsSync(sitemapPath)) {
				return { files: [], framework, pageCount: 0, outputDir: storybookDir, noSitemap: true };
			}

			const result = scaffoldStorybookFromSitemap(sitemapPath, framework, { disk, paths });

			// Skip files that storybook init already created (config, package.json)
			const INIT_OWNED = new Set([".storybook/main.ts", ".storybook/main.js", "package.json"]);
			// Cross-extension check: main.ts and main.js are interchangeable
			const mainTs = paths.join(storybookDir, ".storybook", "main.ts");
			const mainJs = paths.join(storybookDir, ".storybook", "main.js");
			const hasAnyMain = disk.existsSync(mainTs) || disk.existsSync(mainJs);
			const written: typeof result.files = [];

			// Write scaffold files into the components directory
			for (const file of result.files) {
				if (INIT_OWNED.has(file.path)) {
					if (file.path.startsWith(".storybook/main.") && hasAnyMain) continue;
					const absPath = paths.join(storybookDir, file.path);
					if (disk.existsSync(absPath)) continue;
				}
				const absPath = paths.join(storybookDir, file.path);
				const dir = paths.dirname(absPath);
				if (!disk.existsSync(dir)) disk.mkdirSync(dir, { recursive: true });
				disk.writeFileSync(absPath, file.content, "utf8");
				written.push(file);
			}

			return { ...result, files: written, outputDir: storybookDir, adoptedImport };
		},
		renderer: renderStorybookScaffoldResult,
	}),

	"storybook:import": adaptDescriptor<{ output: string; source: string; saveConfig: boolean; strategy: string; fields: string }, StorybookImportResultModel | { configSaved: boolean; path: string; strategy: string; requiredFields: string[] }>({
		requires: "project",
		flags: {
			output: {
				type: "string",
				required: false,
				hint: "--output=<path>",
			},
			source: {
				type: "string",
				required: false,
				hint: "--source=<folder>",
			},
			saveConfig: {
				type: "boolean",
				required: false,
				hint: "--save-config",
			},
			strategy: {
				type: "string",
				required: false,
				hint: "--strategy=category|flat|hierarchical",
				choices: ["category", "flat", "hierarchical"],
			},
			fields: {
				type: "string",
				required: false,
				hint: "--fields=name,category,...",
			},
		},
		handler: (ctx) => {
			// Save config mode: write markdownSource to flowti.config.json
			if (ctx.flags.saveConfig) {
				const path = ctx.flags.source || "";
				const strategy = (ctx.flags.strategy || "category") as import("../domain/make/markdown-sitemap-types.js").Strategy;
				const requiredFields = ctx.flags.fields ? ctx.flags.fields.split(",").map((f) => f.trim()) : ["name", "category"];
				writeComponentsConfig(ctx.project!.path, { markdownSource: { path, strategy, requiredFields } }, ctx.deps);
				return { configSaved: true, path, strategy, requiredFields };
			}

			// Normal import mode
			const sourcePath = ctx.flags.source || ctx.project!.config.components?.markdownSource?.path;
			if (!sourcePath) {
				return { componentCount: 0, skippedCount: 0, warnings: [], outputPath: "", configured: false };
			}
			return runMarkdownImport(ctx.project!.path, sourcePath, ctx.project!.config.components?.markdownSource, ctx.flags.output, ctx.deps);
		},
		renderer: (data, log) => {
			if ("configSaved" in data) {
				log(`Markdown source config saved: path=${data.path}, strategy=${data.strategy}, fields=${data.requiredFields.join(",")}`);
				return;
			}
			renderStorybookImportResult(data, log);
		},
	}),

	"storybook:clean": adaptDescriptor<Record<string, never>, { cleaned: boolean; dir: string }>({
		requires: "project",
		handler: (ctx) => {
			const config = ctx.project!.config.components ?? {};
			const sbDir = resolveStorybookDir(ctx.project!.path, config, { paths: ctx.deps.paths });
			if (ctx.deps.disk.existsSync(sbDir)) {
				ctx.deps.disk.rmSync(sbDir, { recursive: true, force: true });
			}
			return { cleaned: true, dir: sbDir };
		},
		renderer: (data, log) => { log(`Cleaned ${data.dir}`); },
	}),

	"storybook:canvas-generate": adaptDescriptor<{ preset: string; force: boolean }, { created: boolean; path: string }>({
		requires: "project",
		flags: {
			preset: { type: "string", default: "", hint: "--preset=<web-app|landing|dashboard|e-commerce|docs>" },
			force: { type: "boolean", default: false, hint: "--force" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const canvasPath = paths.join(ctx.project!.path, "sitemap.canvas");

			if (disk.existsSync(canvasPath) && !ctx.flags.force) {
				return { created: false, path: "" };
			}

			const projectName = paths.basename(ctx.project!.path);
			const briefPath = `01 - Projects/${projectName}/${projectName}.md`;
			const preset = (ctx.flags.preset || undefined) as import("../domain/make/canvas-sitemap-export.js").CanvasPreset | undefined;

			// When a preset is specified, use it directly — don't read existing sitemap
			let sitemap: import("../domain/sitemap/unified-page.js").UnifiedSitemap | undefined;
			if (!preset) {
				const sitemapPath = paths.join(ctx.project!.path, "configs", "sitemap.json");
				if (disk.existsSync(sitemapPath)) {
					sitemap = JSON.parse(disk.readFileSync(sitemapPath, "utf8")) as import("../domain/sitemap/unified-page.js").UnifiedSitemap;
				}
			}

			const canvas = generateSitemapCanvas({ briefPath, sitemap, preset });
			disk.writeFileSync(canvasPath, JSON.stringify(canvas, null, "\t") + "\n", "utf8");

			return { created: true, path: canvasPath };
		},
		renderer: (data, log) => {
			if (data.created) {
				log(`\n  Created sitemap.canvas at ${data.path}\n`);
			} else {
				log("\n  Canvas already exists. Use --force to overwrite.\n");
			}
		},
	}),

	"storybook:canvas-import": adaptDescriptor<{ canvas: string; output: string; merge: boolean }, { added: number; updated: number; totalPages: number; outputPath: string }>({
		requires: "project",
		flags: {
			canvas: { type: "string", required: false, hint: "--canvas=<path>" },
			output: { type: "string", required: false, hint: "--output=<path>" },
			merge: { type: "boolean", required: false, hint: "--merge" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const canvasPath = ctx.flags.canvas || paths.join(ctx.project!.path, "sitemap.canvas");
			const outputPath = ctx.flags.output || paths.join(ctx.project!.path, "configs", "sitemap.json");

			if (!disk.existsSync(canvasPath)) {
				return { added: 0, updated: 0, totalPages: 0, outputPath: "" };
			}

			const canvasJson = disk.readFileSync(canvasPath, "utf8");
			const canvas = JSON.parse(canvasJson) as CanvasData;

			let existing: import("../domain/sitemap/unified-page.js").UnifiedSitemap | undefined;
			if (ctx.flags.merge && disk.existsSync(outputPath)) {
				existing = JSON.parse(disk.readFileSync(outputPath, "utf8")) as import("../domain/sitemap/unified-page.js").UnifiedSitemap;
			}

			const { sitemap, added, updated, totalPages } = parseCanvasToSitemap(canvas, existing);

			const outputDir = paths.dirname(outputPath);
			if (!disk.existsSync(outputDir)) disk.mkdirSync(outputDir, { recursive: true });
			disk.writeFileSync(outputPath, JSON.stringify(sitemap, null, "\t") + "\n", "utf8");

			// Write canvas hash metadata
			const hash = createHash("md5").update(canvasJson).digest("hex");
			const metaPath = paths.join(paths.dirname(outputPath), ".sitemap-canvas-meta.json");
			disk.writeFileSync(metaPath, JSON.stringify({ canvasHash: hash, importedAt: new Date().toISOString() }) + "\n", "utf8");

			return { added, updated, totalPages, outputPath };
		},
		renderer: (data, log) => {
			if (data.totalPages === 0) {
				log("\n  No canvas found. Nothing to import.\n");
				return;
			}
			log(`\n  Imported canvas → ${data.outputPath}`);
			log(`  ${data.added} added, ${data.updated} updated, ${data.totalPages} total pages\n`);
		},
	}),
};
