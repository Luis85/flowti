/**
 * project-config.ts — Per-project configuration service.
 *
 * Detects package.json in the selected project, auto-creates a
 * flowti.config.json if missing, and provides project-scoped
 * data (npm scripts, mapped actions) to the detail menu.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { PROJECTS_DIR, DEVELOPMENT_DIR } from "../../infrastructure/config.js";
import { getProjectSource } from "../../infrastructure/state.js";
import type { ProjectConfig, ProjectSource, FlowtiToolId } from "../../infrastructure/types.js";

const CONFIGS_DIR = "configs";
const FLOWTI_CONFIG = "flowti.config.json";

// ── Path resolution ─────────────────────────────────────────────────

export function resolveProjectPath(name: string, source?: ProjectSource): string {
	const s = source ?? getProjectSource();
	return s === "development"
		? paths.join(DEVELOPMENT_DIR, name)
		: paths.join(PROJECTS_DIR, name);
}

// ── Package.json ────────────────────────────────────────────────────

export interface PackageJson {
	name?: string;
	version?: string;
	scripts?: Record<string, string>;
}

export function readPackageJson(projectPath: string): PackageJson | null {
	const pkgPath = paths.join(projectPath, "package.json");
	if (!disk.existsSync(pkgPath)) return null;
	try {
		return JSON.parse(disk.readFileSync(pkgPath, "utf-8")) as PackageJson;
	} catch {
		return null;
	}
}

// ── Flowti project config ───────────────────────────────────────────

export function readProjectConfig(projectPath: string): ProjectConfig | null {
	const cfgPath = paths.join(projectPath, CONFIGS_DIR, FLOWTI_CONFIG);
	if (!disk.existsSync(cfgPath)) return null;
	try {
		return JSON.parse(disk.readFileSync(cfgPath, "utf-8")) as ProjectConfig;
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
		name: pkg.name ?? paths.basename(projectPath),
		tools,
	};

	const configsDir = paths.join(projectPath, CONFIGS_DIR);
	if (!disk.existsSync(configsDir)) disk.mkdirSync(configsDir, { recursive: true });
	const cfgPath = paths.join(configsDir, FLOWTI_CONFIG);
	disk.writeFileSync(cfgPath, JSON.stringify(config, null, "\t"), "utf-8");
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

// ── Reports directory ────────────────────────────────────────────────

const DEFAULT_REPORTS_DIR = "reports";

export function getReportsDir(projectPath: string, config: ProjectConfig): string {
	return paths.join(projectPath, config.reports?.dir ?? DEFAULT_REPORTS_DIR);
}
