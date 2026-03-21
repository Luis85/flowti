/**
 * task-scoring.ts — Attribute-based task fit scoring using RPG stats.
 */

const DOMAIN_ATTRIBUTE_MAP: Record<string, string> = {
	engineering: "int",
	analysis: "int",
	design: "cha",
	product: "wis",
	management: "cha",
	quality: "wis",
	operations: "con",
	orchestration: "cha",
};

/**
 * Score how well an agent's RPG attributes match a task's domain.
 * Returns a value in [0, 100]. Baseline is 50 (no domain info).
 * Each point of primary attribute above 10 adds +5, below 10 subtracts 5.
 * Energy below 30 halves the score.
 */
export function scoreTaskFit(
	attributes: Partial<Record<string, number>>,
	task: { domain?: string },
	energy?: number,
): number {
	const primaryAttr = task.domain ? DOMAIN_ATTRIBUTE_MAP[task.domain] : undefined;
	let score = 50;
	if (primaryAttr && attributes[primaryAttr]) {
		score += (attributes[primaryAttr]! - 10) * 5;
	}
	if (energy !== undefined && energy < 30) {
		score *= 0.5;
	}
	return Math.max(0, Math.min(100, score));
}
