/**
 * make-makers.ts — Interactive scaffolding functions for the Make menu.
 *
 * Each maker prompts the user for input, builds a pure plan, then writes files.
 * Moved from domain/make/makers.ts to separate display/input concerns.
 */

import { paths as nodePaths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { cliConfig } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { toKebab, toPascal } from "../../domain/make/naming.js";
import { readProjectConfig } from "../../domain/project/project-config.js";
import { createFileWriter } from "../../domain/make/templates/file-writer.js";
import { getNextTestFileNumber } from "../../domain/make/makers.js";
import {
	buildPluginPlan, buildAppPlan, buildCliAppPlan, buildJourneyPlan,
} from "../../domain/make/plans.js";
import type { FileEntry } from "../../domain/make/plans.js";

// ── Shared helpers ──────────────────────────────────────────────────

function writePlan(basePath: string, files: FileEntry[]): number {
	const writer = createFileWriter(basePath);
	for (const f of files) writer.write(f.path, f.content);
	return writer.created;
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

	await input.waitForEnter();
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

	await input.waitForEnter();
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

	await input.waitForEnter();
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

	const { config: cfg } = readProjectConfig(projectRoot, { disk, paths: nodePaths });
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
	const testFileNumber = getNextTestFileNumber(nodePaths.resolve(projectRoot, testDir), { disk });
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

	await input.waitForEnter();
}
