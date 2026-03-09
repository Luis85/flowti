/**
 * component-list.ts — Browse and list components in a project.
 *
 * Scans docs/components/ for Markdown files with YAML frontmatter
 * to discover existing components and their metadata.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { runMenu } from "../../../infrastructure/menu.js";
import { parseFrontmatterStrings } from "../../../infrastructure/frontmatter.js";
import { log } from "../../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN } from "../../../infrastructure/ui.js";
import type { MenuEntry, MenuResult, ComponentsConfig } from "../../../infrastructure/types.js";
import type { ProjectComponent, ComponentKind } from "./component-types.js";
import { COMPONENT_KINDS } from "./component-types.js";
import { isStorybookInstalled, installStorybook, runStorybookDev, runStorybookBuild } from "./storybook-service.js";

// ── Component discovery ─────────────────────────────────────────────

const COMPONENTS_DIR = "docs/components";

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

// ── Component browser menu ──────────────────────────────────────────

const KIND_LABELS: Record<ComponentKind, string> = {
  component: "Component",
  "ui-component": "UI Component",
  layout: "Layout",
  page: "Page",
  system: "System",
  container: "Container",
  "c4-component": "C4 Component",
  person: "Person",
};

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

export async function componentListMenu(projectRoot: string, componentsConfig?: ComponentsConfig): Promise<MenuResult> {
	const components = listProjectComponents(projectRoot);
	const config = componentsConfig ?? {};

	if (components.length === 0) {
		log(`\n  ${DIM}No components found in ${COMPONENTS_DIR}/${RESET}`);
		log(`  ${DIM}Use Make → Add Component to create one.${RESET}\n`);
	} else {
		log(`\n  ${BOLD}${components.length} component(s)${RESET}\n`);
	}

	const tree = buildComponentTree(components);
	const items: MenuEntry[] = tree.map(({ component: c, depth }, i) => {
		const kindLabel = KIND_LABELS[c.kind] ?? c.kind;
		const statusColor = c.status === "active" ? GREEN : DIM;
		const indent = depth > 0 ? "  ".repeat(depth) + "└ " : "";
		return {
			key: String(i + 1),
			label: `${indent}${c.name}  ${DIM}${kindLabel}${RESET}  ${statusColor}${c.status}${RESET}`,
			action: () => {
				showComponentDetail(projectRoot, c, components);
				return "main" as const;
			},
		};
	});

	// Storybook items (conditional on opt-in, dynamically gated)
	if (config.storybook) {
		const projectName = paths.basename(projectRoot);
		const sbInstalled = () => isStorybookInstalled(projectRoot, config);
		items.push(
			{ separator: true },
			{
				key: "i",
				label: "Install Storybook",
				action: () => { installStorybook(projectRoot, projectName, config); },
				disabled: sbInstalled,
				disabledMessage: "\n  Storybook is already installed.\n",
			},
			{
				key: "s",
				label: "Storybook dev",
				action: () => { runStorybookDev(projectRoot, config); },
				disabled: () => !sbInstalled(),
				disabledMessage: "\n  Storybook not installed. Use \"Install Storybook\" first.\n",
			},
			{
				key: "k",
				label: "Storybook build",
				action: () => { runStorybookBuild(projectRoot, config); },
				disabled: () => !sbInstalled(),
				disabledMessage: "\n  Storybook not installed. Use \"Install Storybook\" first.\n",
			},
		);
	}

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return runMenu("Components", items);
}

function showComponentDetail(projectRoot: string, component: ProjectComponent, allComponents: ProjectComponent[]): void {
	log();
	log(`  ${BOLD}${component.name}${RESET}`);
	log(`    Type:     ${KIND_LABELS[component.kind] ?? component.kind}`);
	log(`    Status:   ${component.status}`);
	if (component.c4Level != null) log(`    C4 Level: ${component.c4Level}`);

	// Ancestry path (only when component has a parent)
	if (component.containedBy) {
		const ancestry = buildAncestryPath(component, allComponents);
		log(`    Path:     ${ancestry}`);
	}

	// Children
	const children = component.contains ?? allComponents.filter((c) => c.containedBy === component.name).map((c) => c.name);
	if (children.length > 0) {
		log(`    Children: ${children.join(", ")}`);
	}

	// Siblings
	const siblings = findSiblings(component, allComponents);
	if (siblings.length > 0) {
		log(`    Siblings: ${siblings.map((c) => c.name).join(", ")}`);
	}

	log(`    Doc:      ${component.path}`);

	// Check for definition JSON
	const defPath = paths.join(projectRoot, "src", "components", component.name, `${component.name}.json`);
	if (disk.existsSync(defPath)) {
		log(`    Def:      src/components/${component.name}/${component.name}.json`);
	}

	// Check for test file
	const testPath = paths.join(projectRoot, "tests", "components", `${component.name}.test.ts`);
	if (disk.existsSync(testPath)) {
		log(`    Test:     tests/components/${component.name}.test.ts`);
	}

	log();
}
