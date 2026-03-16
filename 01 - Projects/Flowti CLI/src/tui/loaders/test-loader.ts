/**
 * test-loader.ts — Test info loader.
 *
 * Reads test presets from the project's flowti.config.json.
 */

import type { LoaderContext } from "./loader-types.js";

export interface TestData {
	readonly presets: readonly string[];
}

export function loadTest(ctx: LoaderContext): TestData {
	if (!ctx.projectPath) return { presets: [] };
	try {
		const configPath = ctx.deps.paths.join(ctx.projectPath, "configs", "flowti.config.json");
		if (!ctx.deps.disk.existsSync(configPath)) return { presets: [] };
		const config = JSON.parse(ctx.deps.disk.readFileSync(configPath, "utf-8"));
		const testCmds = config?.test?.commands ?? {};
		return { presets: Object.keys(testCmds) };
	} catch { return { presets: [] }; }
}
