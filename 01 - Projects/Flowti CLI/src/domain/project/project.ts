/**
 * project.ts — Project selection and management for the Flowti CLI.
 *
 * Provides the Start Menu (Load/Create/Import) and project-scoped
 * operations. Projects live in "01 - Projects/", imports come from
 * the "Development/" folder.
 */

import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR, DEVELOPMENT_DIR } from "../../infrastructure/config.js";
import { getSelectedProject, setSelectedProject } from "../../infrastructure/state.js";
import { runMenu } from "../../infrastructure/menu.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { RESET, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import type { MenuEntry, MenuResult } from "../../types.js";

// ── Helpers ──────────────────────────────────────────────────────────

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

function listDevelopmentProjects(): string[] {
	try {
		return fs.readdirSync(DEVELOPMENT_DIR, { withFileTypes: true })
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

// ── Load Project ────────────────────────────────────────────────────

async function loadProjectMenu(): Promise<MenuResult> {
	const projects = listProjects();
	const current = getSelectedProject();

	if (projects.length === 0) {
		console.log(`\n  ${DIM}No project folders found in ${PROJECTS_DIR}${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = projects.map((name, i) => {
		const marker = name === current ? ` ${GREEN}●${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${name}${marker}`,
			action: (): MenuResult => {
				setSelectedProject(name, "projects");
				console.log(`\n  ${GREEN}Selected:${RESET} ${name}\n`);
				return "quit";
			},
		};
	});

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	const result = await runMenu("Load Project", items, { defaultChoice: "1" });
	return result === "quit" ? "quit" : "main";
}

// ── Create Project ──────────────────────────────────────────────────

async function createProjectMenu(): Promise<MenuResult> {
	const rl = createRL();
	const name = await ask(rl, "Project name");
	rl.close();

	if (!name) {
		console.log(`\n  ${DIM}Cancelled.${RESET}\n`);
		return "main";
	}

	const projectPath = path.join(PROJECTS_DIR, name);
	if (fs.existsSync(projectPath)) {
		console.log(`\n  ${RED}Project already exists:${RESET} ${name}\n`);
		return "main";
	}

	fs.mkdirSync(projectPath, { recursive: true });
	setSelectedProject(name, "projects");
	console.log(`\n  ${GREEN}Created and selected:${RESET} ${name}\n`);
	return "quit";
}

// ── Import Project (from Development/) ──────────────────────────────

async function importProjectMenu(): Promise<MenuResult> {
	const devProjects = listDevelopmentProjects();

	if (devProjects.length === 0) {
		console.log(`\n  ${DIM}No projects found in ${DEVELOPMENT_DIR}${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = devProjects.map((name, i) => ({
		key: String(i + 1),
		label: name,
		action: (): MenuResult => {
			setSelectedProject(name, "development");
			console.log(`\n  ${GREEN}Imported:${RESET} ${name} ${DIM}(Development/${name})${RESET}\n`);
			return "quit";
		},
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	const result = await runMenu("Import from Development", items, { defaultChoice: "1" });
	return result === "quit" ? "quit" : "main";
}

// ── Start Menu ──────────────────────────────────────────────────────

export async function startMenu(): Promise<"selected" | "quit"> {
	const startItems: MenuEntry[] = [
		{ key: "1", label: "Load Project", action: loadProjectMenu },
		{ key: "2", label: "Create Project", action: createProjectMenu },
		{ key: "3", label: "Import Project", action: importProjectMenu },
		{ separator: true },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const current = getSelectedProject();
		const result = await runMenu("Start Menu", startItems, {
			beforeMenu: () => {
				if (current) {
					console.log(`  ${DIM}Current project: ${CYAN}${current}${RESET}\n`);
				}
			},
		});
		if (result === "quit") {
			if (getSelectedProject()) return "selected";
			return "quit";
		}
	}
}

// ── CLI commands ────────────────────────────────────────────────────

export const commands = {
	project: async () => { await startMenu(); },
};
