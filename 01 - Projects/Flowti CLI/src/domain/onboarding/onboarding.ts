/**
 * onboarding.ts — Environment checks and first-run guidance.
 */

import { paths } from "../../infrastructure/paths.js";
import { ROOT, VAULT_ROOT, cliConfig } from "../../infrastructure/config.js";
import { disk } from "../../infrastructure/filesystem.js";
import { shell } from "../../infrastructure/shell.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";
import type { IFileSystem, IShell } from "../../types.js";

const onb = cliConfig.onboarding ?? {};
const pluginId = onb.pluginId ?? "flowti-ibde";
const nodeMinVersion = onb.nodeMinVersion ?? 16;

export interface OnboardingDeps {
	fs?: IFileSystem;
	sh?: IShell;
	exit?: (code: number) => void;
}

const defaults: Required<OnboardingDeps> = {
	fs: disk,
	sh: shell,
	exit: (code: number) => proc.exit(code),
};

export function checkPrerequisites(deps: OnboardingDeps = {}): void {
	const { sh, exit } = { ...defaults, ...deps };
	const missing: Array<{ name: string; instruction: string }> = [];

	if (!sh.check("git --version")) {
		missing.push({
			name: "Git",
			instruction: "Download and install from https://git-scm.com/downloads",
		});
	}

	const nodeVersion = sh.runSilent("node --version");
	if (!nodeVersion) {
		missing.push({
			name: "Node.js",
			instruction: "Download and install from https://nodejs.org",
		});
	} else {
		const major = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
		if (major < nodeMinVersion) {
			missing.push({
				name: `Node.js (found ${nodeVersion}, need v${nodeMinVersion}+)`,
				instruction: `Download Node.js v${nodeMinVersion}+ from https://nodejs.org`,
			});
		}
	}

	if (missing.length > 0) {
		log(`\n  ${RED}${BOLD}Missing prerequisites:${RESET}\n`);
		for (const dep of missing) {
			log(`  ${RED}✗${RESET} ${dep.name}`);
			log(`    ${DIM}→ ${dep.instruction}${RESET}\n`);
		}
		log(`  ${DIM}Install the above, then run flowti again.${RESET}\n`);
		exit(2);
	}
}

export function ensureDependencies(deps: OnboardingDeps = {}): void {
	const { fs, sh, exit } = { ...defaults, ...deps };
	const nodeModulesPath = paths.join(ROOT, "node_modules");
	if (fs.existsSync(nodeModulesPath)) return;

	log(`\n  ${YELLOW}Dependencies not installed.${RESET}`);
	log(`  ${CYAN}▸${RESET} Running npm install...\n`);

	const code = sh.run("npm install", { cwd: ROOT, label: "npm install" });
	if (code === 0) {
		log(`\n  ${GREEN}✓${RESET} Dependencies installed.\n`);
	} else {
		log(`\n  ${RED}✗${RESET} npm install failed. Check errors above and try again.\n`);
		exit(1);
	}
}

export function checkFirstRun(deps: OnboardingDeps = {}): void {
	const { fs } = { ...defaults, ...deps };
	const mainJs = paths.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	if (!fs.existsSync(mainJs)) {
		log(`  ${YELLOW}Plugin not yet built.${RESET} Select ${BOLD}Build${RESET} (option 2) to get started.\n`);
	}
}

export function showPostBuildGuidance(deps: OnboardingDeps = {}): void {
	const { fs } = { ...defaults, ...deps };
	const mainJs = paths.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	if (!fs.existsSync(mainJs)) return;

	log(`  ${GREEN}${BOLD}Plugin built successfully!${RESET}\n`);
	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. Open this folder as an Obsidian vault: ${DIM}${VAULT_ROOT}${RESET}`);
	log(`    2. Go to ${CYAN}Settings → Community Plugins → Enable "Flowti - IBDE"${RESET}`);
	log(`    3. Follow the Installer Wizard to set up your vault\n`);
}
