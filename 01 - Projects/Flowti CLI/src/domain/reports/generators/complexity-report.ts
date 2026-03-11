/**
 * generate-complexity-report.ts
 *
 * Pure helper functions for complexity report generation.
 */

import type { ComplexityFunction } from "../cli/complexity-analyzer.js";

export function computeDistribution(entries: ComplexityFunction[]): Record<string, number> {
	const vals: number[] = entries.map((e) => e.complexity);
	return {
		"1-5": vals.filter((v) => v >= 1 && v <= 5).length,
		"6-10": vals.filter((v) => v >= 6 && v <= 10).length,
		"11-20": vals.filter((v) => v >= 11 && v <= 20).length,
		"21-50": vals.filter((v) => v >= 21 && v <= 50).length,
		"51+": vals.filter((v) => v >= 51).length,
	};
}

