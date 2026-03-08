/**
 * makers.ts — Interactive scaffolding functions for the Make menu.
 *
 * Each maker prompts the user for input, builds a pure plan, then writes files.
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
	buildHubPlan, buildPluginPlan, buildAppPlan, buildCliAppPlan, buildJourneyPlan,
	computeNextCssNumber,
} from "./plans.js";
import type { FileEntry } from "./plans.js";

// ── Shared helpers ──────────────────────────────────────────────────

function writePlan(basePath: string, files: FileEntry[]): number {
	const writer = createFileWriter(basePath);
	for (const f of files) writer.write(f.path, f.content);
	return writer.created;
}

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
	const cssDir = nodePaths.join(projectRoot, paths.css);
	const cssFiles = disk.existsSync(cssDir)
		? disk.readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort()
		: [];
	const cssNum = computeNextCssNumber(cssFiles);

	const files = buildHubPlan({ pascal, kebab, hubType, icon, tabs, paths, cssNum });
	const created = writePlan(projectRoot, files);

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
	const files = buildPluginPlan({ name, pluginId, author });
	const created = writePlan(pluginRoot, files);

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

	if (disk.existsSync(appRoot)) {
		log(`  ${RED}Folder already exists: ${appRoot}${RESET}\n`);
		return;
	}

	const proceed = await input.ask("Create application? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	log();
	const files = buildAppPlan({ name, appId, author, pascal });
	const created = writePlan(appRoot, files);

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
	const files = buildCliAppPlan({ name, appId });
	const created = writePlan(cliRoot, files);

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
	const testDir = nodePaths.dirname(journeysDir);
	const testFileNumber = getNextTestFileNumber(nodePaths.resolve(projectRoot, testDir));
	const docsDir = nodePaths.join("docs", "journeys", name);

	const files = buildJourneyPlan({ name, slug, description, journeysDir, testDir, testFileNumber, docsDir });
	const created = writePlan(projectRoot, files);

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
