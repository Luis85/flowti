/**
 * mainMenu.ts — Dynamic project detail menu for the Flowti CLI.
 *
 * Builds menu items from the project's flowti.config.json tool mappings,
 * package.json scripts, and static utilities. Submenu construction is
 * delegated to menu-builders.ts for readability.
 *
 * Layout:
 *   Capture (Idea, Note, Bug)
 *   ──────────────────────────
 *   Make, Build, Review, Publish, Reports
 *   ──────────────────────────
 *   Documentation, Npm Scripts, Knowledgebase, Health, Info
 *   ──────────────────────────
 *   Components, Events, Scaffold, Dependencies, Dev Tools, Export HTML
 *   ──────────────────────────
 *   Back, Help, Quit
 */

import { menu as makeMenu } from "../domain/make/make.js";
import { componentListMenu } from "../domain/make/component/component-list.js";
import { publishMenu } from "../domain/publish/project-publish.js";
import { reviewMenu } from "../domain/review/project-review.js";
import { showInfo } from "../domain/info/info.js";
import { collectHealth } from "../domain/health/health.js";
import { displayHealth } from "./health-display.js";
import { showHelp } from "./help.js";
import { captureIdea, captureNote, captureBug } from "../domain/capture/capture.js";
import { eventCatalogMenu } from "../domain/events/events.js";
import {
	knowledgebaseMenu,
	isKnowledgebaseAvailable,
} from "../domain/knowledgebase/knowledgebase.js";
import { buildWithReport } from "../domain/reports/cli/generate-build-report.js";
import { getReportsDir } from "../domain/project/project-config.js";
import {
	buildReportsSubmenu,
	buildDocsSubmenu,
	buildDevToolsSubmenu,
	buildDepsSubmenu,
} from "./menu-builders.js";
import { input } from "../infrastructure/input.js";
import { getSelectedProject } from "../infrastructure/state.js";
import { initializeProject } from "../domain/project/project-config.js";
import type { MenuEntry } from "../infrastructure/types.js";

// ── Public: build full menu for current project ─────────────────────

export function buildProjectDetailMenu(): MenuEntry[] {
	const projectName = getSelectedProject();
	if (!projectName) return buildFallbackMenu();

	const ctx = initializeProject(projectName);

	const items: MenuEntry[] = [];

	// ── Capture ──────────────────────────────────────────────────────

	items.push(
		{ key: "1", label: "Capture Idea", action: captureIdea },
		{ key: "2", label: "Capture Note", action: captureNote },
		{ key: "3", label: "Capture Bug", action: captureBug },
	);

	items.push({ separator: true });

	// ── Core workflow ────────────────────────────────────────────────

	items.push({
		key: "4",
		label: "Make",
		action: () => makeMenu(ctx.path),
	});

	{
		const buildCmd = ctx.config.build?.commands?.["fast"] ?? ctx.config.tools?.["build"];
		if (buildCmd) {
			items.push({
				key: "5",
				label: "Build",
				action: async () => {
					buildWithReport(buildCmd, ctx.path);
					await input.waitForEnter();
					return "main" as const;
				},
			});
		} else {
			items.push({
				key: "5",
				label: "Build",
				action: () => "main" as const,
				disabled: true,
				disabledMessage:
					'\n  Build is not mapped. Add build.commands.fast or tools.build to flowti.config.json.\n',
			});
		}
	}

	items.push({
		key: "6",
		label: "Review",
		action: () => reviewMenu(ctx.path, ctx.config.review ?? {}),
	});

	items.push({
		key: "7",
		label: "Publish",
		action: () => publishMenu(ctx.path, ctx.config.publish ?? {}),
	});

	items.push({
		key: "8",
		label: "Reporting",
		action: async () => {
			const { runMenu } = await import("../infrastructure/menu.js");
			const generators = ctx.config.reports?.generators ?? [];
			const reportsDir = getReportsDir(ctx.path, ctx.config);
			await runMenu("reports", buildReportsSubmenu(generators, ctx.path, reportsDir));
			return "main" as const;
		},
	});

	items.push({ separator: true });

	// ── Project management ───────────────────────────────────────────

	{
		const docsConfig = ctx.config.docs;
		items.push({
			key: "d",
			label: "Update Documentation",
			action: async () => {
				const { runMenu } = await import("../infrastructure/menu.js");
				const configGens = docsConfig?.generators ?? [];
				const allCmd = docsConfig?.allCommand;
				await runMenu("documentation", buildDocsSubmenu(configGens, allCmd, ctx.path), { defaultChoice: "1" });
				return "main" as const;
			},
		});
	}

	items.push(
		{
			key: "k",
			label: "Knowledgebase",
			action: knowledgebaseMenu,
			disabled: () => !isKnowledgebaseAvailable(),
			disabledMessage:
				"\n  Knowledgebase requires Obsidian CLI and an initialized vault.\n",
		},
		{
			key: "h",
			label: "Health",
			action: async () => {
				const health = collectHealth(ctx);
				displayHealth(health);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "i",
			label: "Info",
			action: async () => {
				showInfo();
				await input.waitForEnter();
				return "main" as const;
			},
		},
	);

	items.push({ separator: true });

	// ── Advanced tools ───────────────────────────────────────────────

	items.push(
		{
			key: "e",
			label: "Events",
			action: () => eventCatalogMenu(ctx.path),
		},
		{
			key: "c",
			label: "Components",
			action: () => componentListMenu(ctx.path, ctx.config.components),
		},
		{
			key: "g",
			label: "Dependencies",
			action: async () => {
				const { runMenu } = await import("../infrastructure/menu.js");
				await runMenu("dependencies", buildDepsSubmenu(ctx.path));
				return "main" as const;
			},
		},
		{
			key: "t",
			label: "Dev Tools",
			action: async () => {
				const { runMenu } = await import("../infrastructure/menu.js");
				await runMenu("dev tools", buildDevToolsSubmenu(ctx.path, ctx.scripts));
				return "main" as const;
			},
		},
	);

	items.push({ separator: true });

	// ── Navigation ────────────────────────────────────────────────────

	items.push(
		{ key: "b", label: "Back to Start Menu", action: () => "start" as const },
		{
			key: "?",
			label: "Help",
			action: async () => {
				showHelp("main");
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ key: "q", label: "Quit", action: () => "quit" as const },
	);

	return items;
}

// ── Fallback (no project) ───────────────────────────────────────────

function buildFallbackMenu(): MenuEntry[] {
	return [
		{
			key: "i",
			label: "Info",
			action: () => {
				showInfo();
				return "main" as const;
			},
		},
		{
			key: "?",
			label: "Help",
			action: async () => {
				showHelp("main");
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back to Start Menu", action: () => "start" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];
}
