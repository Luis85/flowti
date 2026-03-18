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
	srcDir: string,
	deps: { disk: Pick<IFileSystem, "readdirSync" | "readFileSync">; paths: Pick<IPaths, "join"> },
): Record<string, Record<string, unknown>> {
	const entries = deps.disk.readdirSync(srcDir, { withFileTypes: true });
	const mdFiles: Record<string, Record<string, unknown>> = {};

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const content = deps.disk.readFileSync(deps.paths.join(srcDir, entry.name), "utf8");
		const fm = parseFrontmatterContent(content);
		if (fm) mdFiles[entry.name] = fm;
	}

	return mdFiles;
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

	"storybook:import": adaptDescriptor<{ output: string }, StorybookImportResultModel>({
		requires: "project",
		flags: {
			output: {
				type: "string",
				required: false,
				hint: "--output=<path>",
			},
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const config = ctx.project!.config.components;
			const mdSource = config?.markdownSource;

			if (!mdSource?.path) {
				return { componentCount: 0, skippedCount: 0, warnings: [], outputPath: "", configured: false };
			}

			const srcDir = paths.resolve(ctx.project!.path, mdSource.path);
			const strategy = mdSource.strategy ?? "category";
			const requiredFields = mdSource.requiredFields ?? ["name", "category", "description", "props", "slots", "variants", "status"];

			const mdFiles = scanMarkdownFrontmatter(srcDir, { disk, paths });
			const { valid, warnings } = validateComponents(mdFiles, requiredFields);
			const sitemap = generateSitemapFromMarkdown(valid, strategy);

			const storybookDir = config?.storybookDir ?? "components";
			const outputPath = ctx.flags.output || paths.join(ctx.project!.path, storybookDir, "sitemap.json");
			const outputDir = paths.dirname(outputPath);
			if (!disk.existsSync(outputDir)) disk.mkdirSync(outputDir, { recursive: true });
			disk.writeFileSync(outputPath, JSON.stringify(sitemap, null, "\t") + "\n", "utf8");

			return {
				componentCount: valid.length,
				skippedCount: warnings.length,
				warnings: warnings.map((w) => ({ file: w.file, reason: w.reason })),
				outputPath,
				configured: true,
			};
		},
		renderer: renderStorybookImportResult,
	}),
};
