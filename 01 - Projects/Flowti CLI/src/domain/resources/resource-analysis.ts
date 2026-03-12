/**
 * resource-analysis.ts — Financial analysis for project resources.
 *
 * Pure functions that compute budget, consumption, and burn rate from resource summaries.
 */

import type { ResourceType } from "../../infrastructure/types.js";
import type { ResourceSummary, FinancialSummary } from "./resource-types.js";

const RESOURCE_TYPES: ResourceType[] = ["human", "material", "role", "budget"];

/** Compute a financial summary from a list of resource summaries. */
export function analyzeFinancials(resources: ResourceSummary[]): FinancialSummary {
	const byType = Object.fromEntries(
		RESOURCE_TYPES.map((t) => [t, { budget: 0, consumed: 0 }]),
	) as Record<ResourceType, { budget: number; consumed: number }>;

	let totalBudget = 0;
	let totalConsumed = 0;

	for (const r of resources) {
		const bucket = byType[r.resourceType] ?? byType.human;
		bucket.budget += r.totalCost;
		bucket.consumed += r.consumedCost;
		totalBudget += r.totalCost;
		totalConsumed += r.consumedCost;
	}

	return {
		totalBudget,
		totalConsumed,
		totalRemaining: totalBudget - totalConsumed,
		byType,
		burnRate: totalBudget > 0 ? totalConsumed / totalBudget : 0,
	};
}
