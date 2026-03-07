/**
 * info.ts — Project information and diagnostics.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, CONFIG_PATH, config, manifest, pkg } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { runSilent } from "../../infrastructure/shell.js";
import { countFiles } from "../../infrastructure/fs.js";

export function showInfo(): void {
	printHeader("Info");

	const m = manifest as Record<string, unknown>;
	console.log(`  ${BOLD}Plugin${RESET}`);
	console.log(`    Name:          ${m.name ?? "?"}`);
	console.log(`    ID:            ${m.id ?? "?"}`);
	console.log(`    Version:       ${m.version ?? "?"}`);
	console.log(`    Min Obsidian:  ${m.minAppVersion ?? "?"}`);
	console.log(`    Author:        ${m.author ?? "?"}`);
	console.log();

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

	const p = pkg as Record<string, unknown>;
	const devDeps = Object.keys((p.devDependencies as Record<string, string>) ?? {}).length;
	const prodDeps = Object.keys((p.dependencies as Record<string, string>) ?? {}).length;
	const npmScripts = Object.keys((p.scripts as Record<string, string>) ?? {}).length;

	console.log(`  ${BOLD}Dependencies${RESET}`);
	console.log(`    Production:     ${prodDeps}`);
	console.log(`    Development:    ${devDeps}`);
	console.log(`    npm scripts:    ${npmScripts}`);
	console.log();

	const branch = runSilent("git rev-parse --abbrev-ref HEAD");
	const commit = runSilent("git rev-parse --short HEAD");
	const dirty = runSilent("git status --porcelain");

	console.log(`  ${BOLD}Git${RESET}`);
	console.log(`    Branch:         ${branch ?? "?"}`);
	console.log(`    Commit:         ${commit ?? "?"}`);
	console.log(`    Status:         ${dirty ? `${YELLOW}dirty${RESET}` : `${GREEN}clean${RESET}`}`);
	console.log();

	const c = config as Record<string, unknown>;
	const reports = c.reports as Record<string, unknown> | undefined;
	const paths = c.paths as Record<string, string> | undefined;
	const reportCount = (reports?.scripts as unknown[] ?? []).length;
	const endpointsFile = paths?.endpointsFile ?? "build-endpoints.json";
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
