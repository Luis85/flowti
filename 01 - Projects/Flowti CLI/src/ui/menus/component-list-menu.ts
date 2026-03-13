/**
 * component-list-menu.ts — Interactive component browser menu.
 *
 * Moved from domain/make/component/component-list.ts to separate
 * display/input concerns from pure domain logic.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, YELLOW } from "../../infrastructure/ui.js";
import type { MenuEntry, MenuResult, ComponentsConfig, ComponentFramework } from "../../infrastructure/types.js";
import type { ComponentKind } from "../../domain/make/component/component-types.js";
import {
	listProjectComponents,
	buildComponentTree,
	detectDirtyComponents,
	COMPONENTS_DIR,
} from "../../domain/make/component/component-list.js";
import { regenerateComponent } from "../../domain/make/component/component-commands.js";
import { clock } from "../../infrastructure/clock.js";
import { isStorybookInstalled, installStorybook, runStorybookDev, runStorybookBuild, isStorybookRunning, stopStorybook, getFrameworkPackages } from "../../domain/make/component/storybook-service.js";
import { getFramework, setFramework } from "../../domain/make/component/storybook-settings.js";
import { createStorybookRenderer } from "../storybook-renderer-impl.js";
import { componentMenu } from "./component-makers-menu.js";
import { componentDetailMenu } from "./component-detail-menu.js";
import { actionReferenceMenu } from "./action-reference-menu.js";
import { discoverLibraries } from "../../domain/make/component/component-library.js";
import { libraryMenu, dataProviderMenu } from "./component-submenus.js";
import { sitemapExists, isSitemapDirty, createProjectSitemap, importSitemap, regenerateFromSitemap } from "../../domain/sitemap/sitemap-project.js";

function listDeps() { return { disk, paths } as const; }
function sbDeps() { return { disk, paths, shell, input } as const; }

const sbRender = createStorybookRenderer();

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

// ── Component browser helpers ────────────────────────────────────────

import type { ProjectComponent } from "../../domain/make/component/component-types.js";

function renderComponentListHeader(components: ProjectComponent[], frameworkTag: string): void {
	if (components.length === 0) {
		log(`\n  ${DIM}No components found in ${COMPONENTS_DIR}/${RESET}${frameworkTag}`);
		log(`  ${DIM}Use Make → Add Component to create one.${RESET}\n`);
		return;
	}
	const dirtyCount = components.filter((c) => c.isDirty).length;
	const dirtyNote = dirtyCount > 0 ? `  ${YELLOW}${dirtyCount} dirty${RESET}` : "";
	log(`\n  ${BOLD}${components.length} component(s)${RESET}${dirtyNote}${frameworkTag}\n`);
}

function buildComponentTreeItems(projectRoot: string, components: ProjectComponent[]): MenuEntry[] {
	const tree = buildComponentTree(components);
	return tree.map(({ component: c, depth }, i) => {
		const kindLabel = KIND_LABELS[c.kind] ?? c.kind;
		const statusColor = c.status === "active" ? GREEN : DIM;
		const indent = depth > 0 ? "  ".repeat(depth) + "└ " : "";
		const dirtyTag = c.isDirty ? `  ${YELLOW}*${RESET}` : "";
		const domainTag = c.domain ? `  ${DIM}[${c.domain}]${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${indent}${c.name}  ${DIM}${kindLabel}${RESET}  ${statusColor}${c.status}${RESET}${domainTag}${dirtyTag}`,
			action: async () => { await componentDetailMenu(projectRoot, c, components); },
		};
	});
}

// ── Component browser menu ──────────────────────────────────────────

export async function componentListMenu(projectRoot: string, componentsConfig?: ComponentsConfig): Promise<MenuResult> {
	const config = componentsConfig ?? {};
	let stay = true;
	const projectName = paths.basename(projectRoot);
	const sbInstalled = () => isStorybookInstalled(projectRoot, config, listDeps());
	while (stay) {
		const components = listProjectComponents(projectRoot, listDeps());
		detectDirtyComponents(projectRoot, components, listDeps());

		const framework = getFramework(projectRoot, listDeps());
		const frameworkLabel = FRAMEWORK_LABELS[framework] ?? framework;
		const frameworkTag = sbInstalled() ? `  ${DIM}[${frameworkLabel}]${RESET}` : "";

		renderComponentListHeader(components, frameworkTag);
		const items: MenuEntry[] = buildComponentTreeItems(projectRoot, components);

		items.push(
			{ separator: true },
			{ key: "c", label: "Add Component", action: async () => { await componentMenu(projectRoot); } },
			buildRegenDirtyEntry(projectRoot, components, framework),
		);
		items.push({ key: "a", label: "Action Reference", action: async () => { await actionReferenceMenu(); } });
		items.push(...buildSitemapOpsEntries(projectRoot, projectName));
		items.push(...buildLibraryEntries(projectRoot));
		items.push(...buildStorybookEntries(projectRoot, projectName, config, sbInstalled));
		items.push(
			{ separator: true },
			{ key: "b", label: "Back", action: () => { stay = false; return "main" as const; } },
		);

		const result = await runMenu("Components", items);
		if (result === "main" || result === "quit") { stay = false; return result; }
	}
	return "main";
}

function buildRegenDirtyEntry(projectRoot: string, components: ProjectComponent[], framework: ComponentFramework): MenuEntry {
	return {
		key: "r",
		label: "Regenerate Dirty Components",
		disabled: () => components.filter((c) => c.isDirty).length === 0,
		disabledMessage: "\n  No dirty components found.\n",
		action: async () => {
			const dirty = components.filter((c) => c.isDirty);
			log(`\n  ${BOLD}${dirty.length} dirty component(s):${RESET}`);
			for (const c of dirty) log(`    ${YELLOW}*${RESET} ${c.name}`);
			log();
			const confirmed = await input.askYesNo("Regenerate all dirty components?");
			if (!confirmed) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return; }
			log();
			let total = 0;
			const fw = getFrameworkPackages(framework);
			for (const c of dirty) {
				const result = regenerateComponent(c.name, projectRoot, { disk, paths, clock }, c.domain, fw.framework);
				if (result.success) {
					total += result.filesWritten; c.isDirty = false;
					log(`  ${GREEN}✓${RESET} ${c.name}  ${DIM}${result.filesWritten} file(s)${RESET}`);
				} else {
					log(`  ${YELLOW}skip${RESET}  ${c.name}: ${result.error}`);
				}
			}
			log(`\n  ${GREEN}Regenerated ${total} file(s) across ${dirty.length} component(s).${RESET}\n`);
			await input.waitForEnter();
		},
	};
}

function buildSitemapOpsEntries(projectRoot: string, projectName: string): MenuEntry[] {
	const smDeps = { disk, paths } as const;
	const hasSitemap = sitemapExists(projectRoot, smDeps);
	const smDirty = hasSitemap && isSitemapDirty(projectRoot, smDeps);
	const entries: MenuEntry[] = [{ separator: true }];

	if (!hasSitemap) {
		entries.push({
			key: "sm", label: "Create Sitemap",
			action: async () => {
				const result = createProjectSitemap(projectRoot, projectName, smDeps);
				if (result.created) {
					log(`\n  ${GREEN}Created sitemap at ${result.path}${RESET}`);
					log(`  ${DIM}${result.viewCount} view(s) (home, dashboard, settings)${RESET}\n`);
				} else { log(`\n  ${DIM}Sitemap already exists.${RESET}\n`); }
				await input.waitForEnter();
			},
		});
	} else {
		entries.push({
			key: "sm", label: `Import Sitemap${smDirty ? `  ${YELLOW}(dirty)${RESET}` : ""}`,
			action: async () => {
				const result = importSitemap(projectRoot, smDeps);
				if (result.errors.length > 0) { for (const err of result.errors) log(`  ${YELLOW}${err}${RESET}`); }
				else { log(`\n  ${GREEN}Imported ${result.imported} component(s)${RESET}${result.skipped > 0 ? `, ${DIM}${result.skipped} skipped${RESET}` : ""}\n`); }
				await input.waitForEnter();
			},
		});
	}

	if (smDirty) {
		entries.push({
			key: "sr", label: `Regenerate from Sitemap  ${YELLOW}*${RESET}`,
			action: async () => {
				const confirmed = await input.askYesNo("Regenerate all components from sitemap? This overwrites existing component files.");
				if (!confirmed) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return; }
				const result = regenerateFromSitemap(projectRoot, smDeps);
				if (result.errors.length > 0) { for (const err of result.errors) log(`  ${YELLOW}${err}${RESET}`); }
				else { log(`\n  ${GREEN}Regenerated ${result.imported} component(s)${RESET}\n`); }
				await input.waitForEnter();
			},
		});
	}

	return entries;
}

function buildLibraryEntries(projectRoot: string): MenuEntry[] {
	const libraries = discoverLibraries(projectRoot, { disk, paths, clock });
	if (libraries.length === 0) return [];
	const entries: MenuEntry[] = [{ separator: true }];
	for (const lib of libraries) {
		const totalDefs = lib.definitions.length + lib.scaffoldedCount;
		const pending = lib.definitions.length;
		const label = pending > 0
			? `${lib.name}  ${DIM}${totalDefs} defs${RESET}  ${YELLOW}${pending} pending${RESET}`
			: `${lib.name}  ${DIM}${totalDefs} defs${RESET}  ${GREEN}all imported${RESET}`;
		entries.push({
			key: `l${libraries.indexOf(lib) + 1}`, label,
			action: async () => { await libraryMenu(projectRoot, lib.name); },
		});
	}
	return entries;
}

function buildStorybookEntries(
	projectRoot: string, projectName: string,
	config: ComponentsConfig, sbInstalled: () => boolean,
): MenuEntry[] {
	return [
		{ separator: true },
		{
			key: "i", label: "Install Storybook",
			action: async () => {
				log(`\n  ${BOLD}Select framework:${RESET}\n`);
				const choices: { key: string; label: string; value: ComponentFramework }[] = [
					{ key: "1", label: "HTML (vanilla)", value: "html" },
					{ key: "2", label: "Angular", value: "angular" },
				];
				for (const c of choices) log(`    ${c.key}) ${c.label}`);
				log();
				const choice = await input.ask("Framework (1/2)", "1");
				const selected = choices.find((c) => c.key === choice);
				if (!selected) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return; }
				setFramework(projectRoot, selected.value, listDeps());
				installStorybook(projectRoot, projectName, { ...config, framework: selected.value }, sbDeps(), sbRender);
				await input.waitForEnter();
			},
			disabled: sbInstalled,
			disabledMessage: "\n  Storybook is already installed.\n",
		},
		{
			key: "s", label: "Start Storybook",
			action: async () => {
				await runStorybookDev(projectRoot, config, sbDeps(), sbRender);
				if (!isStorybookRunning()) await input.waitForEnter();
			},
			disabled: () => !sbInstalled() || isStorybookRunning(),
			disabledMessage: "\n  Storybook not installed or already running.\n",
		},
		{
			key: "x", label: "Stop Storybook",
			action: async () => { stopStorybook(sbRender); await input.waitForEnter(); },
			disabled: () => !isStorybookRunning(),
			disabledMessage: "\n  Storybook is not running.\n",
		},
		{ separator: true },
		{ key: "d", label: "Data Providers", action: async () => { await dataProviderMenu(projectRoot); } },
		{
			key: "k", label: "Build Design System",
			action: async () => {
				runStorybookBuild(projectRoot, config, { disk, paths, shell }, sbRender);
				await input.waitForEnter();
			},
			disabled: () => !sbInstalled(),
			disabledMessage: "\n  Storybook not installed. Use \"Install Storybook\" first.\n",
		},
	];
}

// ── Framework labels ────────────────────────────────────────────────

const FRAMEWORK_LABELS: Record<ComponentFramework, string> = {
	html: "HTML (vanilla)",
	angular: "Angular",
	react: "React",
	vue: "Vue",
};
