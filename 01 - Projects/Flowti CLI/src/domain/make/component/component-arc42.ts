/**
 * component-arc42.ts — Arc42 architectural views from component data.
 *
 * Maps the C4 model component hierarchy to Arc42 documentation levels
 * and produces structured views for architecture documentation.
 */

import type { ProjectComponent, ComponentKind, Arc42Level, ComponentRelationship } from "./component-types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface Arc42View {
	context: ProjectComponent[];
	containers: Map<string, ProjectComponent[]>;
	components: Map<string, ProjectComponent[]>;
	relationships: Arc42Relationship[];
}

export interface Arc42Relationship {
	from: string;
	to: string;
	type: ComponentRelationship["type"];
	technology?: string;
}

// ── C4 → Arc42 mapping ──────────────────────────────────────────────

const C4_TO_ARC42: Partial<Record<ComponentKind, Arc42Level>> = {
	system: "context",
	container: "container",
	"c4-component": "component",
	person: "context",
};

/** Map a C4 component kind to its Arc42 documentation level. */
export function c4ToArc42Level(kind: ComponentKind): Arc42Level | undefined {
	return C4_TO_ARC42[kind];
}

// ── Public API ───────────────────────────────────────────────────────

/** Build an Arc42 architectural view from component data. */
export function buildArc42View(components: ProjectComponent[]): Arc42View {
	const context: ProjectComponent[] = [];
	const containers = new Map<string, ProjectComponent[]>();
	const componentMap = new Map<string, ProjectComponent[]>();

	for (const comp of components) {
		const level = comp.arc42Level ?? c4ToArc42Level(comp.kind);
		switch (level) {
			case "context":
				context.push(comp);
				break;
			case "container": {
				const parent = comp.containedBy ?? "__root__";
				const list = containers.get(parent) ?? [];
				list.push(comp);
				containers.set(parent, list);
				break;
			}
			case "component": {
				const parent = comp.containedBy ?? "__root__";
				const list = componentMap.get(parent) ?? [];
				list.push(comp);
				componentMap.set(parent, list);
				break;
			}
			default:
				break;
		}
	}

	const relationships = collectRelationships(components);

	return { context, containers, components: componentMap, relationships };
}

// ── Helpers ──────────────────────────────────────────────────────────

function collectRelationships(components: ProjectComponent[]): Arc42Relationship[] {
	const result: Arc42Relationship[] = [];
	for (const comp of components) {
		for (const rel of comp.relationships ?? []) {
			result.push({
				from: comp.name,
				to: rel.target,
				type: rel.type,
				technology: rel.technology,
			});
		}
	}
	return result;
}
