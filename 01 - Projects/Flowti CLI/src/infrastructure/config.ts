/**
 * config.ts — Kernel-space path resolution and configuration loading.
 *
 * Resolution strategy:
 *   1. FLOWTI_VAULT_ROOT env var — set by bootstrap.mjs (production)
 *   2. Walk up from process.cwd() looking for .flowti/config.json (dev/tsx)
 *
 * Configuration: .flowti/config.json at the vault root.
 */

import { paths } from "./paths.js";
import type { FlowtiCliConfig } from "./types.js";
import { disk } from "./filesystem.js";
import { proc } from "./proc.js";

// ── Path resolution ──────────────────────────────────────────────────

/** Walk up from `dir` looking for `.flowti/config.json`. */
function findVaultRoot(dir: string): string | null {
	let candidate = dir;
	for (let i = 0; i < 10; i++) {
		if (disk.existsSync(paths.join(candidate, ".flowti", "config.json"))) {
			return candidate;
		}
		const parent = paths.resolve(candidate, "..");
		if (parent === candidate) break;
		candidate = parent;
	}
	return null;
}

/**
 * Resolve the vault root directory.
 *
 * 1. FLOWTI_VAULT_ROOT env var (set by bootstrap in production)
 * 2. Walk up from process.cwd() to find .flowti/config.json (dev mode)
 */
function resolveVaultRoot(): string {
	const fromEnv = proc.env()["FLOWTI_VAULT_ROOT"];
	if (fromEnv && disk.existsSync(paths.join(fromEnv, ".flowti", "config.json"))) {
		return fromEnv;
	}

	const fromCwd = findVaultRoot(proc.cwd());
	if (fromCwd) return fromCwd;

	throw new Error(
		"[flowti] Cannot locate vault root.\n" +
		"  Set FLOWTI_VAULT_ROOT or run from within the vault directory.",
	);
}

// ── Resolution ───────────────────────────────────────────────────────

const resolvedVaultRoot: string = resolveVaultRoot();
const resolvedConfig: FlowtiCliConfig = JSON.parse(
	disk.readFileSync(paths.join(resolvedVaultRoot, ".flowti", "config.json"), "utf-8"),
);
const resolvedCliProject: string = paths.resolve(resolvedVaultRoot, resolvedConfig.source ?? "01 - Projects/Flowti CLI");

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
