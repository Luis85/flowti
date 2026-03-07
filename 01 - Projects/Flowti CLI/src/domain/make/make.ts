/**
 * make.ts — Scaffolding menu and commands for hubs, plugins, and applications.
 *
 * All scaffolding writes to the selected project's root folder.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, VAULT_ROOT, manifest } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { writeFileAt } from "../../infrastructure/fs.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import { toKebab, toPascal, getMakePaths } from "./naming.js";
import { readProjectConfig } from "../project/project-config.js";
import type { MenuEntry, MenuResult, MakeTemplateId } from "../../types.js";
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
import {
	cliPackageTemplate, cliTsconfigTemplate, cliMainTemplate,
	cliMainTestTemplate, cliVitestTemplate, cliGitignoreTemplate,
} from "./cliTemplates.js";
import { log } from "../../infrastructure/logger.js";

// ── Template registry ───────────────────────────────────────────────

const TEMPLATE_DEFS: Record<MakeTemplateId, { label: string; action: (root: string) => Promise<void> }> = {
	hub: { label: "New Hub", action: makeHub },
	plugin: { label: "New Plugin (standalone Obsidian plugin)", action: makePlugin },
	app: { label: "New Application (DDD Obsidian plugin)", action: makeApp },
	cli: { label: "New CLI App (Node.js ESM)", action: makeCliApp },
};

const ALL_TEMPLATES: MakeTemplateId[] = ["hub", "plugin", "app", "cli"];

function getAvailableTemplates(projectRoot: string): MakeTemplateId[] {
	const cfg = readProjectConfig(projectRoot);
	return cfg?.make?.templates ?? ALL_TEMPLATES;
}

// ── Interactive menu ────────────────────────────────────────────────

export async function menu(projectRoot: string): Promise<MenuResult> {
	const available = getAvailableTemplates(projectRoot);

	if (available.length === 0) {
		log(`\n  ${DIM}No Make templates configured for this project.${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = available.map((id, i) => {
		const def = TEMPLATE_DEFS[id];
		return { key: String(i + 1), label: def.label, action: () => def.action(projectRoot) };
	});

	items.push(
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("make"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	);

	return runMenu("Make", items);
}

// ── Project scaffolding (used by "Create Project") ──────────────────

export type ProjectTemplateId = "app" | "plugin" | "cli" | "empty";

export interface ProjectTemplate {
	label: string;
	scaffold: (projectPath: string, name: string) => void;
}

function scaffoldPlugin(projectPath: string, name: string): void {
	const id = toKebab(name);
	const author = (manifest as Record<string, unknown>).author as string ?? "";
	let created = 0;
	const w = (rel: string, content: string): void => { if (writeFileAt(projectPath, rel, content)) created++; };

	w("manifest.json", pluginManifestTemplate(name, id, author));
	w("package.json", pluginPackageTemplate(name, id));
	w("tsconfig.json", pluginTsconfigTemplate());
	w("esbuild.config.mjs", pluginEsbuildTemplate(id));
	w(".gitignore", pluginGitignoreTemplate());
	w("src/main.ts", pluginMainTemplate(name));
	w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);
	w("src/infrastructure/events/.gitkeep", "");
	w("src/domain/.gitkeep", "");
	w("src/ui/.gitkeep", "");
	w("tests/.gitkeep", "");

	log(`  ${GREEN}✓${RESET} Created ${created} files (Starter Plugin).\n`);
}

function scaffoldApp(projectPath: string, name: string): void {
	const id = toKebab(name);
	const pascal = toPascal(name);
	const author = (manifest as Record<string, unknown>).author as string ?? "";
	let created = 0;
	const w = (rel: string, content: string): void => { if (writeFileAt(projectPath, rel, content)) created++; };

	w("manifest.json", appManifestTemplate(name, id, author));
	w("package.json", appPackageTemplate(name, id));
	w("tsconfig.json", appTsconfigTemplate());
	w("esbuild.config.mjs", appEsbuildTemplate(id));
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

	log(`  ${GREEN}✓${RESET} Created ${created} files (DDD Application).\n`);
}

function scaffoldCli(projectPath: string, name: string): void {
	const id = toKebab(name);
	let created = 0;
	const w = (rel: string, content: string): void => { if (writeFileAt(projectPath, rel, content)) created++; };

	w("package.json", cliPackageTemplate(name, id));
	w("tsconfig.json", cliTsconfigTemplate());
	w("vitest.config.ts", cliVitestTemplate());
	w(".gitignore", cliGitignoreTemplate());
	w("src/main.ts", cliMainTemplate(name));
	w("tests/main.test.ts", cliMainTestTemplate(name));

	log(`  ${GREEN}✓${RESET} Created ${created} files (CLI App).\n`);
}

function scaffoldEmpty(projectPath: string, _name: string): void {
	fs.mkdirSync(projectPath, { recursive: true });
	log(`  ${GREEN}✓${RESET} Created empty project.\n`);
}

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplate> = {
	app:    { label: "Application (DDD Obsidian plugin with EventBus)", scaffold: scaffoldApp },
	plugin: { label: "Starter Plugin (basic Obsidian plugin)", scaffold: scaffoldPlugin },
	cli:    { label: "CLI App (Node.js ESM with TypeScript)", scaffold: scaffoldCli },
	empty:  { label: "Empty", scaffold: scaffoldEmpty },
};

export const PROJECT_TEMPLATE_IDS: ProjectTemplateId[] = ["app", "plugin", "cli", "empty"];

// ── Hub scaffolding ─────────────────────────────────────────────────

async function makeHub(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Hub");
	const paths = getMakePaths();

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

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

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create files? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	log();
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

async function makePlugin(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Plugin");

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const rl = createRL();
	const name = await ask(rl, "Plugin name (e.g., My Plugin)");
	if (!name) { rl.close(); return; }

	const defaultId = toKebab(name);
	const pluginId = await ask(rl, "Plugin ID", defaultId);
	const author = await ask(rl, "Author", (manifest as Record<string, unknown>).author as string ?? "");
	rl.close();

	const pluginRoot = path.join(projectRoot, pluginId);

	log();
	log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	log(`  ${DIM}ID: ${pluginId} | Author: ${author}${RESET}`);
	log(`  ${DIM}Output: ${pluginRoot}${RESET}`);
	log();

	if (fs.existsSync(pluginRoot)) {
		log(`  ${RED}Folder already exists: ${pluginRoot}${RESET}\n`);
		return;
	}

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create plugin? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	log();
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

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. ${CYAN}cd "${pluginRoot}"${RESET}`);
	log(`    2. ${CYAN}npm install${RESET}`);
	log(`    3. ${CYAN}npm run build:dev${RESET}`);
	log(`    4. Open the vault containing this plugin in Obsidian`);
	log();
}

// ── Application scaffolding ─────────────────────────────────────────

async function makeApp(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New Application");

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const rl = createRL();
	const name = await ask(rl, "App name (e.g., My App)");
	if (!name) { rl.close(); return; }

	const defaultId = toKebab(name);
	const appId = await ask(rl, "App ID", defaultId);
	const author = await ask(rl, "Author", (manifest as Record<string, unknown>).author as string ?? "");
	rl.close();

	const pascal = toPascal(name);
	const appRoot = path.join(projectRoot, appId);

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

	if (fs.existsSync(appRoot)) {
		log(`  ${RED}Folder already exists: ${appRoot}${RESET}\n`);
		return;
	}

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create application? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	log();
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

async function makeCliApp(projectRoot: string): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader("New CLI App");

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const rl = createRL();
	const name = await ask(rl, "App name (e.g., My CLI)");
	if (!name) { rl.close(); return; }

	const defaultId = toKebab(name);
	const appId = await ask(rl, "App ID", defaultId);
	rl.close();

	const cliRoot = path.join(projectRoot, appId);

	log();
	log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	log(`  ${DIM}ID: ${appId}${RESET}`);
	log(`  ${DIM}Output: ${cliRoot}${RESET}`);
	log();

	if (fs.existsSync(cliRoot)) {
		log(`  ${RED}Folder already exists: ${cliRoot}${RESET}\n`);
		return;
	}

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create CLI app? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	log();
	let created = 0;
	const w = (rel: string, content: string): void => { if (writeFileAt(cliRoot, rel, content)) created++; };

	w("package.json", cliPackageTemplate(name, appId));
	w("tsconfig.json", cliTsconfigTemplate());
	w("vitest.config.ts", cliVitestTemplate());
	w(".gitignore", cliGitignoreTemplate());
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

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	"make:hub": (flags: Record<string, string | boolean>) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:hub --name=Inventory [--icon=package] [--type=domain] [--tabs=overview,items]${RESET}\n`);
			process.exit(1);
		}
		const kebab = toKebab(name);
		const pascal = toPascal(name);
		const icon = (flags.icon as string) ?? "layout-grid";
		const hubType = (flags.type as string) ?? "domain";
		const tabs = ((flags.tabs as string) ?? "overview,items").split(",").map((t) => t.trim());
		const paths = getMakePaths();

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${pascal} Hub\n`);

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

		log(`\n  ${GREEN}✓${RESET} Created ${created} files.\n`);
	},

	"make:app": (flags: Record<string, string | boolean>) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:app --name="My App" [--id=my-app] [--author=Name]${RESET}\n`);
			process.exit(1);
		}
		const appId = (flags.id as string) ?? toKebab(name);
		const author = (flags.author as string) ?? (manifest as Record<string, unknown>).author as string ?? "";
		const pascal = toPascal(name);
		const appRoot = path.resolve(VAULT_ROOT, "01 - Projects", appId);

		if (fs.existsSync(appRoot)) {
			log(`\n  ${RED}Folder already exists: ${appRoot}${RESET}\n`);
			process.exit(1);
		}

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

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

		log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${appRoot}\n`);
	},

	"make:cli": (flags: Record<string, string | boolean>) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:cli --name="My CLI" [--id=my-cli]${RESET}\n`);
			process.exit(1);
		}
		const appId = (flags.id as string) ?? toKebab(name);
		const cliRoot = path.resolve(VAULT_ROOT, "01 - Projects", appId);

		if (fs.existsSync(cliRoot)) {
			log(`\n  ${RED}Folder already exists: ${cliRoot}${RESET}\n`);
			process.exit(1);
		}

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		let created = 0;
		const w = (rel: string, content: string): void => { if (writeFileAt(cliRoot, rel, content)) created++; };

		w("package.json", cliPackageTemplate(name, appId));
		w("tsconfig.json", cliTsconfigTemplate());
		w("vitest.config.ts", cliVitestTemplate());
		w(".gitignore", cliGitignoreTemplate());
		w("src/main.ts", cliMainTemplate(name));
		w("tests/main.test.ts", cliMainTestTemplate(name));

		log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${cliRoot}\n`);
	},

	"make:plugin": (flags: Record<string, string | boolean>) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:plugin --name="My Plugin" [--id=my-plugin] [--author=Name]${RESET}\n`);
			process.exit(1);
		}
		const pluginId = (flags.id as string) ?? toKebab(name);
		const author = (flags.author as string) ?? (manifest as Record<string, unknown>).author as string ?? "";
		const pluginRoot = path.resolve(ROOT, "..", pluginId);

		if (fs.existsSync(pluginRoot)) {
			log(`\n  ${RED}Folder already exists: ${pluginRoot}${RESET}\n`);
			process.exit(1);
		}

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

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

		log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${pluginRoot}\n`);
	},
};
