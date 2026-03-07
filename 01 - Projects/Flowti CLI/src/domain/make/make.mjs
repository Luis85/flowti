/**
 * make.mjs — Scaffolding menu and commands for hubs and plugins.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, config, manifest } from "../../infrastructure/config.mjs";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW, printHeader } from "../../infrastructure/ui.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { writeFile } from "../../infrastructure/fs.mjs";
import { runMenu } from "../../infrastructure/menu.mjs";
import { showHelp } from "../help/help.mjs";
import { toKebab, toPascal, getMakePaths } from "./naming.mjs";
import {
	hubViewTemplate, hubTypesTemplate, hubEventsTemplate, hubServiceTemplate,
	hubProviderTemplate, hubTestTemplate, hubCssTemplate, hubPrdTemplate,
	hubJourneyTemplate, pluginManifestTemplate, pluginPackageTemplate,
	pluginTsconfigTemplate, pluginEsbuildTemplate, pluginMainTemplate,
	pluginGitignoreTemplate,
} from "./templates.mjs";

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	return runMenu("Make", [
		{ key: "1", label: "New Hub (within Flowti)", action: makeHub },
		{ key: "2", label: "New Plugin (standalone Obsidian plugin)", action: makePlugin },
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("make"); } },
		{ key: "b", label: "Back", action: () => "main" },
		{ key: "q", label: "Quit", action: () => "quit" },
	]);
}

// ── Hub scaffolding ─────────────────────────────────────────────────

async function makeHub() {
	printHeader("New Hub");
	const paths = getMakePaths();

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

	console.log(`  ${DIM}Output paths (from flowti.config.json):${RESET}`);
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

	if (writeFile(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs))) created++;
	if (writeFile(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs))) created++;
	if (writeFile(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal))) created++;
	if (writeFile(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal))) created++;
	if (writeFile(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon))) created++;
	if (writeFile(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab))) created++;

	const cssFiles = fs.existsSync(path.join(ROOT, paths.css))
		? fs.readdirSync(path.join(ROOT, paths.css)).filter((f) => f.endsWith(".css")).sort()
		: [];
	const maxNum = cssFiles.reduce((max, f) => {
		const m = f.match(/^(\d+)/);
		return m ? Math.max(max, parseInt(m[1], 10)) : max;
	}, 0);
	const cssNum = String(maxNum + 1).padStart(2, "0");
	if (writeFile(`${paths.css}/${cssNum}-${kebab}.css`, hubCssTemplate(pascal, kebab))) created++;

	if (writeFile(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal))) created++;
	if (writeFile(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab))) created++;

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

async function makePlugin() {
	printHeader("New Plugin");

	const outputBase = config.make?.plugin?.output ?? "../";

	const rl = createRL();
	const name = await ask(rl, "Plugin name (e.g., My Plugin)");
	if (!name) { rl.close(); return; }

	const defaultId = toKebab(name);
	const pluginId = await ask(rl, "Plugin ID", defaultId);
	const author = await ask(rl, "Author", manifest.author ?? "");
	const outputDir = await ask(rl, "Output folder", outputBase);
	rl.close();

	const pluginRoot = path.join(outputDir, pluginId);
	const absRoot = path.resolve(ROOT, pluginRoot);

	console.log();
	console.log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	console.log(`  ${DIM}ID: ${pluginId} | Author: ${author}${RESET}`);
	console.log(`  ${DIM}Output: ${absRoot}${RESET}`);
	console.log();

	if (fs.existsSync(absRoot)) {
		console.log(`  ${RED}Folder already exists: ${absRoot}${RESET}\n`);
		return;
	}

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create plugin? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	console.log();
	let created = 0;

	const w = (rel, content) => {
		if (writeFile(path.join(pluginRoot, rel), content)) created++;
	};

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
	console.log(`    1. ${CYAN}cd ${absRoot}${RESET}`);
	console.log(`    2. ${CYAN}npm install${RESET}`);
	console.log(`    3. ${CYAN}npm run build:dev${RESET}`);
	console.log(`    4. Open the vault containing this plugin in Obsidian`);
	console.log();
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	"make:hub": (flags) => {
		const name = flags.name;
		if (!name) {
			console.log(`\n  ${RED}--name is required.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- make:hub --name=Inventory [--icon=package] [--type=domain] [--tabs=overview,items]${RESET}\n`);
			process.exit(1);
		}
		const kebab = toKebab(name);
		const pascal = toPascal(name);
		const icon = flags.icon ?? "layout-grid";
		const hubType = flags.type ?? "domain";
		const tabs = (flags.tabs ?? "overview,items").split(",").map((t) => t.trim());
		const paths = getMakePaths();

		console.log(`\n  ${CYAN}▸${RESET} Scaffolding: ${pascal} Hub\n`);

		let created = 0;
		if (writeFile(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs))) created++;
		if (writeFile(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs))) created++;
		if (writeFile(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal))) created++;
		if (writeFile(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal))) created++;
		if (writeFile(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon))) created++;
		if (writeFile(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab))) created++;

		const cssFiles = fs.existsSync(path.join(ROOT, paths.css))
			? fs.readdirSync(path.join(ROOT, paths.css)).filter((f) => f.endsWith(".css")).sort() : [];
		const maxNum = cssFiles.reduce((max, f) => { const m = f.match(/^(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
		if (writeFile(`${paths.css}/${String(maxNum + 1).padStart(2, "0")}-${kebab}.css`, hubCssTemplate(pascal, kebab))) created++;
		if (writeFile(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal))) created++;
		if (writeFile(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab))) created++;

		console.log(`\n  ${GREEN}✓${RESET} Created ${created} files.\n`);
	},

	"make:plugin": (flags) => {
		const name = flags.name;
		if (!name) {
			console.log(`\n  ${RED}--name is required.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- make:plugin --name="My Plugin" [--id=my-plugin] [--author=Name] [--output=../]${RESET}\n`);
			process.exit(1);
		}
		const pluginId = flags.id ?? toKebab(name);
		const author = flags.author ?? manifest.author ?? "";
		const outputDir = flags.output ?? config.make?.plugin?.output ?? "../";
		const pluginRoot = path.join(outputDir, pluginId);
		const absRoot = path.resolve(ROOT, pluginRoot);

		if (fs.existsSync(absRoot)) {
			console.log(`\n  ${RED}Folder already exists: ${absRoot}${RESET}\n`);
			process.exit(1);
		}

		console.log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		let created = 0;
		const w = (rel, content) => { if (writeFile(path.join(pluginRoot, rel), content)) created++; };

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

		console.log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${absRoot}\n`);
	},
};
