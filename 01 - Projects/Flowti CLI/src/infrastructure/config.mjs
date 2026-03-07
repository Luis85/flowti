/**
 * config.mjs — Kernel-space path resolution and configuration loading.
 */

import fs from "node:fs";
import path from "node:path";

// ── Path resolution ──────────────────────────────────────────────────

const CLI_DIR = import.meta.dirname;                       // src/infrastructure/
export const CLI_PROJECT = path.resolve(CLI_DIR, "..", "..");      // 01 - Projects/Flowti CLI/
export const cliConfig = JSON.parse(fs.readFileSync(path.join(CLI_PROJECT, "configs", "flowti-cli.config.json"), "utf-8"));

export const VAULT_ROOT = path.resolve(CLI_PROJECT, "..", "..");
export const PLUGIN_ROOT = path.resolve(VAULT_ROOT, cliConfig.subsystems?.plugin?.root ?? "Development/flowti");
export const ROOT = PLUGIN_ROOT;

export const CONFIG_PATH = path.join(ROOT, cliConfig.subsystems?.plugin?.config ?? "flowti.config.json");
const MANIFEST_PATH = path.join(ROOT, cliConfig.subsystems?.plugin?.manifest ?? "manifest.json");
const PKG_PATH = path.join(ROOT, cliConfig.subsystems?.plugin?.package ?? "package.json");

// ── JSON loader ──────────────────────────────────────────────────────

export function loadJson(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

// ── Loaded configs ───────────────────────────────────────────────────

export const config = loadJson(CONFIG_PATH) ?? { paths: {}, build: {}, reports: { scripts: [] } };
export const manifest = loadJson(MANIFEST_PATH) ?? { id: "flowti-ibde", version: "?" };
export const pkg = loadJson(PKG_PATH) ?? { version: "?" };

// ── Capture config ──────────────────────────────────────────────────

const DEFAULT_CAPTURE = "00 - Connectivity/inbox";
export const captureConfig = cliConfig.capture ?? {};
export function getCaptureDir(type) {
	const rel = captureConfig[type] ?? captureConfig.default ?? DEFAULT_CAPTURE;
	return path.join(VAULT_ROOT, rel);
}
