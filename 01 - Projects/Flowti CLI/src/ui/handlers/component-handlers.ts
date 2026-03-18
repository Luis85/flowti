/**
 * component-handlers.ts — Action handlers for the components and
 * component-detail hybrid views.
 *
 * These handlers are referenced by sitemap items and resolved by the
 * router when building hybrid-view dataSourceEntries. Each handler
 * independently loads its data from ctx.project / ctx.params.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";

import { VAULT_ROOT } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, YELLOW } from "../../infrastructure/ui.js";
import type { ComponentFramework } from "../../infrastructure/types.js";

// ── Registration ────────────────────────────────────────────────────

export function registerComponentHandlers(registry: HandlerRegistry): void {
	// ── Components view action handlers ─────────────────────────────

	registry.registerAction("comp:add", async (ctx) => {
		if (!ctx.project) return undefined;
		const { componentMenu } = await import("../menus/component-makers-menu.js");
		await componentMenu(ctx.project.path, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp:regen-dirty", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, clock, input, log } = ctx.deps;
		const { listProjectComponents, detectDirtyComponents } = await import("../../domain/make/component/component-list.js");
		const { regenerateComponent } = await import("../../domain/make/component/component-commands.js");
		const { getFramework } = await import("../../domain/make/component/storybook-settings.js");
		const { getFrameworkPackages } = await import("../../domain/make/component/storybook-service.js");
		const components = listProjectComponents(ctx.project.path, { disk, paths });
		detectDirtyComponents(ctx.project.path, components, { disk, paths });
		const dirty = components.filter((c) => c.isDirty);
		if (dirty.length === 0) { log(`\n  No dirty components found.\n`); await input.waitForEnter(); return undefined; }
		log(`\n  ${BOLD}${dirty.length} dirty component(s):${RESET}`);
		for (const c of dirty) log(`    ${YELLOW}*${RESET} ${c.name}`);
		log("");
		const confirmed = await input.askYesNo("Regenerate all dirty components?");
		if (!confirmed) { log(`\n  ${DIM}Cancelled.${RESET}\n`); await input.waitForEnter(); return undefined; }
		log("");
		let total = 0;
		const framework = getFramework(ctx.project.path, { disk, paths });
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
		const { disk, paths, shell, input, log } = ctx.deps;
		const { isStorybookInstalled, installStorybook } = await import("../../domain/make/component/storybook-service.js");
		const { setFramework } = await import("../../domain/make/component/storybook-settings.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		const config = ctx.project.config.components ?? {};
		if (isStorybookInstalled(ctx.project.path, config, { disk, paths })) {
			log(`\n  Storybook is already installed.\n`); await input.waitForEnter(); return undefined;
		}
		log(`\n  ${BOLD}Select framework:${RESET}\n`);
		const choices: { key: string; label: string; value: ComponentFramework }[] = [
			{ key: "1", label: "HTML (vanilla)", value: "html" },
			{ key: "2", label: "Angular", value: "angular" },
		];
		for (const c of choices) log(`    ${c.key}) ${c.label}`);
		log("");
		const choice = await input.ask("Framework (1/2)", "1");
		const selected = choices.find((c) => c.key === choice);
		if (!selected) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return undefined; }
		setFramework(ctx.project.path, selected.value, { disk, paths });
		const projectName = paths.basename(ctx.project.path);
		installStorybook(ctx.project.path, projectName, { ...config, framework: selected.value }, { disk, paths, shell, input }, createStorybookRenderer(ctx.deps.log));
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-start", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, shell, input, log } = ctx.deps;
		const { isStorybookInstalled, isStorybookRunning, runStorybookDev } = await import("../../domain/make/component/storybook-service.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		const config = ctx.project.config.components ?? {};
		if (!isStorybookInstalled(ctx.project.path, config, { disk, paths }) || isStorybookRunning()) {
			log(`\n  Storybook not installed or already running.\n`); await input.waitForEnter(); return undefined;
		}
		await runStorybookDev(ctx.project.path, config, VAULT_ROOT, { disk, paths, shell, input }, createStorybookRenderer(ctx.deps.log));
		if (!isStorybookRunning()) await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-stop", async (ctx) => {
		const { input, log } = ctx.deps;
		const { isStorybookRunning, stopStorybook } = await import("../../domain/make/component/storybook-service.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		if (!isStorybookRunning()) { log(`\n  Storybook is not running.\n`); await input.waitForEnter(); return undefined; }
		stopStorybook(createStorybookRenderer(ctx.deps.log));
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-build", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, shell, input, log } = ctx.deps;
		const { isStorybookInstalled, runStorybookBuild } = await import("../../domain/make/component/storybook-service.js");
		const { createStorybookRenderer } = await import("../renderers/storybook-renderer-impl.js");
		const config = ctx.project.config.components ?? {};
		if (!isStorybookInstalled(ctx.project.path, config, { disk, paths })) {
			log(`\n  Storybook not installed. Use "Install Storybook" first.\n`); await input.waitForEnter(); return undefined;
		}
		runStorybookBuild(ctx.project.path, config, { disk, paths, shell }, createStorybookRenderer(ctx.deps.log));
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-import", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input, log } = ctx.deps;
		const config = ctx.project.config.components;
		const mdSource = config?.markdownSource;

		if (!mdSource?.path) {
			log(`\n  ${YELLOW}No markdownSource configured in components config.${RESET}\n`);
			await input.waitForEnter();
			return undefined;
		}

		const srcDir = paths.resolve(ctx.project.path, mdSource.path);
		if (!disk.existsSync(srcDir)) {
			log(`\n  ${YELLOW}Source folder not found:${RESET} ${DIM}${srcDir}${RESET}\n`);
			await input.waitForEnter();
			return undefined;
		}

		const result = await importMarkdownToSitemap(ctx.project.path, srcDir, mdSource, { disk, paths });
		log(`\n  ${GREEN}✓${RESET} Imported ${BOLD}${result.componentCount}${RESET} components → ${DIM}${result.outputPath}${RESET}`);
		if (result.skippedCount > 0) {
			log(`  ${YELLOW}⚠${RESET} Skipped ${result.skippedCount} file(s):`);
			for (const w of result.warnings) log(`    ${DIM}${w.file}${RESET}: ${w.reason}`);
		}
		log();
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:sb-scaffold", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input, log } = ctx.deps;
		const config = ctx.project.config.components ?? {};
		const storybookDir = config.storybookDir ?? "components";
		const sitemapPath = paths.join(ctx.project.path, storybookDir, "sitemap.json");

		if (!disk.existsSync(sitemapPath)) {
			log(`\n  ${YELLOW}No sitemap found at:${RESET} ${DIM}${sitemapPath}${RESET}`);
			log(`  ${DIM}Run "Import Markdown → Sitemap" first.${RESET}\n`);
			await input.waitForEnter();
			return undefined;
		}

		const { getFramework } = await import("../../domain/make/component/storybook-settings.js");
		const { scaffoldStorybookFromSitemap } = await import("../../domain/make/storybook-scaffold.js");
		const framework = getFramework(ctx.project.path, { disk, paths }) ?? "html";

		const result = scaffoldStorybookFromSitemap(sitemapPath, framework, { disk, paths });
		if (result.pageCount === 0) {
			log(`\n  ${YELLOW}No pages found in sitemap.${RESET} Nothing to scaffold.\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Scaffolded ${BOLD}${result.files.length}${RESET} files for ${BOLD}${result.pageCount}${RESET} pages (${framework})\n`);
			for (const file of result.files) log(`    ${DIM}${file.path}${RESET}`);
			log();
		}
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("comp:data-providers", async (ctx) => {
		if (!ctx.project) return undefined;
		const { dataProviderMenu } = await import("../menus/component-submenus.js");
		await dataProviderMenu(ctx.project.path, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp:action-ref", async (ctx) => {
		const { actionReferenceMenu } = await import("../menus/action-reference-menu.js");
		await actionReferenceMenu(ctx.deps);
		return undefined;
	});

	// ── Component-detail view action handlers ───────────────────────

	registry.registerAction("comp-detail:edit-fields", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editFieldsMenu } = await import("../menus/component-detail-menu.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		await editFieldsMenu(ctx.project.path, componentName, instance, domain, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-props", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editPropertiesMenu } = await import("../menus/component-detail-menu.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		await editPropertiesMenu(ctx.project.path, componentName, instance, domain, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-actions", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editActionsMenu } = await import("../menus/component-detail-menu.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		await editActionsMenu(ctx.project.path, componentName, instance, domain, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-children", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editChildrenMenu } = await import("../menus/component-editor-menus.js");
		const { listProjectComponents } = await import("../../domain/make/component/component-list.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		const allComponents = listProjectComponents(ctx.project.path, { disk, paths });
		await editChildrenMenu(ctx.project.path, componentName, instance, allComponents, domain, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-stores", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editStoresMenu } = await import("../menus/component-editor-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		await editStoresMenu(ctx.project.path, componentName, instance, domain, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-reqs", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editRequirementsMenu } = await import("../menus/component-product-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		await editRequirementsMenu(ctx.project.path, componentName, instance, domain, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-features", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editFeaturesMenu } = await import("../menus/component-product-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		await editFeaturesMenu(ctx.project.path, componentName, instance, domain, ctx.deps);
		return undefined;
	});

	registry.registerAction("comp-detail:edit-rels", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths } = ctx.deps;
		const { componentName, domain } = extractComponentParams(ctx);
		if (!componentName) return undefined;
		const { readComponentInstance } = await import("../../domain/make/component/component-editor.js");
		const { editRelationshipsMenu } = await import("../menus/component-product-menus.js");
		const instance = readComponentInstance(ctx.project.path, componentName, { disk, paths }, domain);
		if (!instance) return undefined;
		await editRelationshipsMenu(ctx.project.path, componentName, instance, domain, ctx.deps);
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

// ── Markdown import pipeline ────────────────────────────────────────

interface ImportPipelineResult {
	componentCount: number;
	skippedCount: number;
	warnings: Array<{ file: string; reason: string }>;
	outputPath: string;
}

async function importMarkdownToSitemap(
	projectPath: string,
	srcDir: string,
	mdSource: { strategy?: string; requiredFields?: readonly string[] },
	deps: { disk: import("../../infrastructure/types.js").IFileSystem; paths: import("../../infrastructure/types.js").IPaths },
): Promise<ImportPipelineResult> {
	const { parseFrontmatterContent } = await import("../../infrastructure/frontmatter.js");
	const { validateComponents, generateSitemapFromMarkdown } = await import("../../domain/make/markdown-sitemap-import.js");

	const strategy = (mdSource.strategy ?? "category") as "category" | "flat" | "hierarchical";
	const requiredFields = mdSource.requiredFields ?? ["name", "category"];

	const mdFiles: Record<string, Record<string, unknown>> = {};
	walkDir(srcDir, srcDir, mdFiles, deps, parseFrontmatterContent);

	const { valid, warnings } = validateComponents(mdFiles, requiredFields);
	const sitemap = generateSitemapFromMarkdown(valid, strategy);

	const outputPath = deps.paths.join(projectPath, "imported-sitemap.json");
	const outputDir = deps.paths.dirname(outputPath);
	if (!deps.disk.existsSync(outputDir)) deps.disk.mkdirSync(outputDir, { recursive: true });
	deps.disk.writeFileSync(outputPath, JSON.stringify(sitemap, null, "\t") + "\n", "utf8");

	return {
		componentCount: valid.length,
		skippedCount: warnings.length,
		warnings: warnings.map((w) => ({ file: w.file, reason: w.reason })),
		outputPath,
	};
}

function walkDir(
	rootDir: string,
	dir: string,
	out: Record<string, Record<string, unknown>>,
	deps: { disk: import("../../infrastructure/types.js").IFileSystem; paths: import("../../infrastructure/types.js").IPaths },
	parseFm: (content: string) => Record<string, unknown> | null,
): void {
	const entries = deps.disk.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = deps.paths.join(dir, entry.name);
		if (entry.isFile() && entry.name.endsWith(".md")) {
			const relPath = deps.paths.relative(rootDir, fullPath).replace(/\\/g, "/");
			const content = deps.disk.readFileSync(fullPath, "utf8");
			const fm = parseFm(content);
			if (!fm) return;
			if (!fm.category) {
				const relDir = deps.paths.relative(rootDir, dir).replace(/\\/g, "/");
				if (relDir && relDir !== ".") fm.category = relDir;
			}
			out[relPath] = fm;
		} else if (!entry.isFile()) {
			walkDir(rootDir, fullPath, out, deps, parseFm);
		}
	}
}
