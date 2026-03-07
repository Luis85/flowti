/**
 * info.mjs — Project information and diagnostics.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, CONFIG_PATH, config, manifest, pkg } from "../../infrastructure/config.mjs";
import { RESET, BOLD, DIM, GREEN, YELLOW, printHeader } from "../../infrastructure/ui.mjs";
import { runSilent } from "../../infrastructure/shell.mjs";
import { countFiles } from "../../infrastructure/fs.mjs";

export function showInfo() {
	printHeader("Info");

	// Plugin info
	console.log(`  ${BOLD}Plugin${RESET}`);
	console.log(`    Name:          ${manifest.name ?? "?"}`);
	console.log(`    ID:            ${manifest.id ?? "?"}`);
	console.log(`    Version:       ${manifest.version ?? "?"}`);
	console.log(`    Min Obsidian:  ${manifest.minAppVersion ?? "?"}`);
	console.log(`    Author:        ${manifest.author ?? "?"}`);
	console.log();

	// Source stats
	const srcDir = path.join(ROOT, "src");
	const testsDir = path.join(ROOT, "tests");
	const srcCount = countFiles(srcDir, ".ts");
	const testCount = countFiles(testsDir, ".ts");
	const cssDir = path.join(ROOT, "css");
	const cssCount = countFiles(cssDir, ".css");
	const scriptCount = fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => f.endsWith(".mjs")).length;

	console.log(`  ${BOLD}Source${RESET}`);
	console.log(`    Source files:   ${srcCount} .ts files`);
	console.log(`    Test files:     ${testCount} .ts files`);
	console.log(`    CSS layers:     ${cssCount} files`);
	console.log(`    Scripts:        ${scriptCount} .mjs files`);
	console.log();

	// Dependencies
	const devDeps = Object.keys(pkg.devDependencies ?? {}).length;
	const prodDeps = Object.keys(pkg.dependencies ?? {}).length;
	const npmScripts = Object.keys(pkg.scripts ?? {}).length;

	console.log(`  ${BOLD}Dependencies${RESET}`);
	console.log(`    Production:     ${prodDeps}`);
	console.log(`    Development:    ${devDeps}`);
	console.log(`    npm scripts:    ${npmScripts}`);
	console.log();

	// Git
	const branch = runSilent("git rev-parse --abbrev-ref HEAD");
	const commit = runSilent("git rev-parse --short HEAD");
	const dirty = runSilent("git status --porcelain");

	console.log(`  ${BOLD}Git${RESET}`);
	console.log(`    Branch:         ${branch ?? "?"}`);
	console.log(`    Commit:         ${commit ?? "?"}`);
	console.log(`    Status:         ${dirty ? `${YELLOW}dirty${RESET}` : `${GREEN}clean${RESET}`}`);
	console.log();

	// Config
	const reportCount = (config.reports?.scripts ?? []).length;
	const endpointsFile = config.paths?.endpointsFile ?? "build-endpoints.json";
	const endpointsExist = fs.existsSync(path.join(ROOT, endpointsFile));

	console.log(`  ${BOLD}Config${RESET}`);
	console.log(`    Reports:        ${reportCount} generators configured`);
	console.log(`    Endpoints:      ${endpointsExist ? `${GREEN}found${RESET} (${endpointsFile})` : `${DIM}not found${RESET}`}`);
	console.log(`    Config file:    ${fs.existsSync(CONFIG_PATH) ? `${GREEN}found${RESET}` : `${YELLOW}missing${RESET}`}`);
	console.log();
}

export const commands = {
	info: () => { showInfo(); },
};
