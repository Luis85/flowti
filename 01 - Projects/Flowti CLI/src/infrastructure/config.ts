/**
 * config.ts — Kernel-space path resolution and configuration loading.
 */

import { paths } from "./paths.js";
import type { FlowtiCliConfig } from "./types.js";
import { disk } from "./filesystem.js";

// ── Path resolution ──────────────────────────────────────────────────

const CLI_DIR: string = import.meta.dirname;
// Resolve project root from runtime location:
//   tsx:    src/infrastructure/ → ../../ = project root
//   bundle: bin/               → ../    = project root
function findProjectRoot(dir: string): string {
	let candidate = dir;
	// Walk up until we find configs/flowti-cli.config.json
	for (let i = 0; i < 4; i++) {
		if (disk.existsSync(paths.join(candidate, "configs", "flowti-cli.config.json"))) {
			return candidate;
		}
		candidate = paths.resolve(candidate, "..");
	}
	// Fallback: assume two levels up from src/infrastructure/
	return paths.resolve(dir, "..", "..");
}
export const CLI_PROJECT: string = findProjectRoot(CLI_DIR);
export const cliConfig: FlowtiCliConfig = JSON.parse(disk.readFileSync(paths.join(CLI_PROJECT, "configs", "flowti-cli.config.json"), "utf-8"));

export const VAULT_ROOT: string = paths.resolve(CLI_PROJECT, "..", "..");
export const PLUGIN_ROOT: string = paths.resolve(VAULT_ROOT, cliConfig.subsystems?.plugin?.root ?? "Development/flowti");
export const ROOT: string = PLUGIN_ROOT;

export const CONFIG_PATH: string = paths.join(ROOT, cliConfig.subsystems?.plugin?.config ?? "flowti.config.json");
const MANIFEST_PATH: string = paths.join(ROOT, cliConfig.subsystems?.plugin?.manifest ?? "manifest.json");
const PKG_PATH: string = paths.join(ROOT, cliConfig.subsystems?.plugin?.package ?? "package.json");

// ── JSON loader ──────────────────────────────────────────────────────

export function loadJson<T = unknown>(filePath: string): T | null {
	try {
		return JSON.parse(disk.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

// ── Loaded configs ───────────────────────────────────────────────────

export const config = loadJson<Record<string, unknown>>(CONFIG_PATH) ?? { paths: {}, build: {}, reports: { scripts: [] } };
export const manifest = loadJson<{ id: string; version: string }>(MANIFEST_PATH) ?? { id: "flowti-ibde", version: "?" };
export const pkg = loadJson<{ version: string }>(PKG_PATH) ?? { version: "?" };

// ── Projects directory ───────────────────────────────────────────────

export const PROJECTS_DIR: string = paths.join(VAULT_ROOT, cliConfig.projectsFolder ?? "01 - Projects");
export const DEVELOPMENT_DIR: string = paths.join(VAULT_ROOT, "Development");

// ── Capture config ──────────────────────────────────────────────────

const DEFAULT_CAPTURE = "00 - Connectivity/inbox";
export const captureConfig: Record<string, string> = cliConfig.capture ?? {};
export function getCaptureDir(type: string): string {
	const rel = captureConfig[type] ?? captureConfig["default"] ?? DEFAULT_CAPTURE;
	return paths.join(VAULT_ROOT, rel);
}
