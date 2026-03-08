/**
 * plans.ts — Pure plan-building functions for scaffolding.
 *
 * Each function takes validated inputs and returns a FileEntry[] — the list
 * of files to create.  No I/O, no prompts, no side effects.
 */

import { manifestTemplate, packageTemplate, tsconfigTemplate, esbuildTemplate, vitestTemplate, gitignoreTemplate } from "./templates/config.js";
import { pluginMainTemplate } from "./templates/plugin.js";
import { appMainTemplate, appEventBusTemplate, appEventTypesTemplate, appEventsTemplate, appErrorTypesTemplate, appCssTemplate, appObsidianStubTemplate, appEventBusTestTemplate } from "./templates/app.js";
import { cliMainTemplate, cliMainTestTemplate } from "./templates/cli.js";
import { journeyDefinitionTemplate, journeyTestTemplate, journeyCanvasTemplate } from "./templates/journey.js";

export interface FileEntry {
	path: string;
	content: string;
}

export interface PluginPlanInput {
	name: string;
	pluginId: string;
	author: string;
}

export function buildPluginPlan(input: PluginPlanInput): FileEntry[] {
	const { name, pluginId, author } = input;
	return [
		{ path: "manifest.json", content: manifestTemplate({ id: pluginId, name, author }) },
		{ path: "package.json", content: packageTemplate("plugin", name, pluginId) },
		{ path: "tsconfig.json", content: tsconfigTemplate("plugin") },
		{ path: "esbuild.config.mjs", content: esbuildTemplate(pluginId) },
		{ path: ".gitignore", content: gitignoreTemplate("plugin") },
		{ path: "src/main.ts", content: pluginMainTemplate(name) },
		{ path: "css/00-base.css", content: `/* ── Base styles for ${name} ── */\n` },
		{ path: "src/infrastructure/events/.gitkeep", content: "" },
		{ path: "src/domain/.gitkeep", content: "" },
		{ path: "src/ui/.gitkeep", content: "" },
		{ path: "tests/.gitkeep", content: "" },
	];
}

export interface AppPlanInput {
	name: string;
	appId: string;
	author: string;
	pascal: string;
}

export function buildAppPlan(input: AppPlanInput): FileEntry[] {
	const { name, appId, author, pascal } = input;
	return [
		{ path: "manifest.json", content: manifestTemplate({ id: appId, name, author }) },
		{ path: "package.json", content: packageTemplate("app", name, appId) },
		{ path: "tsconfig.json", content: tsconfigTemplate("app") },
		{ path: "esbuild.config.mjs", content: esbuildTemplate(appId) },
		{ path: "vitest.config.ts", content: vitestTemplate("app") },
		{ path: ".gitignore", content: gitignoreTemplate("app") },
		{ path: "css/00-base.css", content: appCssTemplate(name) },
		{ path: "src/main.ts", content: appMainTemplate(name, pascal) },
		{ path: "src/infrastructure/events/EventBus.ts", content: appEventBusTemplate() },
		{ path: "src/infrastructure/events/types.ts", content: appEventTypesTemplate() },
		{ path: "src/infrastructure/events/events.ts", content: appEventsTemplate() },
		{ path: "src/infrastructure/errors/types.ts", content: appErrorTypesTemplate() },
		{ path: "src/infrastructure/services/.gitkeep", content: "" },
		{ path: "src/domain/.gitkeep", content: "" },
		{ path: "src/ui/.gitkeep", content: "" },
		{ path: "tests/mocks/obsidian-stub.ts", content: appObsidianStubTemplate() },
		{ path: "tests/infrastructure/EventBus.test.ts", content: appEventBusTestTemplate() },
	];
}

export interface CliAppPlanInput {
	name: string;
	appId: string;
}

export function buildCliAppPlan(input: CliAppPlanInput): FileEntry[] {
	const { name, appId } = input;
	return [
		{ path: "package.json", content: packageTemplate("cli", name, appId) },
		{ path: "tsconfig.json", content: tsconfigTemplate("cli") },
		{ path: "vitest.config.ts", content: vitestTemplate("cli") },
		{ path: ".gitignore", content: gitignoreTemplate("cli") },
		{ path: "src/main.ts", content: cliMainTemplate(name) },
		{ path: "tests/main.test.ts", content: cliMainTestTemplate(name) },
	];
}

export interface JourneyPlanInput {
	name: string;
	slug: string;
	description: string;
	journeysDir: string;
	testDir: string;
	testFileNumber: string;
	docsDir: string;
}

export function buildJourneyPlan(input: JourneyPlanInput): FileEntry[] {
	const { name, slug, description, journeysDir, testDir, testFileNumber, docsDir } = input;
	return [
		{ path: `${journeysDir}/${slug}.journey`, content: journeyDefinitionTemplate(name, slug, description) },
		{ path: `${testDir}/${testFileNumber}-journey-${slug}.test.ts`, content: journeyTestTemplate(slug) },
		{ path: `${docsDir}/${name}.canvas`, content: journeyCanvasTemplate(name) },
	];
}

/** Computes the next CSS file number from an existing sorted list of CSS filenames. */
export function computeNextCssNumber(cssFiles: string[]): string {
	const maxNum = cssFiles.reduce((max, f) => {
		const m = f.match(/^(\d+)/);
		return m ? Math.max(max, parseInt(m[1], 10)) : max;
	}, 0);
	return String(maxNum + 1).padStart(2, "0");
}
