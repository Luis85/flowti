/**
 * start-handlers.ts — Action handlers for the Start Menu.
 *
 * Provides openProjectHandler and createProjectHandler for the sitemap router.
 */

import { runMenu } from "../../infrastructure/menu.js";
import { input } from "../../infrastructure/input.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { getSelectedProject, setSelectedProject } from "../../infrastructure/state.js";
import { listProjects, getProjectPath } from "../../domain/project/project.js";
import { scaffold as scaffoldProject, listDefinitions } from "../../domain/scaffold/scaffold.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";

/** Open project menu — list projects, set selected. Returns "quit" if project selected. */
export async function openProjectHandler(): Promise<MenuResult> {
	const projects = listProjects({ disk });
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
	// "quit" from inner menu means "project selected" — return "main" to let
	// the router detect the selection and auto-navigate to project-detail.
	return result === "quit" ? "main" : "main";
}

/** Create project menu — ask name, pick template, scaffold. Returns "quit" if created. */
export async function createProjectHandler(): Promise<MenuResult> {
	const name = await input.ask("Project name");

	if (!name) {
		log(`\n  ${DIM}Cancelled.${RESET}\n`);
		return "main";
	}

	const projectPath = getProjectPath(name, { paths });
	if (disk.existsSync(projectPath)) {
		log(`\n  ${RED}Project already exists:${RESET} ${name}\n`);
		return "main";
	}

	const scaffoldDefs = listDefinitions();
	let keyIndex = 1;

	const templateItems: MenuEntry[] = scaffoldDefs.map((def) => ({
		key: String(keyIndex++),
		label: `${def.label}  ${DIM}${def.description}${RESET}`,
		action: (): MenuResult => {
			const result = scaffoldProject({ disk, paths }, { definitionId: def.id, name, outputDir: projectPath });
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
			label: "Load Git Project from Remote",
			action: async () => {
				const url = await input.ask("Git remote URL");
				if (!url) {
					log(`\n  ${DIM}Cancelled.${RESET}\n`);
					return "main";
				}
				log(`\n  ${CYAN}▸${RESET} Adding submodule ${url}...\n`);
				const code = shell.run(`git submodule add "${url}" "${projectPath}"`);
				if (code !== 0) {
					log(`\n  ${RED}Submodule add failed.${RESET} Check the URL and try again.\n`);
					return "main";
				}
				log(`\n  ${GREEN}✓${RESET} Added ${name} as submodule.\n`);
				return "quit";
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	const result = await runMenu(`Create Project: ${name}`, templateItems);
	if (result === "quit") {
		setSelectedProject(name);
		log(`  ${GREEN}Selected:${RESET} ${name}\n`);
	}
	// "quit" means "project created" — return "main" to let the router auto-navigate.
	return "main";
}

export default openProjectHandler;
