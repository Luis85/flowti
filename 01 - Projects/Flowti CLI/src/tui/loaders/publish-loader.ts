/**
 * publish-loader.ts — Publish endpoints loader.
 *
 * Reads publish endpoints from the project's flowti.config.json.
 */

import type { LoaderContext } from "./loader-types.js";

export interface PublishData {
	readonly endpoints: readonly string[];
}

export function loadPublish(ctx: LoaderContext): PublishData {
	if (!ctx.projectPath) return { endpoints: [] };
	try {
		const configPath = ctx.deps.paths.join(ctx.projectPath, "configs", "flowti.config.json");
		if (!ctx.deps.disk.existsSync(configPath)) return { endpoints: [] };
		const config = JSON.parse(ctx.deps.disk.readFileSync(configPath, "utf-8"));
		const endpoints = config?.publish?.endpoints ?? {};
		return { endpoints: Object.keys(endpoints) };
	} catch { return { endpoints: [] }; }
}
