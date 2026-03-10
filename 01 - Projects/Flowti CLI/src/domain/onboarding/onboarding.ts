/**
 * onboarding.ts — Environment checks and first-run guidance.
 *
 * Pure domain logic — returns data models instead of logging.
 * Display is handled by ui/onboarding-display.ts.
 */

import { paths } from "../../infrastructure/paths.js";
import { PLUGIN_ROOT, VAULT_ROOT, cliConfig } from "../../infrastructure/config.js";
import { disk } from "../../infrastructure/filesystem.js";
import { shell } from "../../infrastructure/shell.js";
import { proc } from "../../infrastructure/proc.js";
import type { IFileSystem, IShell } from "../../infrastructure/types.js";

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

// ── Data models ──────────────────────────────────────────────────────

export interface PrerequisiteIssue {
	name: string;
	instruction: string;
}

export interface DependencyResult {
	installed: boolean;
	alreadyPresent: boolean;
}

export interface FirstRunStatus {
	pluginBuilt: boolean;
}

export interface PostBuildGuidance {
	show: boolean;
	vaultRoot: string;
}

// ── Pure checks ─────────────────────────────────────────────────────

export function checkPrerequisiteIssues(deps: OnboardingDeps = {}): PrerequisiteIssue[] {
	const { sh } = { ...defaults, ...deps };
	const missing: PrerequisiteIssue[] = [];

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

	return missing;
}

export function checkPrerequisites(deps: OnboardingDeps = {}): void {
	const { exit } = { ...defaults, ...deps };
	const missing = checkPrerequisiteIssues(deps);
	if (missing.length > 0) {
		exit(2);
	}
}

export function installDependencies(projectPath: string, deps: OnboardingDeps = {}): DependencyResult {
	const { fs, sh, exit } = { ...defaults, ...deps };
	const nodeModulesPath = paths.join(projectPath, "node_modules");
	if (fs.existsSync(nodeModulesPath)) return { installed: false, alreadyPresent: true };

	const code = sh.run("npm install", { cwd: projectPath, label: "npm install" });
	if (code === 0) {
		return { installed: true, alreadyPresent: false };
	} else {
		exit(1);
		return { installed: false, alreadyPresent: false };
	}
}

export function ensureDependencies(projectPath: string = PLUGIN_ROOT, deps: OnboardingDeps = {}): void {
	installDependencies(projectPath, deps);
}

export function getFirstRunStatus(deps: OnboardingDeps = {}): FirstRunStatus {
	const { fs } = { ...defaults, ...deps };
	const mainJs = paths.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	return { pluginBuilt: fs.existsSync(mainJs) };
}

export function checkFirstRun(deps: OnboardingDeps = {}): void {
	// Kept for backward compatibility — callers should use getFirstRunStatus()
	getFirstRunStatus(deps);
}

export function getPostBuildGuidance(deps: OnboardingDeps = {}): PostBuildGuidance {
	const { fs } = { ...defaults, ...deps };
	const mainJs = paths.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	return { show: fs.existsSync(mainJs), vaultRoot: VAULT_ROOT };
}

export function showPostBuildGuidance(deps: OnboardingDeps = {}): void {
	// Kept for backward compatibility — callers should use getPostBuildGuidance()
	getPostBuildGuidance(deps);
}
