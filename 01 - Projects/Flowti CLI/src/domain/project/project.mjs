/**
 * project.mjs — Project selection for the Flowti CLI.
 *
 * Lists folders inside the configured projects directory and lets the
 * user pick one as the active project. Selection persists across runs.
 */

import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR } from "../../infrastructure/config.mjs";
import { getSelectedProject, setSelectedProject } from "../../infrastructure/state.mjs";
import { runMenu } from "../../infrastructure/menu.mjs";
import { RESET, DIM, GREEN } from "../../infrastructure/ui.mjs";

/**
 * Returns sorted folder names inside the projects directory.
 * @returns {string[]}
 */
export function listProjects() {
	try {
		return fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/**
 * Returns the absolute path for a project folder.
 * @param {string} name
 * @returns {string}
 */
export function getProjectPath(name) {
	return path.join(PROJECTS_DIR, name);
}

/**
 * Interactive project selection menu.
 * Saves the selection and returns the project name.
 * @returns {Promise<string>}
 */
export async function projectSelectionMenu() {
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
			action: () => {
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
	project: () => projectSelectionMenu(),
};
