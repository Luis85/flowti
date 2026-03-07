/**
 * project.ts — Project selection for the Flowti CLI.
 *
 * Lists folders inside the configured projects directory and lets the
 * user pick one as the active project. Selection persists across runs.
 */

import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { getSelectedProject, setSelectedProject } from "../../infrastructure/state.js";
import { runMenu } from "../../infrastructure/menu.js";
import { RESET, DIM, GREEN } from "../../infrastructure/ui.js";
import type { MenuResult } from "../../types.js";

export function listProjects(): string[] {
	try {
		return fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

export function getProjectPath(name: string): string {
	return path.join(PROJECTS_DIR, name);
}

export async function projectSelectionMenu(): Promise<string | null> {
	const projects = listProjects();
	const current = getSelectedProject();

	if (projects.length === 0) {
		console.log(`\n  ${DIM}No project folders found in ${PROJECTS_DIR}${RESET}\n`);
		return current;
	}

	const items = projects.map((name, i) => {
		const marker = name === current ? ` ${GREEN}●${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${name}${marker}`,
			action: (): MenuResult => {
				setSelectedProject(name);
				console.log(`\n  ${GREEN}Selected:${RESET} ${name}\n`);
				return "main";
			},
		};
	});

	await runMenu("Select Project", items, { defaultChoice: "1" });
	return getSelectedProject();
}

// ── CLI commands ────────────────────────────────────────────────────

export const commands = {
	project: async () => { await projectSelectionMenu(); },
};
