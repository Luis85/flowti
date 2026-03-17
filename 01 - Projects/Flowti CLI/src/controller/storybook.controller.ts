/**
 * storybook.controller.ts — Non-interactive CLI commands for Storybook.
 *
 * Provides storybook:install, storybook:start, storybook:stop, storybook:build, storybook:generate.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ComponentFramework } from "../infrastructure/types.js";
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
	type StorybookInstallResultModel,
	type StorybookStartResultModel,
	type StorybookStopResultModel,
	type StorybookBuildResultModel,
	type StorybookGenerateResultModel,
} from "../ui/renderers/storybook-renderers.js";

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
};
