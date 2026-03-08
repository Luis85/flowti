/**
 * makers.ts — Interactive scaffolding functions for the Make menu.
 *
 * Each maker prompts the user for input, then writes the scaffolded files.
 */

import { paths as nodePaths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { cliConfig } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { toKebab, toPascal, getMakePaths } from "./naming.js";
import { readProjectConfig } from "../project/project-config.js";
import { createFileWriter } from "./templates/file-writer.js";
import {
	manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, vitestTemplate, gitignoreTemplate,
} from "./templates/config.js";
import {
	hubViewTemplate, hubTypesTemplate, hubEventsTemplate, hubServiceTemplate,
	hubProviderTemplate, hubTestTemplate, hubCssTemplate, hubPrdTemplate,
	hubJourneyTemplate,
} from "./templates/hub.js";
import { pluginMainTemplate } from "./templates/plugin.js";
import {
	appMainTemplate, appEventBusTemplate, appEventTypesTemplate, appEventsTemplate,
	appErrorTypesTemplate, appCssTemplate, appObsidianStubTemplate,
	appEventBusTestTemplate,
} from "./templates/app.js";
import { cliMainTemplate, cliMainTestTemplate } from "./templates/cli.js";
import { journeyDefinitionTemplate, journeyTestTemplate, journeyCanvasTemplate } from "./templates/journey.js";

// ── Hub scaffolding ─────────────────────────────────────────────────

export async function makeHub(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Hub");
	const projectConfig = readProjectConfig(projectRoot);
	const paths = getMakePaths(projectConfig);

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const name = await input.ask("Hub name (e.g., Inventory)");
	if (!name) return;

	const kebab = toKebab(name);
	const pascal = toPascal(name);

	const icon = await input.ask("Lucide icon", "layout-grid");
	const hubType = await input.ask("Hub type (system/domain/user)", "domain");
	const tabsRaw = await input.ask("Initial tabs (comma-separated)", "overview,items");

	const tabs = tabsRaw.split(",").map((t) => t.trim()).filter(Boolean);

	log();
	log(`  ${BOLD}Scaffolding: ${pascal} Hub${RESET}`);
	log(`  ${DIM}ID: ${kebab} | Icon: ${icon} | Type: ${hubType} | Tabs: ${tabs.join(", ")}${RESET}`);
	log();

	log(`  ${DIM}Output paths:${RESET}`);
	log(`    UI:       ${paths.ui}/${kebab}/`);
	log(`    Domain:   ${paths.domain}/${kebab}/`);
	log(`    Provider: ${paths.hubDomain}/`);
	log(`    Tests:    ${paths.tests}/${kebab}/`);
	log(`    CSS:      ${paths.css}/`);
	log(`    Docs:     ${paths.docs}/${pascal}/`);
	log(`    Journey:  ${paths.journeys}/`);
	log();

	const proceed = await input.ask("Create files? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	log();
	const { write: w, created } = createFileWriter(projectRoot);

	w(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs));
	w(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs));
	w(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal));
	w(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal));
	w(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon));
	w(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab));

	const cssDir = nodePaths.join(projectRoot, paths.css);
	const cssFiles = disk.existsSync(cssDir)
		? disk.readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort()
		: [];
	const maxNum = cssFiles.reduce((max, f) => {
		const m = f.match(/^(\d+)/);
		return m ? Math.max(max, parseInt(m[1], 10)) : max;
	}, 0);
	const cssNum = String(maxNum + 1).padStart(2, "0");
	w(`${paths.css}/${cssNum}-${kebab}.css`, hubCssTemplate(pascal, kebab));

	w(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal));
	w(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab));

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${pascal} Hub.\n`);

	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. Add VIEW_TYPE constant to ${DIM}src/domain/hub/types.ts${RESET}:`);
	log(`       ${CYAN}export const VIEW_TYPE_${pascal.toUpperCase()}_HUB = "flowti-${kebab}-hub";${RESET}`);
	log(`    2. Register view in ${DIM}src/main.ts${RESET} → onLayoutReady():`);
	log(`       ${CYAN}this.safeRegisterView(VIEW_TYPE_${pascal.toUpperCase()}_HUB, (leaf) =>${RESET}`);
	log(`       ${CYAN}  new ${pascal}HubView(leaf, this.eventBus));${RESET}`);
	log(`    3. Register provider in ${DIM}src/main.ts${RESET} → setupHubRegistry():`);
	log(`       ${CYAN}this.hubRegistry.register(new ${pascal}HubProvider());${RESET}`);
	log(`    4. Add ${pascal}EventMap to ${DIM}src/infrastructure/events/events.ts${RESET}`);
	log(`    5. Add ribbon icon for the hub`);
	log();
}

