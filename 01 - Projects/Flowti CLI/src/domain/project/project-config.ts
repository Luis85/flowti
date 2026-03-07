/**
 * project-config.ts — Per-project configuration service.
 *
 * Detects package.json in the selected project, auto-creates a
 * flowti.config.json if missing, and provides project-scoped
 * data (npm scripts, mapped actions) to the detail menu.
 */

import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR, DEVELOPMENT_DIR } from "../../infrastructure/config.js";
import { getProjectSource } from "../../infrastructure/state.js";
import type { ProjectConfig, ProjectSource, FlowtiToolId } from "../../types.js";

const CONFIGS_DIR = "configs";
const FLOWTI_CONFIG = "flowti.config.json";

// ── Path resolution ─────────────────────────────────────────────────

export function resolveProjectPath(name: string, source?: ProjectSource): string {
	const s = source ?? getProjectSource();
	return s === "development"
		? path.join(DEVELOPMENT_DIR, name)
		: path.join(PROJECTS_DIR, name);
}

// ── Package.json ────────────────────────────────────────────────────

export interface PackageJson {
	name?: string;
	version?: string;
	scripts?: Record<string, string>;
}

export function readPackageJson(projectPath: string): PackageJson | null {
	const pkgPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(pkgPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;
	} catch {
		return null;
	}
}

// ── Flowti project config ───────────────────────────────────────────

export function readProjectConfig(projectPath: string): ProjectConfig | null {
	const cfgPath = path.join(projectPath, CONFIGS_DIR, FLOWTI_CONFIG);
	if (!fs.existsSync(cfgPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(cfgPath, "utf-8")) as ProjectConfig;
	} catch {
		return null;
	}
}

function scaffoldProjectConfig(projectPath: string, pkg: PackageJson): ProjectConfig {
	const scripts = pkg.scripts ?? {};
	const tools: Partial<Record<FlowtiToolId, string>> = {};

	// Auto-map well-known script names to Flowti tool keys
	if (scripts["build"]) tools.build = "npm run build";
	if (scripts["reports"]) tools.reports = "npm run reports";
	if (scripts["dev"]) tools.devtools = "npm run dev";

	const config: ProjectConfig = {
		name: pkg.name ?? path.basename(projectPath),
		tools,
	};

	const configsDir = path.join(projectPath, CONFIGS_DIR);
	if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir, { recursive: true });
	const cfgPath = path.join(configsDir, FLOWTI_CONFIG);
	fs.writeFileSync(cfgPath, JSON.stringify(config, null, "\t"), "utf-8");
	return config;
}

// ── Initialize project ──────────────────────────────────────────────

export interface ProjectContext {
	path: string;
	pkg: PackageJson | null;
	config: ProjectConfig;
	scripts: Record<string, string>;
}

export function initializeProject(name: string, source?: ProjectSource): ProjectContext {
	const projectPath = resolveProjectPath(name, source);
	const pkg = readPackageJson(projectPath);

	let config = readProjectConfig(projectPath);

	if (!config && pkg) {
		config = scaffoldProjectConfig(projectPath, pkg);
	}

	if (!config) {
		config = { name };
	}

	return {
		path: projectPath,
		pkg,
		config,
		scripts: pkg?.scripts ?? {},
	};
}
