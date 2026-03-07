/**
 * project.ts — Project selection and management for the Flowti CLI.
 *
 * Provides the Start Menu (Load/Create/Import) and project-scoped
 * operations. Projects live in "01 - Projects/", imports come from
 * the "Development/" folder.
 */

import { disk } from "../../infrastructure/filesystem.js";
import path from "node:path";
import { shell } from "../../infrastructure/shell.js";
import { PROJECTS_DIR, DEVELOPMENT_DIR } from "../../infrastructure/config.js";
import { getSelectedProject, setSelectedProject } from "../../infrastructure/state.js";
import { runMenu } from "../../infrastructure/menu.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { RESET, DIM, GREEN, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import { PROJECT_TEMPLATES, PROJECT_TEMPLATE_IDS } from "../make/make.js";
import type { MenuEntry, MenuResult } from "../../types.js";
import type { ProjectTemplateId } from "../make/make.js";
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

function listDevelopmentProjects(): string[] {
	try {
		return disk.readdirSync(DEVELOPMENT_DIR, { withFileTypes: true })
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
		log(`\n  ${DIM}No project folders found in ${PROJECTS_DIR}${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = projects.map((name, i) => {
		const marker = name === current ? ` ${GREEN}●${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${name}${marker}`,
			action: (): MenuResult => {
				setSelectedProject(name, "projects");
				log(`\n  ${GREEN}Selected:${RESET} ${name}\n`);
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
		log(`\n  ${DIM}Cancelled.${RESET}\n`);
		return "main";
	}

	const projectPath = path.join(PROJECTS_DIR, name);
	if (disk.existsSync(projectPath)) {
		log(`\n  ${RED}Project already exists:${RESET} ${name}\n`);
		return "main";
	}

	// Template selection
	const templateItems: MenuEntry[] = PROJECT_TEMPLATE_IDS.map((id, i) => ({
		key: String(i + 1),
		label: PROJECT_TEMPLATES[id].label,
		action: (): MenuResult => {
			scaffoldFromTemplate(id, projectPath, name);
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
		setSelectedProject(name, "projects");
		log(`  ${GREEN}Selected:${RESET} ${name}\n`);
	}
	return result === "quit" ? "quit" : "main";
}

function scaffoldFromTemplate(templateId: ProjectTemplateId, projectPath: string, name: string): void {
	disk.mkdirSync(projectPath, { recursive: true });
	log(`\n  ${BOLD}Scaffolding:${RESET} ${name}\n`);
	PROJECT_TEMPLATES[templateId].scaffold(projectPath, name);
}

async function cloneFromGitHub(projectPath: string, name: string): Promise<MenuResult> {
	const rl = createRL();
	const url = await ask(rl, "GitHub URL");
	rl.close();

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

// ── Import Project (from Development/) ──────────────────────────────

async function importProjectMenu(): Promise<MenuResult> {
	const devProjects = listDevelopmentProjects();

	if (devProjects.length === 0) {
		log(`\n  ${DIM}No projects found in ${DEVELOPMENT_DIR}${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = devProjects.map((name, i) => ({
		key: String(i + 1),
		label: name,
		action: (): MenuResult => {
			setSelectedProject(name, "development");
			log(`\n  ${GREEN}Imported:${RESET} ${name} ${DIM}(Development/${name})${RESET}\n`);
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
