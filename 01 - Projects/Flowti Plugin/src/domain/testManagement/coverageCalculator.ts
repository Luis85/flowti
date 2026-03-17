/**
 * Coverage calculator — pure functions.
 *
 * Computes PRD-to-journey coverage by matching on domain or explicit prd field.
 * Produces coverage entries with gap analysis.
 */

import type { CoverageEntry, CoverageStatus, JourneyRegistryEntry } from "./types";

/** Input shape for PRD data (minimal — no full PRD type dependency). */
export interface PrdInfo {
	name: string;
	stage: string;
	domain: string;
}

/** Compute coverage entries for all PRDs against registered journeys. */
export function computeCoverage(prds: PrdInfo[], journeys: JourneyRegistryEntry[]): CoverageEntry[] {
	return prds.map((prd) => {
		const linked = findLinkedJourneys(prd, journeys);
		return {
			prdName: prd.name,
			prdStage: prd.stage,
			domain: prd.domain,
			journeyCount: linked.length,
			journeyNames: linked.map((j) => j.name),
			status: deriveCoverageStatus(linked),
		};
	});
}

/** Compute domain-level coverage summary. */
export function computeDomainCoverage(
	entries: CoverageEntry[],
): Record<string, { total: number; covered: number }> {
	const result: Record<string, { total: number; covered: number }> = {};
	for (const entry of entries) {
		const domain = entry.domain || "unknown";
		if (!result[domain]) result[domain] = { total: 0, covered: 0 };
		result[domain].total++;
		if (entry.status === "covered") result[domain].covered++;
	}
	return result;
}

/** Find coverage gaps: uncovered PRDs that are in-progress or done. */
export function findGaps(entries: CoverageEntry[]): CoverageEntry[] {
	return entries.filter(
		(e) => e.status === "uncovered" && (e.prdStage === "in-progress" || e.prdStage === "done"),
	);
}

// ── Helpers ──────────────────────────────────────────────────

function findLinkedJourneys(prd: PrdInfo, journeys: JourneyRegistryEntry[]): JourneyRegistryEntry[] {
	return journeys.filter((j) => {
		// Explicit PRD link takes priority
		if (j.prd && j.prd === prd.name) return true;
		// Fall back to domain matching
		if (j.domain && j.domain === prd.domain) return true;
		return false;
	});
}

function deriveCoverageStatus(linked: JourneyRegistryEntry[]): CoverageStatus {
	if (linked.length === 0) return "uncovered";

	const hasPassingJourney = linked.some((j) => {
		const latest = j.lastRunResult ?? j.runHistory[j.runHistory.length - 1];
		return latest && latest.failed === 0;
	});

	return hasPassingJourney ? "covered" : "partial";
}
