/**
 * project.ts — Project selection and management for the Flowti CLI.
 *
 * Provides the Start Menu (Open/Create) and project-scoped
 * operations. Projects live in "01 - Projects/".
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { getSelectedProject, setSelectedProject } from "../../infrastructure/state.js";
import { runMenu } from "../../infrastructure/menu.js";
import { input } from "../../infrastructure/input.js";
import { RESET, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { scaffold as scaffoldProject, listDefinitions } from "../scaffold/scaffold.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";

// ── Helpers ──────────────────────────────────────────────────────────

export function listProjects(): string[] {
	try {
		return disk.readdirSync(PROJECTS_DIR, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

export function getProjectPath(name: string): string {
	return paths.join(PROJECTS_DIR, name);
}

// ── Open Project ─────────────────────────────────────────────────────

async function openProjectMenu(): Promise<MenuResult> {
	const projects = listProjects();
	const current = getSelectedProject();

	if (projects.length === 0) {
		log(`\n  ${DIM}No project folders found in ${PROJECTS_DIR}${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = projects.map((name, i) => {
		const marker = name === current ? ` ${GREEN}●${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${name}${marker}`,
			action: (): MenuResult => {
				setSelectedProject(name);
				log(`\n  ${GREEN}Selected:${RESET} ${name}\n`);
				return "quit";
			},
		};
	});

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	const result = await runMenu("Open Project", items, { defaultChoice: "1" });
	return result === "quit" ? "quit" : "main";
}

// ── Create Project ──────────────────────────────────────────────────

async function createProjectMenu(): Promise<MenuResult> {
	const name = await input.ask("Project name");

	if (!name) {
		log(`\n  ${DIM}Cancelled.${RESET}\n`);
		return "main";
	}

	const projectPath = paths.join(PROJECTS_DIR, name);
	if (disk.existsSync(projectPath)) {
		log(`\n  ${RED}Project already exists:${RESET} ${name}\n`);
		return "main";
	}

	// Scaffold definitions (declarative JSON-driven)
	const scaffoldDefs = listDefinitions();
	let keyIndex = 1;

	const templateItems: MenuEntry[] = scaffoldDefs.map((def) => ({
		key: String(keyIndex++),
		label: `${def.label}  ${DIM}${def.description}${RESET}`,
		action: (): MenuResult => {
			const result = scaffoldProject({ definitionId: def.id, name, outputDir: projectPath });
			if ("error" in result) {
				log(`\n  ${RED}${result.error}${RESET}\n`);
				return "main";
			}
			log(`\n  ${GREEN}✓${RESET} Created ${result.created} files.\n`);
			return "quit";
		},
	}));

	templateItems.push(
		{
			key: "g",
			label: "From GitHub URL",
			action: () => cloneFromGitHub(projectPath, name),
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	const result = await runMenu(`Create Project: ${name}`, templateItems);
	if (result === "quit") {
		setSelectedProject(name);
		log(`  ${GREEN}Selected:${RESET} ${name}\n`);
	}
	return result === "quit" ? "quit" : "main";
}

async function cloneFromGitHub(projectPath: string, name: string): Promise<MenuResult> {
	const url = await input.ask("GitHub URL");

	if (!url) {
		log(`\n  ${DIM}Cancelled.${RESET}\n`);
		return "main";
	}

	log(`\n  ${CYAN}▸${RESET} Cloning ${url}...\n`);
	const code = shell.run(`git clone "${url}" "${projectPath}"`);
	if (code !== 0) {
		log(`\n  ${RED}Clone failed.${RESET} Check the URL and try again.\n`);
		return "main";
	}
	log(`\n  ${GREEN}✓${RESET} Cloned into ${name}.\n`);
	return "quit";
}

// ── Start Menu ──────────────────────────────────────────────────────

export async function startMenu(): Promise<"selected" | "quit"> {
	const startItems: MenuEntry[] = [
		{ key: "1", label: "Open Project", action: openProjectMenu },
		{ key: "2", label: "Create Project", action: createProjectMenu },
		{ separator: true },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	while (true) {
		const current = getSelectedProject();
		const result = await runMenu("Start Menu", startItems, {
			beforeMenu: () => {
				if (current) {
					log(`  ${DIM}Current project: ${CYAN}${current}${RESET}\n`);
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
