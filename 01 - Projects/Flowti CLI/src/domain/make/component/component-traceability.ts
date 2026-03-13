/**
 * component-traceability.ts — Requirements traceability for components.
 *
 * Joins component data with requirement data to produce a traceability
 * matrix showing which requirements are covered by which components.
 */

import type { ProjectComponent } from "./component-types.js";
import type { RequirementSummary } from "../../requirements/requirement-types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface TraceabilityRow {
	requirementId: string;
	requirementName: string;
	components: string[];
	coverage: "full" | "partial" | "none";
}

export interface TraceabilityMatrix {
	rows: TraceabilityRow[];
	linkedRequirements: number;
	unlinkedRequirements: number;
	unlinkedComponents: number;
}

// ── Public API ───────────────────────────────────────────────────────

/** Build a traceability matrix joining components and requirements. */
export function buildTraceabilityMatrix(
	components: ProjectComponent[],
	requirements: RequirementSummary[],
): TraceabilityMatrix {
	const reqToComponents = new Map<string, string[]>();

	for (const comp of components) {
		for (const reqId of comp.requirements ?? []) {
			const list = reqToComponents.get(reqId) ?? [];
			list.push(comp.name);
			reqToComponents.set(reqId, list);
		}
	}

	const rows: TraceabilityRow[] = requirements.map((req) => {
		const linkedComponents = reqToComponents.get(req.id) ?? [];
		return {
			requirementId: req.id,
			requirementName: req.name,
			components: linkedComponents,
			coverage: linkedComponents.length > 0 ? "full" : "none",
		};
	});

	const linkedRequirements = rows.filter((r) => r.coverage !== "none").length;
	const unlinkedComponents = components.filter(
		(c) => !c.requirements || c.requirements.length === 0,
	).length;

	return {
		rows,
		linkedRequirements,
		unlinkedRequirements: rows.length - linkedRequirements,
		unlinkedComponents,
	};
}

/** Find requirements that no component references. */
export function findUnlinkedRequirements(
	components: ProjectComponent[],
	requirements: RequirementSummary[],
): RequirementSummary[] {
	const linkedIds = new Set<string>();
	for (const comp of components) {
		for (const reqId of comp.requirements ?? []) {
			linkedIds.add(reqId);
		}
	}
	return requirements.filter((r) => !linkedIds.has(r.id));
}

/** Find components that have no requirement links. */
export function findUnlinkedComponents(components: ProjectComponent[]): ProjectComponent[] {
	return components.filter((c) => !c.requirements || c.requirements.length === 0);
}
