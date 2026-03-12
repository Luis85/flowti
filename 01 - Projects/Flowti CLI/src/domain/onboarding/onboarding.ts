/**
 * onboarding.ts — Environment checks and first-run guidance.
 *
 * Pure domain logic — returns data models instead of logging.
 * Display is handled by ui/onboarding-display.ts.
 */

import { PLUGIN_ROOT, VAULT_ROOT, cliConfig } from "../../infrastructure/config.js";
import type { CliDeps } from "../../infrastructure/deps.js";

const onb = cliConfig.onboarding ?? {};
const pluginId = onb.pluginId ?? "flowti-ibde";
const nodeMinVersion = onb.nodeMinVersion ?? 16;

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

export function checkPrerequisiteIssues(deps: Pick<CliDeps, "shell">): PrerequisiteIssue[] {
	const missing: PrerequisiteIssue[] = [];

	if (!deps.shell.check("git --version")) {
		missing.push({
			name: "Git",
			instruction: "Download and install from https://git-scm.com/downloads",
		});
	}

	const nodeVersion = deps.shell.runSilent("node --version");
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

export function checkPrerequisites(deps: Pick<CliDeps, "shell" | "proc">): void {
	const missing = checkPrerequisiteIssues(deps);
	if (missing.length > 0) {
		deps.proc.exit(2);
	}
}

export function installDependencies(projectPath: string, deps: Pick<CliDeps, "disk" | "shell" | "paths" | "proc">): DependencyResult {
	const nodeModulesPath = deps.paths.join(projectPath, "node_modules");
	if (deps.disk.existsSync(nodeModulesPath)) return { installed: false, alreadyPresent: true };

	const code = deps.shell.run("npm install", { cwd: projectPath, label: "npm install" });
	if (code === 0) {
		return { installed: true, alreadyPresent: false };
	} else {
		deps.proc.exit(1);
		return { installed: false, alreadyPresent: false };
	}
}

export function ensureDependencies(projectPath: string = PLUGIN_ROOT, deps: Pick<CliDeps, "disk" | "shell" | "paths" | "proc">): void {
	installDependencies(projectPath, deps);
}

export function getFirstRunStatus(deps: Pick<CliDeps, "disk" | "paths">): FirstRunStatus {
	const mainJs = deps.paths.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	return { pluginBuilt: deps.disk.existsSync(mainJs) };
}

export function checkFirstRun(deps: Pick<CliDeps, "disk" | "paths">): void {
	// Kept for backward compatibility — callers should use getFirstRunStatus()
	getFirstRunStatus(deps);
}

export function getPostBuildGuidance(deps: Pick<CliDeps, "disk" | "paths">): PostBuildGuidance {
	const mainJs = deps.paths.join(VAULT_ROOT, ".obsidian", "plugins", pluginId, "main.js");
	return { show: deps.disk.existsSync(mainJs), vaultRoot: VAULT_ROOT };
}

export function showPostBuildGuidance(deps: Pick<CliDeps, "disk" | "paths">): void {
	// Kept for backward compatibility — callers should use getPostBuildGuidance()
	getPostBuildGuidance(deps);
}
