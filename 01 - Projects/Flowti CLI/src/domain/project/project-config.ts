/**
 * project-config.ts — Per-project configuration service.
 *
 * Detects package.json in the selected project, auto-creates a
 * flowti.config.json if missing, and provides project-scoped
 * data (npm scripts, mapped actions) to the detail menu.
 */

import { PROJECTS_DIR } from "../../infrastructure/config.js";
import type { ProjectConfig, ProjectContext, FlowtiToolId } from "../../infrastructure/types.js";
import { validateProjectConfig } from "./config-schema.js";
import { validateConfigDeep } from "./config-deep-validation.js";
import type { CliDeps } from "../../infrastructure/deps.js";

const CONFIGS_DIR = "configs";
const FLOWTI_CONFIG = "flowti.config.json";

// ── Path resolution ─────────────────────────────────────────────────

export function resolveProjectPath(name: string, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(PROJECTS_DIR, name);
}

// ── Package.json ────────────────────────────────────────────────────

export interface PackageJson {
	name?: string;
	version?: string;
	scripts?: Record<string, string>;
}

export function readPackageJson(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">): PackageJson | null {
	const pkgPath = deps.paths.join(projectPath, "package.json");
	if (!deps.disk.existsSync(pkgPath)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(pkgPath, "utf-8")) as PackageJson;
	} catch {
		return null;
	}
}

// ── Flowti project config ───────────────────────────────────────────

export interface ReadConfigResult {
	config: ProjectConfig | null;
	warnings: string[];
}

export function readProjectConfig(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">): ReadConfigResult {
	const cfgPath = deps.paths.join(projectPath, CONFIGS_DIR, FLOWTI_CONFIG);
	if (!deps.disk.existsSync(cfgPath)) return { config: null, warnings: [] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(deps.disk.readFileSync(cfgPath, "utf-8"));
	} catch {
		return { config: null, warnings: [] };
	}

	const { errors, warnings } = validateProjectConfig(parsed);

	if (errors.length > 0) {
		return { config: null, warnings: [...errors, ...warnings] };
	}

	return { config: parsed as ProjectConfig, warnings };
}

function scaffoldProjectConfig(projectPath: string, pkg: PackageJson, deps: Pick<CliDeps, "disk" | "paths">): ProjectConfig {
	const scripts = pkg.scripts ?? {};
	const tools: Partial<Record<FlowtiToolId, string>> = {};

	// Auto-map well-known script names to Flowti tool keys
	if (scripts["build"]) tools.build = "npm run build";
	if (scripts["reports"]) tools.reports = "npm run reports";
	if (scripts["dev"]) tools.devtools = "npm run dev";

	const config: ProjectConfig = {
		name: pkg.name ?? deps.paths.basename(projectPath),
		tools,
	};

	const configsDir = deps.paths.join(projectPath, CONFIGS_DIR);
	if (!deps.disk.existsSync(configsDir)) deps.disk.mkdirSync(configsDir, { recursive: true });
	const cfgPath = deps.paths.join(configsDir, FLOWTI_CONFIG);
	deps.disk.writeFileSync(cfgPath, JSON.stringify(config, null, "\t"), "utf-8");
	return config;
}

// ── Initialize project ──────────────────────────────────────────────

export function initializeProject(name: string, deps: Pick<CliDeps, "disk" | "paths">): ProjectContext {
	const projectPath = resolveProjectPath(name, deps);
	const pkg = readPackageJson(projectPath, deps);

	const { config: loadedConfig, warnings } = readProjectConfig(projectPath, deps);
	let config = loadedConfig;

	if (!config && pkg) {
		config = scaffoldProjectConfig(projectPath, pkg, deps);
	}

	if (!config) {
		config = { name };
	}

	// Deep validation: check configured paths exist on disk
	const deep = validateConfigDeep(config, projectPath, deps.disk, deps.paths);
	const allWarnings = [...warnings, ...deep.warnings];

	return {
		path: projectPath,
		pkg,
		config,
		scripts: pkg?.scripts ?? {},
		configWarnings: allWarnings.length > 0 ? allWarnings : undefined,
	};
}

// ── Reports directory ────────────────────────────────────────────────

const DEFAULT_REPORTS_DIR = "reports";

export function getReportsDir(projectPath: string, config: ProjectConfig, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(projectPath, config.reports?.dir ?? DEFAULT_REPORTS_DIR);
}
