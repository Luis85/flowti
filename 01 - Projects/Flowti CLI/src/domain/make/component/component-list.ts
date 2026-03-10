/**
 * component-list.ts — Pure domain logic for component discovery and relationships.
 *
 * Scans docs/components/ for Markdown files with YAML frontmatter
 * to discover existing components and their metadata.
 *
 * Interactive browser menu moved to src/ui/menus/component-list-menu.ts.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { parseFrontmatterStrings } from "../../../infrastructure/frontmatter.js";
import type { ProjectComponent, ComponentKind } from "./component-types.js";
import { COMPONENT_KINDS } from "./component-types.js";

// ── Component discovery ─────────────────────────────────────────────

export const COMPONENTS_DIR = "docs/components";

export function listProjectComponents(projectRoot: string): ProjectComponent[] {
	const componentsDir = paths.join(projectRoot, COMPONENTS_DIR);
	if (!disk.existsSync(componentsDir)) return [];

	const files = disk.readdirSync(componentsDir).filter((f) => f.endsWith(".md"));
	const components: ProjectComponent[] = [];

	for (const file of files) {
		try {
			const content = disk.readFileSync(paths.join(componentsDir, file), "utf-8");
			const fm = parseFrontmatterStrings(content);
			const name = file.replace(/\.md$/, "");
			const component: ProjectComponent = {
				name: fm.name ?? name,
				kind: (COMPONENT_KINDS.includes(fm.type as ComponentKind) ? fm.type : "component") as ComponentKind,
				status: fm.status ?? "unknown",
				path: paths.join(COMPONENTS_DIR, file),
			};
			if (fm.c4Level) component.c4Level = Number(fm.c4Level);
			if (fm.containedBy) component.containedBy = fm.containedBy;
			components.push(component);
		} catch { /* skip unreadable */ }
	}

	const sorted = components.sort((a, b) => a.name.localeCompare(b.name));
	enrichComponentRelationships(sorted);
	return sorted;
}

// ── Relationship enrichment ──────────────────────────────────────────

/**
 * Populates the `contains[]` property on each component by reversing
 * the `containedBy` relationship. Mutates the input array in place.
 */
export function enrichComponentRelationships(components: ProjectComponent[]): void {
	const childrenMap = new Map<string, string[]>();
	for (const comp of components) {
		if (comp.containedBy) {
			const list = childrenMap.get(comp.containedBy) ?? [];
			list.push(comp.name);
			childrenMap.set(comp.containedBy, list);
		}
	}
	for (const comp of components) {
		comp.contains = childrenMap.get(comp.name) ?? [];
	}
}

/**
 * Builds the full ancestry path for a component (e.g. "System > Container > Component").
 */
export function buildAncestryPath(component: ProjectComponent, allComponents: ProjectComponent[]): string {
	const byName = new Map(allComponents.map((c) => [c.name, c]));
	const parts: string[] = [];
	let current: ProjectComponent | undefined = component;
	const visited = new Set<string>();
	while (current) {
		if (visited.has(current.name)) break;
		visited.add(current.name);
		parts.unshift(current.name);
		current = current.containedBy ? byName.get(current.containedBy) : undefined;
	}
	return parts.join(" > ");
}

/**
 * Finds sibling components (same parent, excluding self).
 */
export function findSiblings(component: ProjectComponent, allComponents: ProjectComponent[]): ProjectComponent[] {
	return allComponents.filter(
		(c) => c.name !== component.name && c.containedBy === component.containedBy,
	);
}

// ── Tree ordering ────────────────────────────────────────────────────

/** C4 level sort priority (lower = higher in tree). Non-C4 kinds sort last. */
const C4_SORT_ORDER: Record<string, number> = {
	system: 1,
	container: 2,
	"c4-component": 3,
	person: 4,
};

/**
 * Builds a display-ordered list of components with indentation depth.
 * C4 entities are grouped by containment: systems first, then their
 * containers, then their components. Non-C4 components follow at the end.
 */
export function buildComponentTree(components: ProjectComponent[]): { component: ProjectComponent; depth: number }[] {
	const c4 = components.filter((c) => C4_SORT_ORDER[c.kind] != null);
	const nonC4 = components.filter((c) => C4_SORT_ORDER[c.kind] == null);

	// Sort C4 by level, then alphabetically
	c4.sort((a, b) => (C4_SORT_ORDER[a.kind] ?? 99) - (C4_SORT_ORDER[b.kind] ?? 99) || a.name.localeCompare(b.name));

	// Build parent→children map
	const childrenOf = new Map<string, ProjectComponent[]>();
	const roots: ProjectComponent[] = [];
	for (const comp of c4) {
		if (comp.containedBy) {
			const siblings = childrenOf.get(comp.containedBy) ?? [];
			siblings.push(comp);
			childrenOf.set(comp.containedBy, siblings);
		} else {
			roots.push(comp);
		}
	}

	// DFS to flatten tree with depth
	const result: { component: ProjectComponent; depth: number }[] = [];
	function walk(node: ProjectComponent, depth: number): void {
		result.push({ component: node, depth });
		const children = childrenOf.get(node.name) ?? [];
		for (const child of children) walk(child, depth + 1);
	}
	for (const root of roots) walk(root, 0);

	// Orphaned C4 entries (containedBy references a non-existent parent)
	const placed = new Set(result.map((r) => r.component.name));
	for (const comp of c4) {
		if (!placed.has(comp.name)) result.push({ component: comp, depth: 0 });
	}

	// Non-C4 components at the end (flat)
	for (const comp of nonC4) result.push({ component: comp, depth: 0 });

	return result;
}
