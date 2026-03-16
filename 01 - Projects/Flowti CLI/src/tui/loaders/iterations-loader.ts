/**
 * iterations-loader.ts — Iteration list loader.
 *
 * Fetches all iterations for the current project and maps them
 * to a compact list with scope completion counts.
 */

import type { IterationStatus } from "../../infrastructure/types-config.js";
import type { LoaderContext } from "./loader-types.js";
import { listIterations } from "../../domain/iterations/iteration-store.js";

export interface IterationListItem {
	readonly name: string;
	readonly number: number;
	readonly status: IterationStatus;
	readonly goal: string;
	readonly startDate: string;
	readonly endDate: string;
	readonly scopeDone: number;
	readonly scopeTotal: number;
}

/** Alias for page compatibility. */
export type IterationEntry = IterationListItem;

export interface IterationsData {
	readonly iterations: readonly IterationListItem[];
}

export function loadIterations(ctx: LoaderContext): IterationsData {
	const { deps, projectPath } = ctx;

	if (!projectPath) {
		return { iterations: [] };
	}

	try {
		const allIterations = listIterations(deps, projectPath);
		const iterations: IterationListItem[] = allIterations.map((it) => ({
			name: it.name,
			number: it.number,
			status: it.status,
			goal: it.goal,
			startDate: it.startDate,
			endDate: it.endDate,
			scopeDone: it.scopeItems.filter((s) => s.done).length,
			scopeTotal: it.scopeItems.length,
		}));
		return { iterations };
	} catch {
		return { iterations: [] };
	}
}
