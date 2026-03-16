/**
 * review-loader.ts — Review info loader.
 *
 * Simple availability check based on project path presence.
 */

import type { LoaderContext } from "./loader-types.js";

export interface ReviewData {
	readonly available: boolean;
}

export function loadReview(ctx: LoaderContext): ReviewData {
	try {
		return { available: ctx.projectPath !== undefined };
	} catch { return { available: false }; }
}
