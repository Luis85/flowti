/**
 * Compliance checker — pure functions.
 *
 * Computes compliance scores by checking which ISO characteristics
 * are covered by tagged journeys.
 */

import type { ComplianceCharacteristic, ComplianceScore, IsoStandard } from "./types";

const STANDARDS: IsoStandard[] = ["iso-9001", "iso-27001", "iso-25010"];

/**
 * Check compliance across all standards.
 * Returns one ComplianceScore per standard.
 */
export function checkCompliance(
	characteristics: ComplianceCharacteristic[],
	taggedJourneys: Record<string, string[]>,
): ComplianceScore[] {
	const coveredIds = collectCoveredIds(taggedJourneys);
	return STANDARDS.map((standard) => {
		const forStandard = characteristics.filter((c) => c.standard === standard);
		return computeScore(standard, forStandard, coveredIds);
	});
}

/** Compute compliance score for a single standard. */
export function computeScore(
	standard: string,
	characteristics: ComplianceCharacteristic[],
	coveredIds: Set<string>,
): ComplianceScore {
	const total = characteristics.length;
	if (total === 0) return { standard, total: 0, covered: 0, percentage: 0, gaps: [] };

	const gaps: string[] = [];
	let covered = 0;
	for (const c of characteristics) {
		if (coveredIds.has(c.id)) {
			covered++;
		} else {
			gaps.push(c.id);
		}
	}

	return {
		standard,
		total,
		covered,
		percentage: Math.round((covered / total) * 100),
		gaps,
	};
}

/** Return the full ComplianceCharacteristic objects for gap IDs in a score. */
export function getGaps(
	score: ComplianceScore,
	definitions: ComplianceCharacteristic[],
): ComplianceCharacteristic[] {
	const gapSet = new Set(score.gaps);
	return definitions.filter((c) => gapSet.has(c.id));
}

// ── Helpers ──────────────────────────────────────────────────

function collectCoveredIds(taggedJourneys: Record<string, string[]>): Set<string> {
	const ids = new Set<string>();
	for (const tags of Object.values(taggedJourneys)) {
		for (const tag of tags) ids.add(tag);
	}
	return ids;
}
