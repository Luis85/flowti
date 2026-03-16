/**
 * iteration-detail-loader.ts — Single iteration detail loader.
 */

import type { LoaderContext } from "./loader-types.js";
import { findIteration } from "../../domain/iterations/iteration-store.js";

export interface IterationDetailData {
	readonly found: boolean;
	readonly name: string;
	readonly number: number;
	readonly status: string;
	readonly goal: string;
	readonly startDate: string;
	readonly endDate: string;
	readonly scopeDone: number;
	readonly scopeTotal: number;
	readonly scopeItems: readonly { text: string; done: boolean }[];
	readonly agents: readonly string[];
}

export function loadIterationDetail(ctx: LoaderContext): IterationDetailData {
	const { deps, projectPath, params } = ctx;
	const iterNum = parseInt(params.number ?? "0", 10);
	const empty: IterationDetailData = { found: false, name: "", number: iterNum, status: "", goal: "", startDate: "", endDate: "", scopeDone: 0, scopeTotal: 0, scopeItems: [], agents: [] };

	if (!projectPath || !iterNum) return empty;

	try {
		const iter = findIteration(deps, projectPath, iterNum);
		if (!iter) return empty;

		const scopeItems = iter.scopeItems.map((s) => ({ text: s.text, done: s.done }));
		const agents = iter.agents.map((a) => typeof a === "string" ? a : a.name ?? String(a));

		return {
			found: true,
			name: iter.name,
			number: iter.number,
			status: iter.status,
			goal: iter.goal,
			startDate: iter.startDate,
			endDate: iter.endDate,
			scopeDone: scopeItems.filter((s) => s.done).length,
			scopeTotal: scopeItems.length,
			scopeItems,
			agents,
		};
	} catch {
		return empty;
	}
}
