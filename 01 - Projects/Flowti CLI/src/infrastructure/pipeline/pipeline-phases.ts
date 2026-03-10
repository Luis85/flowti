/**
 * pipeline-phases.ts — Generic dependency-aware step scheduling.
 *
 * Partitions pipeline steps into phases based on their declared
 * dependencies. Phase 0 contains independent steps; Phase N contains
 * steps whose dependencies all resolved in phases 0..N-1.
 *
 * Dependencies come from step.dependencies — no hardcoded maps.
 */

import type { PipelineStep, StepPhase } from "./pipeline-types.js";

/**
 * Partition steps into dependency-ordered phases.
 *
 * Steps with no dependencies (or whose dependencies are not in this run)
 * go into phase 0. Steps whose dependencies are all in phase 0 go into
 * phase 1, and so on. Circular dependencies are broken by assigning
 * phase 0 to the cycle participant.
 */
export function resolvePhases(steps: PipelineStep[]): StepPhase[] {
	const stepIds = new Set(steps.map((s) => s.id));
	const phases = new Map<string, number>();

	function resolve(id: string, visited: Set<string>): number {
		if (phases.has(id)) return phases.get(id)!;
		if (visited.has(id)) return 0; // circular — break cycle

		visited.add(id);
		const step = steps.find((s) => s.id === id);
		const deps = step?.dependencies?.filter((d) => stepIds.has(d)) ?? [];

		if (deps.length === 0) {
			phases.set(id, 0);
			return 0;
		}

		let maxDepPhase = 0;
		for (const dep of deps) {
			maxDepPhase = Math.max(maxDepPhase, resolve(dep, visited));
		}

		const phase = maxDepPhase + 1;
		phases.set(id, phase);
		return phase;
	}

	for (const step of steps) {
		resolve(step.id, new Set());
	}

	// Group steps by phase
	const phaseMap = new Map<number, PipelineStep[]>();
	for (const step of steps) {
		const phase = phases.get(step.id) ?? 0;
		if (!phaseMap.has(phase)) phaseMap.set(phase, []);
		phaseMap.get(phase)!.push(step);
	}

	return [...phaseMap.entries()]
		.sort(([a], [b]) => a - b)
		.map(([phase, phaseSteps]) => ({ phase, steps: phaseSteps }));
}

/**
 * Collect all unique prerequisites from a set of steps.
 * Preserves declaration order, deduplicates.
 */
export function collectStepPrerequisites(steps: PipelineStep[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const step of steps) {
		for (const prereq of step.prerequisites ?? []) {
			if (!seen.has(prereq)) {
				seen.add(prereq);
				result.push(prereq);
			}
		}
	}
	return result;
}
