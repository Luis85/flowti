/**
 * plugins-loader.ts — Plugins info loader.
 *
 * Simple availability check for plugin management.
 */

import type { LoaderContext } from "./loader-types.js";

export interface PluginsData {
	readonly available: boolean;
}

export function loadPlugins(ctx: LoaderContext): PluginsData {
	try {
		return { available: ctx.projectPath !== undefined };
	} catch { return { available: false }; }
}