// ── Plugin scaffolding ──────────────────────────────────────────────

export async function makePlugin(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Plugin");

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const name = await input.ask("Plugin name (e.g., My Plugin)");
	if (!name) return;

	const defaultId = toKebab(name);
	const pluginId = await input.ask("Plugin ID", defaultId);
	const author = await input.ask("Author", cliConfig.defaultAuthor ?? "");

	const pluginRoot = nodePaths.join(projectRoot, pluginId);

	log();
	log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	log(`  ${DIM}ID: ${pluginId} | Author: ${author}${RESET}`);
	log(`  ${DIM}Output: ${pluginRoot}${RESET}`);
	log();

	if (disk.existsSync(pluginRoot)) {
		log(`  ${RED}Folder already exists: ${pluginRoot}${RESET}\n`);
		return;
	}

	const proceed = await input.ask("Create plugin? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	log();
	const { write: w, created } = createFileWriter(pluginRoot);

	w("manifest.json", manifestTemplate({ id: pluginId, name, author }));
	w("package.json", packageTemplate("plugin", name, pluginId));
	w("tsconfig.json", tsconfigTemplate("plugin"));
	w("esbuild.config.mjs", esbuildTemplate(pluginId));
	w(".gitignore", gitignoreTemplate("plugin"));
	w("src/main.ts", pluginMainTemplate(name));
	w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);
	w("src/infrastructure/events/.gitkeep", "");
	w("src/domain/.gitkeep", "");
	w("src/ui/.gitkeep", "");
	w("tests/.gitkeep", "");

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. ${CYAN}cd "${pluginRoot}"${RESET}`);
	log(`    2. ${CYAN}npm install${RESET}`);
	log(`    3. ${CYAN}npm run build:dev${RESET}`);
	log(`    4. Open the vault containing this plugin in Obsidian`);
	log();
}

// ── Application scaffolding ─────────────────────────────────────────

export async function makeApp(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Application");

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const name = await input.ask("App name (e.g., My App)");
	if (!name) return;

	const defaultId = toKebab(name);
	const appId = await input.ask("App ID", defaultId);
	const author = await input.ask("Author", cliConfig.defaultAuthor ?? "");

	const pascal = toPascal(name);
	const appRoot = nodePaths.join(projectRoot, appId);

	log();
	log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	log(`  ${DIM}ID: ${appId} | Author: ${author}${RESET}`);
	log(`  ${DIM}Output: ${appRoot}${RESET}`);
	log();

	const tree = [
		"css/00-base.css", "src/main.ts", "src/infrastructure/events/EventBus.ts",
		"src/infrastructure/events/types.ts", "src/infrastructure/events/events.ts",
		"src/infrastructure/errors/types.ts", "src/infrastructure/services/.gitkeep",
		"src/domain/.gitkeep", "src/ui/.gitkeep", "tests/mocks/obsidian-stub.ts",
		"tests/infrastructure/EventBus.test.ts", "manifest.json", "package.json",
		"tsconfig.json", "esbuild.config.mjs", "vitest.config.ts", ".gitignore",
	];
	log(`  ${DIM}File tree:${RESET}`);
	for (const f of tree) {
		log(`    ${DIM}${f}${RESET}`);
	}
	log();

	if (disk.existsSync(appRoot)) {
		log(`  ${RED}Folder already exists: ${appRoot}${RESET}\n`);
		return;
	}

	const proceed = await input.ask("Create application? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	log();
	const { write: w, created } = createFileWriter(appRoot);

	w("manifest.json", manifestTemplate({ id: appId, name, author }));
	w("package.json", packageTemplate("app", name, appId));
	w("tsconfig.json", tsconfigTemplate("app"));
	w("esbuild.config.mjs", esbuildTemplate(appId));
	w("vitest.config.ts", vitestTemplate("app"));
	w(".gitignore", gitignoreTemplate("app"));
	w("css/00-base.css", appCssTemplate(name));
	w("src/main.ts", appMainTemplate(name, pascal));
	w("src/infrastructure/events/EventBus.ts", appEventBusTemplate());
	w("src/infrastructure/events/types.ts", appEventTypesTemplate());
	w("src/infrastructure/events/events.ts", appEventsTemplate());
	w("src/infrastructure/errors/types.ts", appErrorTypesTemplate());
	w("src/infrastructure/services/.gitkeep", "");
	w("src/domain/.gitkeep", "");
	w("src/ui/.gitkeep", "");
	w("tests/mocks/obsidian-stub.ts", appObsidianStubTemplate());
	w("tests/infrastructure/EventBus.test.ts", appEventBusTestTemplate());

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. ${CYAN}cd "${appRoot}"${RESET}`);
	log(`    2. ${CYAN}npm install${RESET}`);
	log(`    3. ${CYAN}npm run build${RESET}`);
	log(`    4. ${CYAN}npm test${RESET}`);
	log(`    5. Open the vault in Obsidian and enable the plugin`);
	log();
}

