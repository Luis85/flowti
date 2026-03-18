/**
 * storybook.controller.ts — Non-interactive CLI commands for Storybook.
 *
 * Provides storybook:install, storybook:start, storybook:stop, storybook:build,
 * storybook:generate, storybook:scaffold, storybook:import.
 */

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
import { getFramework, setFramework } from "../domain/make/component/storybook-settings.js";
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
	const srcDir = deps.paths.resolve(projectPath, sourcePath);
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

	"storybook:scaffold": adaptDescriptor<{ sitemap: string; framework: string }, StorybookScaffoldResultModel>({
		flags: {
			sitemap: {
				type: "string",
				required: true,
				hint: "--sitemap=<path>",
			},
			framework: {
				type: "string",
				required: true,
				hint: "--framework=react|vue|angular|lit|cli-app",
				choices: [...SCAFFOLD_FRAMEWORKS],
			},
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			return scaffoldStorybookFromSitemap(ctx.flags.sitemap, ctx.flags.framework, { disk, paths });
		},
		renderer: renderStorybookScaffoldResult,
	}),

	"storybook:import": adaptDescriptor<{ output: string; source: string }, StorybookImportResultModel>({
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
		},
		handler: (ctx) => {
			const sourcePath = ctx.flags.source || ctx.project!.config.components?.markdownSource?.path;
			if (!sourcePath) {
				return { componentCount: 0, skippedCount: 0, warnings: [], outputPath: "", configured: false };
			}
			return runMarkdownImport(ctx.project!.path, sourcePath, ctx.project!.config.components?.markdownSource, ctx.flags.output, ctx.deps);
		},
		renderer: renderStorybookImportResult,
	}),
};
