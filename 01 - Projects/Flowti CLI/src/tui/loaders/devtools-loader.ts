/**
 * devtools-loader.ts — Developer tools info loader.
 *
 * Returns a static list of available developer tools.
 */

import type { LoaderContext } from "./loader-types.js";

export interface DevtoolsData {
	readonly tools: readonly string[];
}

export function loadDevtools(_ctx: LoaderContext): DevtoolsData {
	try {
		return { tools: ["rebuild", "reload-plugin", "test-data", "lint-check"] };
	} catch { return { tools: [] }; }
}
