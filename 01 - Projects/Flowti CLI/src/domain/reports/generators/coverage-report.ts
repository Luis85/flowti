/**
 * generate-coverage-report.ts
 *
 * Pure helper functions for coverage report generation.
 */

interface CoverageEntry {
	s?: Record<string, number>;
	b?: Record<string, number[]>;
	f?: Record<string, number>;
}

export function collectCovCounts(entry: CoverageEntry, kind: string): number[] {
	if (kind === "statements") return Object.values(entry.s ?? {});
	if (kind === "branches") return Object.values(entry.b ?? {}).flat();
	return Object.values(entry.f ?? {});
}

export function computeCoverage(entries: CoverageEntry[], kind: string): number {
	let covered = 0;
	let total = 0;

	for (const entry of entries) {
		for (const v of collectCovCounts(entry, kind)) {
			total++;
			if (v > 0) covered++;
		}
	}

	if (total === 0) return 0;
	return Math.round((covered / total) * 10000) / 100;
}
