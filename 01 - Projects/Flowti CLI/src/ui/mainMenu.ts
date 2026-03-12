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
 *   Make, Build, Review, Publish
 *   ──────────────────────────
 *   Components, Reporting
 *   ──────────────────────────
 *   Project Management, Requirements Management, Documentation, Knowledgebase, README, Info
 *   ──────────────────────────
 *   Dev Tools
 *   ──────────────────────────
 *   Back, Help, Quit
 */

import { menu as makeMenu } from "./menus/make-menu.js";
import { componentListMenu } from "./menus/component-list-menu.js";
import { publishMenu } from "./menus/publish-menu.js";
import { reviewMenu } from "./menus/review-menu.js";
import { showInfo } from "./info-display.js";
import { showHelp } from "./help.js";
import { captureIdea, captureNote, captureBug } from "./menus/capture-menu.js";
import { shell } from "../infrastructure/shell.js";
import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { clock } from "../infrastructure/clock.js";
import { log as logFn } from "../infrastructure/logger.js";
import { isKnowledgebaseAvailable } from "../domain/knowledgebase/knowledgebase.js";
import { knowledgebaseMenu } from "./menus/knowledgebase-menu.js";
import { buildWithReport } from "../domain/reports/cli/generate-build-report.js";
import { getReportsDir } from "../domain/project/project-config.js";
import {
	buildReportsSubmenu,
	buildDocsSubmenu,
	buildDevToolsSubmenu,
} from "./menu-builders.js";
import { input } from "../infrastructure/input.js";
import { getSelectedProject } from "../infrastructure/state.js";
import { initializeProject } from "../domain/project/project-config.js";
import type { MenuEntry } from "../infrastructure/types.js";
import { detectTools, hasTool } from "../domain/project/tool-availability.js";

// ── Public: build full menu for current project ─────────────────────

export function buildProjectDetailMenu(): MenuEntry[] {
	const projectName = getSelectedProject();
	if (!projectName) return buildFallbackMenu();

	const ctx = initializeProject(projectName, { disk, paths });
	const tools = detectTools(ctx.path, { disk, paths });

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
		const buildCmd = ctx.config.build?.commands?.["fast"];
		const hasEsbuild = hasTool(tools, "esbuild");
		const hasTsc = hasTool(tools, "typescript");
		if (buildCmd && (hasEsbuild || hasTsc)) {
			items.push({
				key: "5",
				label: "Build",
				action: async () => {
					buildWithReport(buildCmd, ctx.path, { disk, paths, clock, shell, log: logFn });
					await input.waitForEnter();
					return "main" as const;
				},
			});
		} else {
			const reason = !buildCmd
				? "No build command configured. Add build.commands.fast to flowti.config.json."
				: "Missing esbuild or typescript. Run: npm install -D esbuild typescript";
			items.push({
				key: "5",
				label: "Build",
				action: () => "main" as const,
				disabled: true,
				disabledMessage: `\n  ${reason}\n`,
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

	items.push({ separator: true });

	// ── Components & Reporting ───────────────────────────────────────

	items.push({
		key: "c",
		label: "Components",
		action: () => componentListMenu(ctx.path, ctx.config.components),
	});

	items.push({
		key: "8",
		label: "Reporting",
		action: async () => {
			const { runMenu } = await import("../infrastructure/menu.js");
			const generators = ctx.config.reports?.generators ?? [];
			const reportsDir = getReportsDir(ctx.path, ctx.config, { paths });
			await runMenu("reports", buildReportsSubmenu(generators, ctx.path, reportsDir));
			return "main" as const;
		},
	});

	items.push({ separator: true });

	// ── Project management ───────────────────────────────────────────

	items.push({
		key: "m",
		label: "Project Management",
		action: async () => {
			const { managementMenu } = await import("./menus/management-menu.js");
			return managementMenu(ctx);
		},
	});

	items.push({
		key: "e",
		label: "Requirements Management",
		action: async () => {
			const { requirementsMenu } = await import("./menus/requirements-menu.js");
			return requirementsMenu(ctx.path, ctx.config.management?.requirements);
		},
	});

	{
		const docsConfig = ctx.config.docs;
		items.push({
			key: "d",
			label: "Documentation",
			action: async () => {
				const { runMenu } = await import("../infrastructure/menu.js");
				const configGens = docsConfig?.generators ?? [];
				const references = docsConfig?.references ?? [];
				await runMenu("documentation", buildDocsSubmenu(configGens, references, ctx.path), { defaultChoice: "1" });
				return "main" as const;
			},
		});
	}

	items.push(
		{
			key: "k",
			label: "Knowledgebase",
			action: knowledgebaseMenu,
			disabled: () => !isKnowledgebaseAvailable({ disk, paths, shell }),
			disabledMessage:
				"\n  Knowledgebase requires Obsidian CLI and an initialized vault.\n",
		},
		{
			key: "r",
			label: "README",
			disabled: () => !disk.existsSync(paths.join(ctx.path, "README.md")),
			disabledMessage: "\n  No README.md found. Run `flowti readme` to generate one.\n",
			action: async () => {
				const content = disk.readFileSync(paths.join(ctx.path, "README.md"), "utf-8");
				logFn(`\n${content}`);
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
