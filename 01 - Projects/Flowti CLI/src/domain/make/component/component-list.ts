/**
 * component-list.ts — Pure domain logic for component discovery and relationships.
 *
 * Scans components/{name}/{name}.md for Markdown files with YAML frontmatter
 * to discover existing components and their metadata.
 *
 * Interactive browser menu moved to src/ui/menus/component-list-menu.ts.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { parseFrontmatterStrings } from "../../../infrastructure/frontmatter.js";
import type { ProjectComponent, ComponentKind } from "./component-types.js";
import { COMPONENT_KINDS } from "./component-types.js";
import { PROVIDERS_DIR } from "./data-provider.js";

export type ComponentListDeps = Pick<CliDeps, "disk" | "paths">;

// ── Component discovery ─────────────────────────────────────────────

export const COMPONENTS_DIR = "components";

export function listProjectComponents(projectRoot: string, deps: ComponentListDeps): ProjectComponent[] {
	const componentsDir = deps.paths.join(projectRoot, COMPONENTS_DIR);
	if (!deps.disk.existsSync(componentsDir)) return [];

	const subdirs = deps.disk.readdirSync(componentsDir).filter((entry: string) => {
		try {
			if (entry === PROVIDERS_DIR || entry === "node_modules" || entry.startsWith(".")) return false;
			const fullPath = deps.paths.join(componentsDir, entry);
			return deps.disk.statSync(fullPath).isDirectory();
		} catch { return false; }
	});
	const components: ProjectComponent[] = [];

	for (const dir of subdirs) {
		// Try direct component: components/{name}/{name}.md
		const directComponent = tryReadComponent(deps, componentsDir, dir);
		if (directComponent) {
			components.push(directComponent);
			continue;
		}
		// Try domain subfolder: components/{domain}/{name}/{name}.md
		try {
			const domainDir = deps.paths.join(componentsDir, dir);
			const domainEntries = deps.disk.readdirSync(domainDir).filter((entry: string) => {
				try {
					return deps.disk.statSync(deps.paths.join(domainDir, entry)).isDirectory() && !entry.startsWith(".");
				} catch { return false; }
			});
			for (const sub of domainEntries) {
				const comp = tryReadComponent(deps, domainDir, sub, dir);
				if (comp) components.push(comp);
			}
		} catch { /* skip unreadable */ }
	}

	const sorted = components.sort((a, b) => a.name.localeCompare(b.name));
	enrichComponentRelationships(sorted);
	return sorted;
}

function resolveKind(type: string | undefined): ComponentKind {
	return COMPONENT_KINDS.includes(type as ComponentKind) ? type as ComponentKind : "component";
}

function applyOptionalFields(component: ProjectComponent, fm: Record<string, string | undefined>, domain?: string): void {
	if (fm.c4Level) component.c4Level = Number(fm.c4Level);
	if (fm.containedBy) component.containedBy = fm.containedBy;
	if (domain || fm.domain) component.domain = domain ?? fm.domain;
}

function tryReadComponent(
	deps: ComponentListDeps, parentDir: string, dir: string, domain?: string,
): ProjectComponent | null {
	try {
		const mdFile = `${dir}.md`;
		const mdPath = deps.paths.join(parentDir, dir, mdFile);
		if (!deps.disk.existsSync(mdPath)) return null;
		const fm = parseFrontmatterStrings(deps.disk.readFileSync(mdPath, "utf-8"));
		const domainPrefix = domain ? deps.paths.join(COMPONENTS_DIR, domain) : COMPONENTS_DIR;
		const component: ProjectComponent = {
			name: fm.name ?? dir,
			kind: resolveKind(fm.type),
			status: fm.status ?? "unknown",
			path: deps.paths.join(domainPrefix, dir, mdFile),
		};
		applyOptionalFields(component, fm, domain);
		return component;
	} catch { return null; }
}

// ── Dirty detection ─────────────────────────────────────────────────

/** Files that are generated from the definition JSON and should be checked. */
const GENERATED_EXTENSIONS = [".ts", ".test.ts", ".stories.ts", ".md"];

/**
 * Checks whether a component's definition JSON has been modified after any
 * of its generated sibling files. Mutates `isDirty` on each component.
 */
export function detectDirtyComponents(projectRoot: string, components: ProjectComponent[], deps: ComponentListDeps): void {
	for (const comp of components) {
		// Derive the kebab directory name from the component's path
		// (comp.name may be a display name from frontmatter, not the filesystem name)
		const pathParts = comp.path.replace(/\\/g, "/").split("/");
		const kebab = pathParts[pathParts.length - 2]; // components/{kebab}/{kebab}.md
		const compDir = comp.domain
			? deps.paths.join(projectRoot, COMPONENTS_DIR, comp.domain, kebab)
			: deps.paths.join(projectRoot, COMPONENTS_DIR, kebab);
		const jsonPath = deps.paths.join(compDir, `${kebab}.json`);
		if (!deps.disk.existsSync(jsonPath)) continue;

		let jsonMtime: number;
		try { jsonMtime = deps.disk.statSync(jsonPath).mtimeMs; }
		catch { continue; }

		for (const ext of GENERATED_EXTENSIONS) {
			const siblingPath = deps.paths.join(compDir, `${kebab}${ext}`);
			if (!deps.disk.existsSync(siblingPath)) continue;
			try {
				const siblingMtime = deps.disk.statSync(siblingPath).mtimeMs;
				if (jsonMtime > siblingMtime) {
					comp.isDirty = true;
					break;
				}
			} catch { /* skip unreadable */ }
		}
	}
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
