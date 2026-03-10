/**
 * component-list-menu.ts — Interactive component browser menu.
 *
 * Moved from domain/make/component/component-list.ts to separate
 * display/input concerns from pure domain logic.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN } from "../../infrastructure/ui.js";
import type { MenuEntry, MenuResult, ComponentsConfig } from "../../infrastructure/types.js";
import type { ProjectComponent, ComponentKind } from "../../domain/make/component/component-types.js";
import {
	listProjectComponents,
	buildComponentTree,
	buildAncestryPath,
	findSiblings,
	COMPONENTS_DIR,
} from "../../domain/make/component/component-list.js";
import { isStorybookInstalled, installStorybook, runStorybookDev, runStorybookBuild, isStorybookRunning, stopStorybook } from "../../domain/make/component/storybook-service.js";
import { componentMenu } from "./component-makers-menu.js";

// ── Kind labels ─────────────────────────────────────────────────────

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

// ── Component detail view ───────────────────────────────────────────

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

// ── Component browser menu ──────────────────────────────────────────

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

	// Add component
	items.push(
		{ separator: true },
		{ key: "c", label: "Add Component", action: async () => {
			await componentMenu(projectRoot);
			return "main" as const;
		}},
	);

	// Storybook items — always available, gated by installation status
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
			label: "Start Storybook",
			action: async () => { await runStorybookDev(projectRoot, config); },
			disabled: () => !sbInstalled() || isStorybookRunning(),
			disabledMessage: "\n  Storybook not installed or already running.\n",
		},
		{
			key: "x",
			label: "Stop Storybook",
			action: () => { stopStorybook(); },
			disabled: () => !isStorybookRunning(),
			disabledMessage: "\n  Storybook is not running.\n",
		},
		{
			key: "k",
			label: "Storybook build",
			action: () => { runStorybookBuild(projectRoot, config); },
			disabled: () => !sbInstalled(),
			disabledMessage: "\n  Storybook not installed. Use \"Install Storybook\" first.\n",
		},
	);

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return runMenu("Components", items);
}