// ── CLI App scaffolding ─────────────────────────────────────────────

export async function makeCliApp(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New CLI App");

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const name = await input.ask("App name (e.g., My CLI)");
	if (!name) return;

	const defaultId = toKebab(name);
	const appId = await input.ask("App ID", defaultId);

	const cliRoot = nodePaths.join(projectRoot, appId);

	log();
	log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	log(`  ${DIM}ID: ${appId}${RESET}`);
	log(`  ${DIM}Output: ${cliRoot}${RESET}`);
	log();

	if (disk.existsSync(cliRoot)) {
		log(`  ${RED}Folder already exists: ${cliRoot}${RESET}\n`);
		return;
	}

	const proceed = await input.ask("Create CLI app? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	log();
	const { write: w, created } = createFileWriter(cliRoot);

	w("package.json", packageTemplate("cli", name, appId));
	w("tsconfig.json", tsconfigTemplate("cli"));
	w("vitest.config.ts", vitestTemplate("cli"));
	w(".gitignore", gitignoreTemplate("cli"));
	w("src/main.ts", cliMainTemplate(name));
	w("tests/main.test.ts", cliMainTestTemplate(name));

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. ${CYAN}cd "${cliRoot}"${RESET}`);
	log(`    2. ${CYAN}npm install${RESET}`);
	log(`    3. ${CYAN}npm run dev${RESET}`);
	log(`    4. ${CYAN}npm test${RESET}`);
	log();
}

// ── make:journey ────────────────────────────────────────────────────

export async function makeJourney(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New E2E Journey");

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const name = await input.ask("Journey name (e.g., Getting Started)");
	if (!name) return;

	const defaultSlug = toKebab(name);
	const slug = await input.ask("Journey slug", defaultSlug);
	const description = await input.ask("Description", `E2E journey for ${name}.`);

	const cfg = readProjectConfig(projectRoot);
	const journeysDir = cfg?.review?.journeysDir ?? "tests/e2e/journeys";
	const journeysPath = nodePaths.resolve(projectRoot, journeysDir);
	const journeyFile = nodePaths.join(journeysPath, `${slug}.journey`);

	log();
	log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	log(`  ${DIM}Slug: ${slug}${RESET}`);
	log(`  ${DIM}Journey file: ${journeyFile}${RESET}`);
	log();

	if (disk.existsSync(journeyFile)) {
		log(`  ${RED}Journey already exists: ${journeyFile}${RESET}\n`);
		return;
	}

	const proceed = await input.ask("Create journey? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	log();
	const { write: w, created } = createFileWriter(projectRoot);

	// Journey definition
	w(nodePaths.join(journeysDir, `${slug}.journey`), journeyDefinitionTemplate(name, slug, description));

	// Test file (vitest entry point)
	const testDir = nodePaths.dirname(journeysDir);
	const testFileNumber = getNextTestFileNumber(nodePaths.resolve(projectRoot, testDir));
	w(nodePaths.join(testDir, `${testFileNumber}-journey-${slug}.test.ts`), journeyTestTemplate(slug));

	// Vault documentation: journey canvas + config placeholder
	const docsDir = nodePaths.join("docs", "journeys", name);
	w(nodePaths.join(docsDir, `${name}.canvas`), journeyCanvasTemplate(name));

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for journey "${name}".\n`);

	log(`  ${BOLD}Created files:${RESET}`);
	log(`    ${CYAN}${journeysDir}/${slug}.journey${RESET}     — Journey definition`);
	log(`    ${CYAN}${testDir}/${testFileNumber}-journey-${slug}.test.ts${RESET}  — Test entry`);
	log(`    ${CYAN}${docsDir}/${name}.canvas${RESET}       — Journey canvas`);
	log();
	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. Edit ${CYAN}${slug}.journey${RESET} to define your steps and actions`);
	log(`    2. Design the journey canvas in Obsidian`);
	log(`    3. Run ${CYAN}npm run test:e2e -- --journey=${slug}${RESET} to test`);
	log();
}

/** Scans test directory for numbered journey files and returns the next available number (e.g., "50"). */
export function getNextTestFileNumber(testDir: string): string {
	if (!disk.existsSync(testDir)) return "10";
	const files = disk.readdirSync(testDir).filter((f) => f.match(/^\d+-journey-/));
	if (files.length === 0) return "10";
	const numbers = files.map((f) => parseInt(f.split("-")[0], 10)).filter((n) => !isNaN(n));
	const maxNum = Math.max(...numbers);
	return String(maxNum + 10);
}
