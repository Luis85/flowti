/**
 * onboarding.mjs — Environment checks and first-run guidance.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, VAULT_ROOT, cliConfig } from "../../infrastructure/config.mjs";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.mjs";

const onb = cliConfig.onboarding ?? {};
const pluginId = onb.pluginId ?? "flowti-ibde";
const nodeMinVersion = onb.nodeMinVersion ?? 16;

export function checkPrerequisites() {
	const missing = [];

	try {
		execSync("git --version", { stdio: "ignore", windowsHide: true });
	} catch {
		missing.push({
			name: "Git",
			instruction: "Download and install from https://git-scm.com/downloads",
		});
	}

	try {
		const nodeVersion = execSync("node --version", { encoding: "utf-8", windowsHide: true }).trim();
		const major = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
		if (major < nodeMinVersion) {
			missing.push({
				name: `Node.js (found ${nodeVersion}, need v${nodeMinVersion}+)`,
				instruction: `Download Node.js v${nodeMinVersion}+ from https://nodejs.org`,
			});
		}
	} catch {
		missing.push({
			name: "Node.js",
			instruction: "Download and install from https://nodejs.org",
		});
	}

	if (missing.length > 0) {
		console.log(`\n  ${RED}${BOLD}Missing prerequisites:${RESET}\n`);
		for (const dep of missing) {
			console.log(`  ${RED}✗${RESET} ${dep.name}`);
			console.log(`    ${DIM}→ ${dep.instruction}${RESET}\n`);
		}
		console.log(`  ${DIM}Install the above, then run flowti again.${RESET}\n`);
		process.exit(2);
	}
}

export function ensureDependencies() {
	const nodeModulesPath = path.join(ROOT, "node_modules");
	if (fs.existsSync(nodeModulesPath)) return;

	console.log(`\n  ${YELLOW}Dependencies not installed.${RESET}`);
	console.log(`  ${CYAN}▸${RESET} Running npm install...\n`);

	try {
		execSync("npm install", { cwd: ROOT, stdio: "inherit" });
		console.log(`\n  ${GREEN}✓${RESET} Dependencies installed.\n`);
	} catch {
		console.log(`\n  ${RED}✗${RESET} npm install failed. Check errors above and try again.\n`);
		process.exit(1);
	}
}

export function checkFirstRun() {
	const mainJs = path.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	if (!fs.existsSync(mainJs)) {
		console.log(`  ${YELLOW}Plugin not yet built.${RESET} Select ${BOLD}Build${RESET} (option 2) to get started.\n`);
	}
}

export function showPostBuildGuidance() {
	const mainJs = path.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	if (!fs.existsSync(mainJs)) return;

	console.log(`  ${GREEN}${BOLD}Plugin built successfully!${RESET}\n`);
	console.log(`  ${BOLD}Next steps:${RESET}`);
	console.log(`    1. Open this folder as an Obsidian vault: ${DIM}${VAULT_ROOT}${RESET}`);
	console.log(`    2. Go to ${CYAN}Settings → Community Plugins → Enable "Flowti - IBDE"${RESET}`);
	console.log(`    3. Follow the Installer Wizard to set up your vault\n`);
}
