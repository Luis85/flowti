/**
 * projects-list-loader.ts — Lists available managed projects.
 */

import type { LoaderContext } from "./loader-types.js";

export interface ProjectListItem {
	readonly name: string;
	readonly path: string;
}

export function loadProjectsList(ctx: LoaderContext): readonly ProjectListItem[] {
	const { deps, projectsDir } = ctx;
	try {
		if (!deps.disk.existsSync(projectsDir)) return [];
		return deps.disk.readdirSync(projectsDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => ({
				name: e.name,
				path: deps.paths.join(projectsDir, e.name),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	} catch {
		return [];
	}
}
