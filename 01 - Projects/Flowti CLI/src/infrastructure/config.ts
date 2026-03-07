/**
 * config.ts — Kernel-space path resolution and configuration loading.
 */

import fs from "node:fs";
import path from "node:path";
import type { FlowtiCliConfig } from "../types.js";

// ── Path resolution ──────────────────────────────────────────────────

const CLI_DIR: string = import.meta.dirname;                                // src/infrastructure/ or bin/src/infrastructure/
const RAW_ROOT: string = path.resolve(CLI_DIR, "..", "..");
export const CLI_PROJECT: string = path.basename(RAW_ROOT) === "bin"        // compiled output lives one level deeper
	? path.resolve(RAW_ROOT, "..")
	: RAW_ROOT;
export const cliConfig: FlowtiCliConfig = JSON.parse(fs.readFileSync(path.join(CLI_PROJECT, "configs", "flowti-cli.config.json"), "utf-8"));

export const VAULT_ROOT: string = path.resolve(CLI_PROJECT, "..", "..");
export const PLUGIN_ROOT: string = path.resolve(VAULT_ROOT, cliConfig.subsystems?.plugin?.root ?? "Development/flowti");
export const ROOT: string = PLUGIN_ROOT;

export const CONFIG_PATH: string = path.join(ROOT, cliConfig.subsystems?.plugin?.config ?? "flowti.config.json");
const MANIFEST_PATH: string = path.join(ROOT, cliConfig.subsystems?.plugin?.manifest ?? "manifest.json");
const PKG_PATH: string = path.join(ROOT, cliConfig.subsystems?.plugin?.package ?? "package.json");

// ── JSON loader ──────────────────────────────────────────────────────

export function loadJson<T = unknown>(filePath: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

// ── Loaded configs ───────────────────────────────────────────────────

export const config = loadJson<Record<string, unknown>>(CONFIG_PATH) ?? { paths: {}, build: {}, reports: { scripts: [] } };
export const manifest = loadJson<{ id: string; version: string }>(MANIFEST_PATH) ?? { id: "flowti-ibde", version: "?" };
export const pkg = loadJson<{ version: string }>(PKG_PATH) ?? { version: "?" };

// ── Projects directory ───────────────────────────────────────────────

export const PROJECTS_DIR: string = path.join(VAULT_ROOT, cliConfig.projectsFolder ?? "01 - Projects");

// ── Capture config ──────────────────────────────────────────────────

const DEFAULT_CAPTURE = "00 - Connectivity/inbox";
export const captureConfig: Record<string, string> = cliConfig.capture ?? {};
export function getCaptureDir(type: string): string {
	const rel = captureConfig[type] ?? captureConfig["default"] ?? DEFAULT_CAPTURE;
	return path.join(VAULT_ROOT, rel);
}
