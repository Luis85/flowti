/**
 * capture-loader.ts — Capture types loader.
 *
 * Returns the static list of available capture types.
 */

import type { LoaderContext } from "./loader-types.js";

export interface CaptureData {
	readonly types: readonly string[];
}

export function loadCapture(_ctx: LoaderContext): CaptureData {
	try {
		return { types: ["idea", "task", "bug", "note", "documentation"] };
	} catch { return { types: [] }; }
}
