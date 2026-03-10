/**
 * report-phases.ts — Dependency-aware generator scheduling.
 *
 * Partitions generators into phases based on dependencies.
 * Phase 1 runs independent generators; Phase 2 runs dependent generators
 * (e.g. status/summary that read other reports' output).
 */

import type { ReportGenerator } from "../../infrastructure/types.js";

// ── Dependency map ──────────────────────────────────────────────────

/**
 * Generator IDs that depend on other generators having run first.
 * Key = generator ID, Value = IDs it depends on.
 */
const DEPENDENCIES: Record<string, string[]> = {
	status: ["test", "coverage", "codebase", "complexity"],
	summary: ["test", "coverage", "codebase", "complexity", "status"],
};

export interface GeneratorPhase {
	phase: number;
	generators: ReportGenerator[];
}

/**
 * Partition generators into ordered phases based on their dependency graph.
 *
 * Phase 0: generators with no dependencies on other generators
 * Phase 1+: generators whose dependencies are all in earlier phases
 *
 * Custom dependencies can override the built-in map.
 */
export function partitionByDependency(
	generators: ReportGenerator[],
	customDeps?: Record<string, string[]>,
): GeneratorPhase[] {
	const deps = customDeps ?? DEPENDENCIES;
	const genIds = new Set(generators.map((g) => g.id ?? g.label.toLowerCase().replace(/\s+/g, "-")));

	// Assign each generator a phase number
	const phases = new Map<string, number>();

	function resolvePhase(id: string, visited: Set<string>): number {
		if (phases.has(id)) return phases.get(id)!;
		if (visited.has(id)) return 0; // circular — break cycle

		visited.add(id);
		const genDeps = deps[id];
		if (!genDeps || genDeps.length === 0) {
			phases.set(id, 0);
			return 0;
		}

		// Only consider deps that are in this run
		const activeDeps = genDeps.filter((d) => genIds.has(d));
		if (activeDeps.length === 0) {
			phases.set(id, 0);
			return 0;
		}

		let maxDepPhase = 0;
		for (const dep of activeDeps) {
			maxDepPhase = Math.max(maxDepPhase, resolvePhase(dep, visited));
		}

		const phase = maxDepPhase + 1;
		phases.set(id, phase);
		return phase;
	}

	for (const gen of generators) {
		const id = gen.id ?? gen.label.toLowerCase().replace(/\s+/g, "-");
		resolvePhase(id, new Set());
	}

	// Group generators by phase
	const phaseMap = new Map<number, ReportGenerator[]>();
	for (const gen of generators) {
		const id = gen.id ?? gen.label.toLowerCase().replace(/\s+/g, "-");
		const phase = phases.get(id) ?? 0;
		if (!phaseMap.has(phase)) phaseMap.set(phase, []);
		phaseMap.get(phase)!.push(gen);
	}

	// Sort by phase number and return
	return [...phaseMap.entries()]
		.sort(([a], [b]) => a - b)
		.map(([phase, gens]) => ({ phase, generators: gens }));
}

/**
 * Collect all unique prerequisites from a set of generators.
 */
export function collectPrerequisites(generators: ReportGenerator[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const gen of generators) {
		for (const prereq of gen.prerequisites ?? []) {
			if (!seen.has(prereq)) {
				seen.add(prereq);
				result.push(prereq);
			}
		}
	}
	return result;
}
