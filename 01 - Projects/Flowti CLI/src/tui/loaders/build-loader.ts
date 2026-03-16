/**
 * build-loader.ts — Build info loader.
 *
 * Reads build commands from the project's flowti.config.json.
 */

import type { LoaderContext } from "./loader-types.js";

export interface BuildData {
	readonly commands: readonly string[];
}

export function loadBuild(ctx: LoaderContext): BuildData {
	if (!ctx.projectPath) return { commands: [] };
	try {
		const configPath = ctx.deps.paths.join(ctx.projectPath, "configs", "flowti.config.json");
		if (!ctx.deps.disk.existsSync(configPath)) return { commands: [] };
		const config = JSON.parse(ctx.deps.disk.readFileSync(configPath, "utf-8"));
		const buildCmds = config?.build?.commands ?? {};
		return { commands: Object.keys(buildCmds) };
	} catch { return { commands: [] }; }
}
