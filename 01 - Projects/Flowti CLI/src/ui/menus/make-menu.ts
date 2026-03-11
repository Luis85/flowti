/**
 * make-menu.ts — Interactive Make menu.
 *
 * Moved from domain/make/make-service.ts to separate display/input
 * concerns from pure domain logic.
 */

import { DIM, RESET } from "../../infrastructure/ui.js";
import { runMenu } from "../../infrastructure/menu.js";
import { input } from "../../infrastructure/input.js";
import { showHelp } from "../help.js";
import { log } from "../../infrastructure/logger.js";
import type { MenuEntry, MenuResult, MakeTemplateId } from "../../infrastructure/types.js";
import { getAvailableTemplates } from "../../domain/make/make-service.js";
import { makeJourney } from "./make-makers.js";
import { componentMenu } from "./component-makers-menu.js";

// ── Template registry ───────────────────────────────────────────────

const TEMPLATE_DEFS: Record<MakeTemplateId, { label: string; action: (root: string) => Promise<void | MenuResult> }> = {
	journey: { label: "New E2E Journey", action: makeJourney },
	component: { label: "Add Component", action: componentMenu },
};

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
		{ key: "?", label: "Help", action: async () => { showHelp("make"); await input.waitForEnter(); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	);

	return runMenu("Make", items);
}
