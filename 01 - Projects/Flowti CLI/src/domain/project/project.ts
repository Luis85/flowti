/**
 * project.ts — Project domain facade.
 *
 * Pure domain helpers for project discovery and path resolution.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";

/** List all project directory names under the projects root. */
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

/** Resolve the full path for a project by name. */
export function getProjectPath(name: string): string {
	return paths.join(PROJECTS_DIR, name);
}
