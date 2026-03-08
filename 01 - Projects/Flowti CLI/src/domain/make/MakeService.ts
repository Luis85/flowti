/**
 * MakeService.ts — Make domain orchestrator.
 *
 * Manages template registry, available templates, and the interactive make menu.
 */

import { DIM, RESET } from "../../infrastructure/ui.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import { readProjectConfig } from "../project/project-config.js";
import { log } from "../../infrastructure/logger.js";
import type { MenuEntry, MenuResult, MakeTemplateId } from "../../infrastructure/types.js";
import { makeHub, makePlugin, makeApp, makeCliApp, makeJourney } from "./makers.js";

// ── Template registry ───────────────────────────────────────────────

const TEMPLATE_DEFS: Record<MakeTemplateId, { label: string; action: (root: string) => Promise<void> }> = {
	hub: { label: "New Hub", action: makeHub },
	plugin: { label: "New Plugin (standalone Obsidian plugin)", action: makePlugin },
	app: { label: "New Application (DDD Obsidian plugin)", action: makeApp },
	cli: { label: "New CLI App (Node.js ESM)", action: makeCliApp },
	journey: { label: "New E2E Journey", action: makeJourney },
};

const ALL_TEMPLATES: MakeTemplateId[] = ["hub", "plugin", "app", "cli", "journey"];

export function getAvailableTemplates(projectRoot: string): MakeTemplateId[] {
	const cfg = readProjectConfig(projectRoot);
	return cfg?.make?.templates ?? ALL_TEMPLATES;
}

// ── Interactive menu ────────────────────────────────────────────────

export async function menu(projectRoot: string): Promise<MenuResult> {
	const available = getAvailableTemplates(projectRoot);

	if (available.length === 0) {
		log(`\n  ${DIM}No Make templates configured for this project.${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = available.map((id, i) => {
		const def = TEMPLATE_DEFS[id];
		return { key: String(i + 1), label: def.label, action: () => def.action(projectRoot) };
	});

	items.push(
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("make"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	);

	return runMenu("Make", items);
}
