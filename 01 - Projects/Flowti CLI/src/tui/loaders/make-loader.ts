/**
 * make-loader.ts — Make templates loader.
 *
 * Lists available make templates from the make service.
 */

import type { LoaderContext } from "./loader-types.js";
import { getAvailableTemplates } from "../../domain/make/make-service.js";

export interface MakeData {
	readonly templates: readonly string[];
}

export function loadMake(ctx: LoaderContext): MakeData {
	if (!ctx.projectPath) return { templates: [] };
	try {
		const templates = getAvailableTemplates(ctx.projectPath, ctx.deps);
		return { templates };
	} catch { return { templates: [] }; }
}
