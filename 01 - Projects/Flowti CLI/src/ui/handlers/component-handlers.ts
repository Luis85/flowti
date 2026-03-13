/**
 * component-handlers.ts — Action handlers for the components and
 * component-detail hybrid views.
 *
 * These handlers are referenced by sitemap items and resolved by the
 * router when building hybrid-view sitemapSlots. Each handler
 * independently loads its data from ctx.project / ctx.params.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { VAULT_ROOT } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, YELLOW } from "../../infrastructure/ui.js";
import type { ComponentFramework } from "../../infrastructure/types.js";

function listDeps() { return { disk, paths } as const; }

// ── Registration ────────────────────────────────────────────────────

export function registerComponentHandlers(registry: HandlerRegistry): void {
	// ── Components view action handlers ─────────────────────────────

	registry.registerAction("comp:add", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentMenu } = await import("../menus/component-makers-menu.js");
		await componentMenu(ctx.project.path);
		return undefined;
	});

	registry.registerAction("comp:regen-dirty", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listProjectComponents, detectDirtyComponents } = await import("../../domain/make/component/component-list.js");
		const { regenerateComponent } = await import("../../domain/make/component/component-commands.js");
		const { getFramework } = await import("../../domain/make/component/storybook-settings.js");
		const { getFrameworkPackages } = await import("../../domain/make/component/storybook-service.js");
		const components = listProjectComponents(ctx.project.path, listDeps());
		detectDirtyComponents(ctx.project.path, components, listDeps());
		const dirty = components.filter((c) => c.isDirty);
		if (dirty.length === 0) { log(`\n  No dirty components found.\n`); await input.waitForEnter(); return undefined; }
		log(`\n  ${BOLD}${dirty.length} dirty component(s):${RESET}`);
		for (const c of dirty) log(`    ${YELLOW}*${RESET} ${c.name}`);
		log();
		const confirmed = await input.askYesNo("Regenerate all dirty components?");
		if (!confirmed) { log(`\n  ${DIM}Cancelled.${RESET}\n`); await input.waitForEnter(); return undefined; }
		log();
		let total = 0;
		const framework = getFramework(ctx.project.path, listDeps());
		const fw = getFrameworkPackages(framework);
		for (const c of dirty) {
			const result = regenerateComponent(c.name, ctx.project.path, { disk, paths, clock }, c.domain, fw.framework);
			if (result.success) {
				total += result.filesWritten; c.isDirty = false;
				log(`  ${GREEN}✓${RESET} ${c.name}  ${DIM}${result.filesWritten} file(s)${RESET}`);
			} else {
				log(`  ${YELLOW}skip${RESET}  ${c.name}: ${result.error}`);
			}
		}
		log(`\n  ${GREEN}Regenerated ${total} file(s) across ${dirty.length} component(s).${RESET}\n`);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-install", async (ctx) => {
		if (!ctx.project) return undefined;
		const { isStorybookInstalled, installStorybook } = await import("../../domain/make/component/storybook-service.js");
		const { setFramework } = await import("../../domain/make/component/storybook-settings.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		const config = ctx.project.config.components ?? {};
		if (isStorybookInstalled(ctx.project.path, config, listDeps())) {
			log(`\n  Storybook is already installed.\n`); await input.waitForEnter(); return undefined;
		}
		log(`\n  ${BOLD}Select framework:${RESET}\n`);
		const choices: { key: string; label: string; value: ComponentFramework }[] = [
			{ key: "1", label: "HTML (vanilla)", value: "html" },
			{ key: "2", label: "Angular", value: "angular" },
		];
		for (const c of choices) log(`    ${c.key}) ${c.label}`);
		log();
		const choice = await input.ask("Framework (1/2)", "1");
		const selected = choices.find((c) => c.key === choice);
		if (!selected) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return undefined; }
		setFramework(ctx.project.path, selected.value, listDeps());
		const projectName = paths.basename(ctx.project.path);
		installStorybook(ctx.project.path, projectName, { ...config, framework: selected.value }, { disk, paths, shell, input }, createStorybookRenderer());
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-start", async (ctx) => {
		if (!ctx.project) return undefined;
		const { isStorybookInstalled, isStorybookRunning, runStorybookDev } = await import("../../domain/make/component/storybook-service.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		const config = ctx.project.config.components ?? {};
		if (!isStorybookInstalled(ctx.project.path, config, listDeps()) || isStorybookRunning()) {
			log(`\n  Storybook not installed or already running.\n`); await input.waitForEnter(); return undefined;
		}
		await runStorybookDev(ctx.project.path, config, VAULT_ROOT, { disk, paths, shell, input }, createStorybookRenderer());
		if (!isStorybookRunning()) await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-stop", async (_ctx) => {
		const { isStorybookRunning, stopStorybook } = await import("../../domain/make/component/storybook-service.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		if (!isStorybookRunning()) { log(`\n  Storybook is not running.\n`); await input.waitForEnter(); return undefined; }
		stopStorybook(createStorybookRenderer());
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-build", async (ctx) => {
		if (!ctx.project) return undefined;
		const { isStorybookInstalled, runStorybookBuild } = await import("../../domain/make/component/storybook-service.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		const config = ctx.project.config.components ?? {};
		if (!isStorybookInstalled(ctx.project.path, config, listDeps())) {
			log(`\n  Storybook not installed. Use "Install Storybook" first.\n`); await input.waitForEnter(); return undefined;
		}
		runStorybookBuild(ctx.project.path, config, { disk, paths, shell }, createStorybookRenderer());
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:data-providers", async (ctx) => {
		if (!ctx.project) return undefined;
		const { dataProviderMenu } = await import("../menus/component-submenus.js");
		await dataProviderMenu(ctx.project.path);
		return undefined;
	});

	registry.registerAction("comp:action-ref", async (_ctx) => {
		const { actionReferenceMenu } = await import("../menus/action-reference-menu.js");
		await actionReferenceMenu();
		return undefined;
	});

	// ── Component-detail view action handlers ───────────────────────

	registry.registerAction("comp-detail:edit-fields", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editFieldsMenu } = await import("../menus/component-detail-menu.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		await editFieldsMenu(ctx.project.path, componentName, instance, domain);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-props", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editPropertiesMenu } = await import("../menus/component-detail-menu.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		await editPropertiesMenu(ctx.project.path, componentName, instance, domain);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-actions", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editActionsMenu } = await import("../menus/component-detail-menu.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		await editActionsMenu(ctx.project.path, componentName, instance, domain);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-children", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editChildrenMenu } = await import("../menus/component-editor-menus.js");
		const { listProjectComponents } = await import("../../domain/make/component/component-list.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		const allComponents = listProjectComponents(ctx.project.path, listDeps());
		await editChildrenMenu(ctx.project.path, componentName, instance, allComponents, domain);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-stores", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editStoresMenu } = await import("../menus/component-editor-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		await editStoresMenu(ctx.project.path, componentName, instance, domain);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-reqs", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editRequirementsMenu } = await import("../menus/component-product-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		await editRequirementsMenu(ctx.project.path, componentName, instance, domain);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-features", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editFeaturesMenu } = await import("../menus/component-product-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		await editFeaturesMenu(ctx.project.path, componentName, instance, domain);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-rels", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editRelationshipsMenu } = await import("../menus/component-product-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, listDeps(), domain);
		if (!instance) return undefined;
		await editRelationshipsMenu(ctx.project.path, componentName, instance, domain);
		return undefined;
	});
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractComponentParams(ctx: { params?: Readonly<Record<string, unknown>> }): {
	componentName: string | undefined;
	domain: string | undefined;
} {
	return {
		componentName: ctx.params?.componentName as string | undefined,
		domain: ctx.params?.domain as string | undefined,
	};
}
