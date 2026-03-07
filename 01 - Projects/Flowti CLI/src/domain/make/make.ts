/**
 * make.ts — Scaffolding menu and commands for hubs, plugins, and applications.
 *
 * All scaffolding writes to the selected project's root folder.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, VAULT_ROOT, config, manifest } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { writeFileAt } from "../../infrastructure/fs.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import { toKebab, toPascal, getMakePaths } from "./naming.js";
import type { MenuResult } from "../../types.js";
import {
	hubViewTemplate, hubTypesTemplate, hubEventsTemplate, hubServiceTemplate,
	hubProviderTemplate, hubTestTemplate, hubCssTemplate, hubPrdTemplate,
	hubJourneyTemplate, pluginManifestTemplate, pluginPackageTemplate,
	pluginTsconfigTemplate, pluginEsbuildTemplate, pluginMainTemplate,
	pluginGitignoreTemplate,
} from "./templates.js";
import {
	appManifestTemplate, appPackageTemplate, appTsconfigTemplate,
	appEsbuildTemplate, appVitestTemplate, appMainTemplate,
	appEventBusTemplate, appEventTypesTemplate, appEventsTemplate,
	appErrorTypesTemplate, appCssTemplate, appObsidianStubTemplate,
	appEventBusTestTemplate, appGitignoreTemplate,
} from "./appTemplates.js";

// ── Interactive menu ────────────────────────────────────────────────

export async function menu(projectRoot: string): Promise<MenuResult> {
	return runMenu("Make", [
		{ key: "1", label: "New Hub", action: () => makeHub(projectRoot) },
		{ key: "2", label: "New Plugin (standalone Obsidian plugin)", action: () => makePlugin(projectRoot) },
		{ key: "3", label: "New Application (DDD Obsidian plugin)", action: () => makeApp(projectRoot) },
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("make"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	]);
}

// ── Hub scaffolding ─────────────────────────────────────────────────

async function makeHub(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Hub");
	const paths = getMakePaths();

	console.log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const rl = createRL();
	const name = await ask(rl, "Hub name (e.g., Inventory)");
	if (!name) { rl.close(); return; }

	const kebab = toKebab(name);
	const pascal = toPascal(name);

	const icon = await ask(rl, "Lucide icon", "layout-grid");
	const hubType = await ask(rl, "Hub type (system/domain/user)", "domain");
	const tabsRaw = await ask(rl, "Initial tabs (comma-separated)", "overview,items");
	rl.close();

	const tabs = tabsRaw.split(",").map((t) => t.trim()).filter(Boolean);

	console.log();
	console.log(`  ${BOLD}Scaffolding: ${pascal} Hub${RESET}`);
	console.log(`  ${DIM}ID: ${kebab} | Icon: ${icon} | Type: ${hubType} | Tabs: ${tabs.join(", ")}${RESET}`);
	console.log();

	console.log(`  ${DIM}Output paths:${RESET}`);
	console.log(`    UI:       ${paths.ui}/${kebab}/`);
	console.log(`    Domain:   ${paths.domain}/${kebab}/`);
	console.log(`    Provider: ${paths.hubDomain}/`);
	console.log(`    Tests:    ${paths.tests}/${kebab}/`);
	console.log(`    CSS:      ${paths.css}/`);
	console.log(`    Docs:     ${paths.docs}/${pascal}/`);
	console.log(`    Journey:  ${paths.journeys}/`);
	console.log();

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create files? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	console.log();
	let created = 0;
	const w = (rel: string, content: string): void => { if (writeFileAt(projectRoot, rel, content)) created++; };

	w(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs));
	w(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs));
	w(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal));
	w(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal));
	w(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon));
	w(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab));

	const cssDir = path.join(projectRoot, paths.css);
	const cssFiles = fs.existsSync(cssDir)
		? fs.readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort()
		: [];
	const maxNum = cssFiles.reduce((max, f) => {
		const m = f.match(/^(\d+)/);
		return m ? Math.max(max, parseInt(m[1], 10)) : max;
	}, 0);
	const cssNum = String(maxNum + 1).padStart(2, "0");
	w(`${paths.css}/${cssNum}-${kebab}.css`, hubCssTemplate(pascal, kebab));

	w(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal));
	w(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab));

	console.log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${pascal} Hub.\n`);

	console.log(`  ${BOLD}Next steps:${RESET}`);
	console.log(`    1. Add VIEW_TYPE constant to ${DIM}src/domain/hub/types.ts${RESET}:`);
	console.log(`       ${CYAN}export const VIEW_TYPE_${pascal.toUpperCase()}_HUB = "flowti-${kebab}-hub";${RESET}`);
	console.log(`    2. Register view in ${DIM}src/main.ts${RESET} → onLayoutReady():`);
	console.log(`       ${CYAN}this.safeRegisterView(VIEW_TYPE_${pascal.toUpperCase()}_HUB, (leaf) =>${RESET}`);
	console.log(`       ${CYAN}  new ${pascal}HubView(leaf, this.eventBus));${RESET}`);
	console.log(`    3. Register provider in ${DIM}src/main.ts${RESET} → setupHubRegistry():`);
	console.log(`       ${CYAN}this.hubRegistry.register(new ${pascal}HubProvider());${RESET}`);
	console.log(`    4. Add ${pascal}EventMap to ${DIM}src/infrastructure/events/events.ts${RESET}`);
	console.log(`    5. Add ribbon icon for the hub`);
	console.log();
}

// ── Plugin scaffolding ──────────────────────────────────────────────

async function makePlugin(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Plugin");

	console.log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const rl = createRL();
	const name = await ask(rl, "Plugin name (e.g., My Plugin)");
	if (!name) { rl.close(); return; }

	const defaultId = toKebab(name);
	const pluginId = await ask(rl, "Plugin ID", defaultId);
	const author = await ask(rl, "Author", (manifest as Record<string, unknown>).author as string ?? "");
	rl.close();

	const pluginRoot = path.join(projectRoot, pluginId);

	console.log();
	console.log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	console.log(`  ${DIM}ID: ${pluginId} | Author: ${author}${RESET}`);
	console.log(`  ${DIM}Output: ${pluginRoot}${RESET}`);
	console.log();

	if (fs.existsSync(pluginRoot)) {
		console.log(`  ${RED}Folder already exists: ${pluginRoot}${RESET}\n`);
		return;
	}

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create plugin? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	console.log();
	let created = 0;
	const w = (rel: string, content: string): void => { if (writeFileAt(pluginRoot, rel, content)) created++; };

	w("manifest.json", pluginManifestTemplate(name, pluginId, author));
	w("package.json", pluginPackageTemplate(name, pluginId));
	w("tsconfig.json", pluginTsconfigTemplate());
	w("esbuild.config.mjs", pluginEsbuildTemplate(pluginId));
	w(".gitignore", pluginGitignoreTemplate());
	w("src/main.ts", pluginMainTemplate(name));
	w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);
	w("src/infrastructure/events/.gitkeep", "");
	w("src/domain/.gitkeep", "");
	w("src/ui/.gitkeep", "");
	w("tests/.gitkeep", "");

	console.log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	console.log(`  ${BOLD}Next steps:${RESET}`);
	console.log(`    1. ${CYAN}cd "${pluginRoot}"${RESET}`);
	console.log(`    2. ${CYAN}npm install${RESET}`);
	console.log(`    3. ${CYAN}npm run build:dev${RESET}`);
	console.log(`    4. Open the vault containing this plugin in Obsidian`);
	console.log();
}

// ── Application scaffolding ─────────────────────────────────────────

async function makeApp(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Application");

	console.log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const rl = createRL();
	const name = await ask(rl, "App name (e.g., My App)");
	if (!name) { rl.close(); return; }

	const defaultId = toKebab(name);
	const appId = await ask(rl, "App ID", defaultId);
	const author = await ask(rl, "Author", (manifest as Record<string, unknown>).author as string ?? "");
	rl.close();

	const pascal = toPascal(name);
	const appRoot = path.join(projectRoot, appId);

	console.log();
	console.log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	console.log(`  ${DIM}ID: ${appId} | Author: ${author}${RESET}`);
	console.log(`  ${DIM}Output: ${appRoot}${RESET}`);
	console.log();

	const tree = [
		"css/00-base.css", "src/main.ts", "src/infrastructure/events/EventBus.ts",
		"src/infrastructure/events/types.ts", "src/infrastructure/events/events.ts",
		"src/infrastructure/errors/types.ts", "src/infrastructure/services/.gitkeep",
		"src/domain/.gitkeep", "src/ui/.gitkeep", "tests/mocks/obsidian-stub.ts",
		"tests/infrastructure/EventBus.test.ts", "manifest.json", "package.json",
		"tsconfig.json", "esbuild.config.mjs", "vitest.config.ts", ".gitignore",
	];
	console.log(`  ${DIM}File tree:${RESET}`);
	for (const f of tree) {
		console.log(`    ${DIM}${f}${RESET}`);
	}
	console.log();

	if (fs.existsSync(appRoot)) {
		console.log(`  ${RED}Folder already exists: ${appRoot}${RESET}\n`);
		return;
	}

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create application? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	console.log();
	let created = 0;
	const w = (rel: string, content: string): void => { if (writeFileAt(appRoot, rel, content)) created++; };

	w("manifest.json", appManifestTemplate(name, appId, author));
	w("package.json", appPackageTemplate(name, appId));
	w("tsconfig.json", appTsconfigTemplate());
	w("esbuild.config.mjs", appEsbuildTemplate(appId));
	w("vitest.config.ts", appVitestTemplate());
	w(".gitignore", appGitignoreTemplate());
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

	console.log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	console.log(`  ${BOLD}Next steps:${RESET}`);
	console.log(`    1. ${CYAN}cd "${appRoot}"${RESET}`);
	console.log(`    2. ${CYAN}npm install${RESET}`);
	console.log(`    3. ${CYAN}npm run build${RESET}`);
	console.log(`    4. ${CYAN}npm test${RESET}`);
	console.log(`    5. Open the vault in Obsidian and enable the plugin`);
	console.log();
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	"make:hub": (flags: Record<string, string | boolean>) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			console.log(`\n  ${RED}--name is required.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- make:hub --name=Inventory [--icon=package] [--type=domain] [--tabs=overview,items]${RESET}\n`);
			process.exit(1);
		}
		const kebab = toKebab(name);
		const pascal = toPascal(name);
		const icon = (flags.icon as string) ?? "layout-grid";
		const hubType = (flags.type as string) ?? "domain";
		const tabs = ((flags.tabs as string) ?? "overview,items").split(",").map((t) => t.trim());
		const paths = getMakePaths();

		console.log(`\n  ${CYAN}▸${RESET} Scaffolding: ${pascal} Hub\n`);

		let created = 0;
		const w = (rel: string, content: string): void => { if (writeFileAt(ROOT, rel, content)) created++; };

		w(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs));
		w(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs));
		w(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal));
		w(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal));
		w(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon));
		w(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab));

		const cssFiles = fs.existsSync(path.join(ROOT, paths.css))
			? fs.readdirSync(path.join(ROOT, paths.css)).filter((f) => f.endsWith(".css")).sort() : [];
		const maxNum = cssFiles.reduce((max, f) => { const m = f.match(/^(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
		w(`${paths.css}/${String(maxNum + 1).padStart(2, "0")}-${kebab}.css`, hubCssTemplate(pascal, kebab));
		w(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal));
		w(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab));

		console.log(`\n  ${GREEN}✓${RESET} Created ${created} files.\n`);
	},

	"make:app": (flags: Record<string, string | boolean>) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			console.log(`\n  ${RED}--name is required.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- make:app --name="My App" [--id=my-app] [--author=Name]${RESET}\n`);
			process.exit(1);
		}
		const appId = (flags.id as string) ?? toKebab(name);
		const author = (flags.author as string) ?? (manifest as Record<string, unknown>).author as string ?? "";
		const pascal = toPascal(name);
		const appRoot = path.resolve(VAULT_ROOT, "01 - Projects", appId);

		if (fs.existsSync(appRoot)) {
			console.log(`\n  ${RED}Folder already exists: ${appRoot}${RESET}\n`);
			process.exit(1);
		}

		console.log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		let created = 0;
		const w = (rel: string, content: string): void => { if (writeFileAt(appRoot, rel, content)) created++; };

		w("manifest.json", appManifestTemplate(name, appId, author));
		w("package.json", appPackageTemplate(name, appId));
		w("tsconfig.json", appTsconfigTemplate());
		w("esbuild.config.mjs", appEsbuildTemplate(appId));
		w("vitest.config.ts", appVitestTemplate());
		w(".gitignore", appGitignoreTemplate());
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

		console.log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${appRoot}\n`);
	},

	"make:plugin": (flags: Record<string, string | boolean>) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			console.log(`\n  ${RED}--name is required.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- make:plugin --name="My Plugin" [--id=my-plugin] [--author=Name]${RESET}\n`);
			process.exit(1);
		}
		const pluginId = (flags.id as string) ?? toKebab(name);
		const author = (flags.author as string) ?? (manifest as Record<string, unknown>).author as string ?? "";
		const pluginRoot = path.resolve(ROOT, "..", pluginId);

		if (fs.existsSync(pluginRoot)) {
			console.log(`\n  ${RED}Folder already exists: ${pluginRoot}${RESET}\n`);
			process.exit(1);
		}

		console.log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		let created = 0;
		const w = (rel: string, content: string): void => { if (writeFileAt(pluginRoot, rel, content)) created++; };

		w("manifest.json", pluginManifestTemplate(name, pluginId, author));
		w("package.json", pluginPackageTemplate(name, pluginId));
		w("tsconfig.json", pluginTsconfigTemplate());
		w("esbuild.config.mjs", pluginEsbuildTemplate(pluginId));
		w(".gitignore", pluginGitignoreTemplate());
		w("src/main.ts", pluginMainTemplate(name));
		w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);
		w("src/infrastructure/events/.gitkeep", "");
		w("src/domain/.gitkeep", "");
		w("src/ui/.gitkeep", "");
		w("tests/.gitkeep", "");

		console.log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${pluginRoot}\n`);
	},
};
