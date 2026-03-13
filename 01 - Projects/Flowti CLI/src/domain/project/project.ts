/**
 * project.ts — Project domain facade.
 *
 * Pure domain helpers for project discovery and path resolution.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

/** List all project directory names under the projects root. */
export function listProjects(projectsDir: string, deps: Pick<CliDeps, "disk">): string[] {
	try {
		return deps.disk.readdirSync(projectsDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/** Resolve the full path for a project by name. */
export function getProjectPath(name: string, projectsDir: string, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(projectsDir, name);
}
