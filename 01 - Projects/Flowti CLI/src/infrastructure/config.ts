/**
 * config.ts — Kernel-space path resolution and configuration loading.
 *
 * Resolution strategy (vault-root-first):
 *   1. Walk up from import.meta.dirname looking for .flowti/config.json
 *   2. Fallback: look for configs/flowti-cli.config.json (legacy layout)
 *
 * Runtime locations:
 *   Bundle:  .flowti/bin/main.js      → vault root is ../..
 *   Boot:    .flowti/bin/index.js     → bootstraps then runs main.js
 *   tsx dev: src/infrastructure/      → walk up to find .flowti/
 */

import { paths } from "./paths.js";
import type { FlowtiCliConfig } from "./types.js";
import { disk } from "./filesystem.js";

// ── Path resolution ──────────────────────────────────────────────────

const CLI_DIR: string = import.meta.dirname;

/** Walk up from `dir` looking for `.flowti/config.json` (new layout). */
function findVaultRoot(dir: string): string | null {
	let candidate = dir;
	for (let i = 0; i < 6; i++) {
		if (disk.existsSync(paths.join(candidate, ".flowti", "config.json"))) {
			return candidate;
		}
		const parent = paths.resolve(candidate, "..");
		if (parent === candidate) break;
		candidate = parent;
	}
	return null;
}

/** Walk up from `dir` looking for `configs/flowti-cli.config.json` (legacy layout). */
function findProjectRoot(dir: string): string | null {
	let candidate = dir;
	for (let i = 0; i < 6; i++) {
		if (disk.existsSync(paths.join(candidate, "configs", "flowti-cli.config.json"))) {
			return candidate;
		}
		const parent = paths.resolve(candidate, "..");
		if (parent === candidate) break;
		candidate = parent;
	}
	return null;
}

// ── Resolution: try vault-root-first, then legacy ────────────────────

let resolvedVaultRoot: string;
let resolvedCliProject: string;
let resolvedConfig: FlowtiCliConfig;

const vaultRoot = findVaultRoot(CLI_DIR);
if (vaultRoot) {
	resolvedVaultRoot = vaultRoot;
	resolvedConfig = JSON.parse(disk.readFileSync(paths.join(vaultRoot, ".flowti", "config.json"), "utf-8"));
	resolvedCliProject = paths.resolve(vaultRoot, resolvedConfig.source ?? "01 - Projects/Flowti CLI");
} else {
	const projectRoot = findProjectRoot(CLI_DIR);
	resolvedCliProject = projectRoot ?? paths.resolve(CLI_DIR, "..", "..");
	resolvedConfig = JSON.parse(disk.readFileSync(paths.join(resolvedCliProject, "configs", "flowti-cli.config.json"), "utf-8"));
	resolvedVaultRoot = paths.resolve(resolvedCliProject, "..", "..");
}

export const VAULT_ROOT: string = resolvedVaultRoot;
export const CLI_PROJECT: string = resolvedCliProject;
export const cliConfig: FlowtiCliConfig = resolvedConfig;

export const PLUGIN_ROOT: string = paths.resolve(VAULT_ROOT, cliConfig.subsystems?.plugin?.root ?? "Development/flowti");

// ── JSON loader ──────────────────────────────────────────────────────

export function loadJson<T = unknown>(filePath: string): T | null {
	try {
		return JSON.parse(disk.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

// ── Projects directory ───────────────────────────────────────────────

export const PROJECTS_DIR: string = paths.join(VAULT_ROOT, cliConfig.projectsFolder ?? "01 - Projects");

// ── Capture config ──────────────────────────────────────────────────

const DEFAULT_CAPTURE = "00 - Connectivity/inbox";
export const captureConfig: Record<string, string> = cliConfig.capture ?? {};
export function getCaptureDir(type: string): string {
	const rel = captureConfig[type] ?? captureConfig["default"] ?? DEFAULT_CAPTURE;
	return paths.join(VAULT_ROOT, rel);
}
